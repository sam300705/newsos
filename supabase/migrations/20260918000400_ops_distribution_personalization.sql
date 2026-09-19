create table public.distribution_outputs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  channel text not null check (channel in ('AVEIRO_PAGE','NEWSLETTER','SOCIAL')),
  external_id text,
  external_path text,
  status text not null default 'PENDING' check (status in ('PENDING','SYNCED','FAILED','REVIEW','PUBLISHED')),
  idempotency_key text not null unique,
  last_error text,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_timeline (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  story_id uuid references public.stories(id) on delete set null,
  event_type text not null,
  headline text not null,
  details jsonb not null default '{}'::jsonb,
  event_at timestamptz not null,
  verified_at timestamptz,
  unique(company_id, story_id, event_type)
);

create table public.funding_rounds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  story_id uuid references public.stories(id) on delete set null,
  round_type text,
  amount numeric,
  currency text,
  valuation numeric,
  announced_at date,
  investors jsonb not null default '[]'::jsonb,
  verified_at timestamptz,
  unique(company_id, story_id)
);

create table public.company_relationships (
  id uuid primary key default gen_random_uuid(),
  source_company_id uuid not null references public.companies(id) on delete cascade,
  target_entity_id uuid not null references public.entities(id) on delete cascade,
  relationship text not null,
  story_id uuid references public.stories(id) on delete set null,
  verified_at timestamptz,
  unique(source_company_id, target_entity_id, relationship, story_id)
);

create table public.user_topic_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, topic_id)
);

create table public.user_company_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, company_id)
);

create table public.saved_articles (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, article_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','UNSUBSCRIBED','BOUNCED')),
  cadence text not null default 'DAILY' check (cadence in ('INSTANT','DAILY','WEEKLY')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  idempotency_key text not null unique,
  status text not null check (status in ('QUEUED','RUNNING','SUCCEEDED','FAILED','DEAD_LETTER')),
  attempt integer not null default 0,
  max_attempts integer not null default 3,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dead_letters (
  id uuid primary key default gen_random_uuid(),
  job_run_id uuid not null unique references public.job_runs(id) on delete cascade,
  reason text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create table public.tavily_usage (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete set null,
  operation text not null,
  latency_ms integer,
  success boolean not null,
  estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);

create table public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);

create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  success boolean not null,
  latency_ms integer,
  estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_processed integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error_message text
);

create index timeline_company_date_idx on public.company_timeline(company_id, event_at desc);
create index jobs_status_next_idx on public.job_runs(status, next_attempt_at, created_at);
create index usage_tavily_date_idx on public.tavily_usage(created_at desc);
create index usage_llm_date_idx on public.llm_usage(created_at desc);

alter table public.distribution_outputs enable row level security;
alter table public.company_timeline enable row level security;
alter table public.funding_rounds enable row level security;
alter table public.company_relationships enable row level security;
alter table public.user_topic_follows enable row level security;
alter table public.user_company_follows enable row level security;
alter table public.saved_articles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_preferences enable row level security;
alter table public.job_runs enable row level security;
alter table public.dead_letters enable row level security;
alter table public.tavily_usage enable row level security;
alter table public.llm_usage enable row level security;
alter table public.api_usage enable row level security;
alter table public.automation_runs enable row level security;

create policy "staff_distribution" on public.distribution_outputs for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "public_company_timeline" on public.company_timeline for select to anon, authenticated using (verified_at is not null);
create policy "public_funding_rounds" on public.funding_rounds for select to anon, authenticated using (verified_at is not null);
create policy "public_company_relationships" on public.company_relationships for select to anon, authenticated using (verified_at is not null);
create policy "own_topic_follows" on public.user_topic_follows for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own_company_follows" on public.user_company_follows for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own_saved_articles" on public.saved_articles for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "own_subscriptions" on public.subscriptions for select to authenticated using ((select auth.uid())=user_id or (select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));
create policy "own_preferences" on public.user_preferences for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "staff_jobs" on public.job_runs for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "admins_dead_letters" on public.dead_letters for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));
create policy "staff_usage" on public.tavily_usage for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_llm_usage" on public.llm_usage for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_api_usage" on public.api_usage for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_automation" on public.automation_runs for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
