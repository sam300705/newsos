create extension if not exists vector;

do $$ begin
  create type public.source_type as enum ('PRIMARY','REGULATOR','MAINSTREAM_NEWS','TRADE_PUBLICATION','COMPANY_BLOG','PRESS_RELEASE','COMMUNITY','UNKNOWN');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.story_status as enum ('CANDIDATE','CLUSTERED','RESEARCHING','VERIFIED','DRAFTED','PUBLISHED','REJECTED');
exception when duplicate_object then null; end $$;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  source_type public.source_type not null default 'UNKNOWN',
  authority_score numeric(5,4) not null default 0.5 check (authority_score between 0 and 1),
  primary_source_capability boolean not null default false,
  historical_accuracy numeric(5,4) check (historical_accuracy between 0 and 1),
  correction_rate numeric(5,4) check (correction_rate between 0 and 1),
  failure_rate numeric(5,4) check (failure_rate between 0 and 1),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','BLOCKED')),
  editorial_notes text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feeds (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  url text not null unique,
  etag text,
  last_modified text,
  last_fetched_at timestamptz,
  last_status integer,
  failure_count integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discovered_urls (
  id uuid primary key default gen_random_uuid(),
  normalized_url text not null unique,
  original_url text not null,
  url_hash text not null unique,
  discovery_channel text not null,
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  discovered_url_id uuid not null references public.discovered_urls(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  title text,
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  canonical_url text not null,
  content_text text,
  content_hash text,
  extraction_provider text,
  extraction_quality numeric(5,4) check (extraction_quality between 0 and 1),
  http_status integer,
  raw_metadata jsonb not null default '{}'::jsonb,
  unique(discovered_url_id, content_hash)
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  status public.story_status not null default 'CANDIDATE',
  canonical_title text,
  summary text,
  category text,
  newsworthiness_score numeric(6,2) check (newsworthiness_score between 0 and 100),
  confidence_score numeric(6,2) check (confidence_score between 0 and 100),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_sources (
  story_id uuid not null references public.stories(id) on delete cascade,
  document_id uuid not null references public.source_documents(id) on delete cascade,
  relationship text not null default 'REPORTS' check (relationship in ('REPORTS','PRIMARY_EVIDENCE','CORROBORATES','CONTRADICTS')),
  added_at timestamptz not null default now(),
  primary key(story_id, document_id)
);

create table public.story_embeddings (
  story_id uuid primary key references public.stories(id) on delete cascade,
  embedding vector(1536) not null,
  model text not null,
  content_hash text not null,
  updated_at timestamptz not null default now()
);
create index story_embeddings_hnsw on public.story_embeddings using hnsw (embedding vector_cosine_ops);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  canonical_name text not null,
  normalized_name text not null,
  aliases text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, normalized_name)
);

create table public.companies (
  id uuid primary key references public.entities(id) on delete cascade,
  slug text not null unique,
  industry text,
  headquarters text,
  official_domain text,
  overview text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_entities (
  story_id uuid not null references public.stories(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  relationship text not null default 'MENTIONS',
  confidence numeric(5,4) not null default 0.5 check (confidence between 0 and 1),
  evidence_source_ids uuid[] not null default '{}',
  primary key(story_id, entity_id, relationship)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.story_topics (
  story_id uuid references public.stories(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  relevance numeric(5,4) not null default 1 check (relevance between 0 and 1),
  primary key(story_id, topic_id)
);

create table public.newsworthiness_scores (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  score numeric(6,2) not null check (score between 0 and 100),
  raw_signals jsonb not null,
  weights jsonb not null,
  components jsonb not null,
  created_at timestamptz not null default now()
);

create index source_documents_published_idx on public.source_documents(published_at desc);
create index stories_status_score_idx on public.stories(status, newsworthiness_score desc);
create index story_sources_story_idx on public.story_sources(story_id);
create index story_entities_entity_idx on public.story_entities(entity_id);

alter table public.sources enable row level security;
alter table public.feeds enable row level security;
alter table public.discovered_urls enable row level security;
alter table public.source_documents enable row level security;
alter table public.stories enable row level security;
alter table public.story_sources enable row level security;
alter table public.story_embeddings enable row level security;
alter table public.entities enable row level security;
alter table public.companies enable row level security;
alter table public.story_entities enable row level security;
alter table public.topics enable row level security;
alter table public.story_topics enable row level security;
alter table public.newsworthiness_scores enable row level security;

create policy "staff_sources" on public.sources for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "public_sources_read" on public.sources for select to anon, authenticated using (status = 'ACTIVE');
create policy "staff_feeds" on public.feeds for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "staff_discovered" on public.discovered_urls for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_documents" on public.source_documents for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_stories" on public.stories for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "public_published_stories" on public.stories for select to anon, authenticated using (status = 'PUBLISHED');
create policy "staff_story_sources" on public.story_sources for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_embeddings" on public.story_embeddings for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));
create policy "public_entities" on public.entities for select to anon, authenticated using (true);
create policy "staff_entities_write" on public.entities for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "public_companies" on public.companies for select to anon, authenticated using (true);
create policy "staff_companies_write" on public.companies for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "public_topics" on public.topics for select to anon, authenticated using (true);
create policy "public_story_topics" on public.story_topics for select to anon, authenticated using (exists(select 1 from public.stories s where s.id=story_id and s.status='PUBLISHED'));
create policy "staff_scores" on public.newsworthiness_scores for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
