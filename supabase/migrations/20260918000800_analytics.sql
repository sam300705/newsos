create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('ARTICLE_VIEW','READ_COMPLETE','SEARCH','ASK_NEWS','NEWSLETTER_SIGNUP')),
  article_id uuid references public.articles(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_type_date_idx on public.analytics_events(event_type,created_at desc);
create index analytics_events_article_idx on public.analytics_events(article_id,created_at desc);
alter table public.analytics_events enable row level security;
create policy "staff_analytics_read" on public.analytics_events for select to authenticated
using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
