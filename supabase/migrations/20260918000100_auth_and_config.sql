create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.app_role as enum ('OWNER','ADMIN','EDITOR','REVIEWER','USER');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.app_role not null default 'USER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.has_any_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any(roles)
  );
$$;

revoke all on function private.has_any_role(public.app_role[]) from public;
grant execute on function private.has_any_role(public.app_role[]) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.feature_flags enable row level security;
alter table public.app_config enable row level security;

create policy "profile_self_read" on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "profile_self_update" on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
create policy "staff_profiles_read" on public.profiles for select to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));

create policy "staff_audit_read" on public.audit_logs for select to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));

create policy "staff_flags_read" on public.feature_flags for select to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "admins_flags_write" on public.feature_flags for all to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));

create policy "staff_config_read" on public.app_config for select to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "admins_config_write" on public.app_config for all to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])))
with check ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));

insert into public.feature_flags(key, enabled, description) values
('auto_publish', false, 'Controlled auto-publication after shadow evaluation'),
('multilingual_generation', false, 'Hindi/Hinglish article variants'),
('ask_the_news', false, 'Grounded Q&A over verified claims'),
('social_generation', false, 'Generate social drafts'),
('aveiro_sync', false, 'Sync approved content to Aveiro'),
('newsletter_generation', false, 'Generate newsletter drafts'),
('company_intelligence', true, 'Maintain company profiles and timelines')
on conflict (key) do nothing;

insert into public.app_config(key, value, description) values
('automation.global_pause', 'false'::jsonb, 'Emergency stop for all automation'),
('confidence.minimum_auto_publish', '90'::jsonb, 'Minimum confidence for controlled autonomy'),
('automation.shadow_mode', 'true'::jsonb, 'Predict auto-publish decisions without publishing'),
('cost.daily_budget_usd', '25'::jsonb, 'Daily external API budget')
on conflict (key) do nothing;
