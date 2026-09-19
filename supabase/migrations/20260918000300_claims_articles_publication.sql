do $$ begin
  create type public.claim_status as enum ('UNVERIFIED','SUPPORTED','MULTI_SOURCE_SUPPORTED','PRIMARY_SOURCE_VERIFIED','CONFLICTED','REJECTED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.article_status as enum ('DRAFT','REVIEW','APPROVED','SCHEDULED','PUBLISHED','REJECTED','CORRECTED');
exception when duplicate_object then null; end $$;

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  claim_text text not null,
  claim_type text not null,
  status public.claim_status not null default 'UNVERIFIED',
  confidence numeric(6,2) not null default 0 check (confidence between 0 and 100),
  verification_method text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  document_id uuid not null references public.source_documents(id) on delete cascade,
  stance text not null check (stance in ('SUPPORTS','CONTRADICTS','CONTEXT')),
  evidence_excerpt text,
  locator text,
  is_primary boolean not null default false,
  extraction_confidence numeric(5,4) check (extraction_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique(claim_id, document_id, stance, locator)
);

create table public.confidence_scores (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  score numeric(6,2) not null check (score between 0 and 100),
  inputs jsonb not null,
  components jsonb not null,
  band text not null,
  created_at timestamptz not null default now()
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null unique references public.stories(id) on delete cascade,
  slug text not null unique,
  status public.article_status not null default 'DRAFT',
  headline text not null,
  summary text,
  body_mdx text not null default '',
  category text,
  seo_title text,
  seo_description text,
  cover_image_url text,
  author_id uuid references auth.users(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  scheduled_for timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  version integer not null,
  headline text not null,
  summary text,
  body_mdx text not null,
  change_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(article_id, version)
);

create table public.article_citations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  claim_id uuid not null references public.claims(id) on delete cascade,
  document_id uuid not null references public.source_documents(id) on delete cascade,
  article_locator text not null,
  created_at timestamptz not null default now(),
  unique(article_id, claim_id, document_id, article_locator)
);

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  reason text not null,
  previous_value text,
  corrected_value text,
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_name text not null,
  version integer not null,
  template text not null,
  provider text,
  model text,
  active boolean not null default false,
  performance_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(prompt_name, version)
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete set null,
  article_id uuid references public.articles(id) on delete set null,
  operation text not null,
  provider text not null,
  model text not null,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  input_hash text,
  output_json jsonb,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  estimated_cost_usd numeric(12,6),
  success boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.publication_history (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  event text not null,
  from_status public.article_status,
  to_status public.article_status,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index claims_story_idx on public.claims(story_id, status);
create index evidence_claim_idx on public.claim_evidence(claim_id);
create index articles_status_published_idx on public.articles(status, published_at desc);
create index ai_runs_story_idx on public.ai_runs(story_id, created_at desc);

alter table public.claims enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.confidence_scores enable row level security;
alter table public.articles enable row level security;
alter table public.article_versions enable row level security;
alter table public.article_citations enable row level security;
alter table public.corrections enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.ai_runs enable row level security;
alter table public.publication_history enable row level security;

create policy "staff_claims" on public.claims for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "public_verified_claims" on public.claims for select to anon, authenticated using (status in ('SUPPORTED','MULTI_SOURCE_SUPPORTED','PRIMARY_SOURCE_VERIFIED') and exists(select 1 from public.stories s where s.id=story_id and s.status='PUBLISHED'));
create policy "staff_evidence" on public.claim_evidence for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_confidence" on public.confidence_scores for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_articles" on public.articles for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "public_articles" on public.articles for select to anon, authenticated using (status in ('PUBLISHED','CORRECTED'));
create policy "staff_versions" on public.article_versions for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "public_versions" on public.article_versions for select to anon, authenticated using (exists(select 1 from public.articles a where a.id=article_id and a.status in ('PUBLISHED','CORRECTED')));
create policy "staff_citations" on public.article_citations for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "public_citations" on public.article_citations for select to anon, authenticated using (exists(select 1 from public.articles a where a.id=article_id and a.status in ('PUBLISHED','CORRECTED')));
create policy "public_corrections" on public.corrections for select to anon, authenticated using (published_at is not null);
create policy "staff_corrections" on public.corrections for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN','EDITOR']::public.app_role[])));
create policy "admins_prompts" on public.prompt_versions for all to authenticated using ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[]))) with check ((select private.has_any_role(array['OWNER','ADMIN']::public.app_role[])));
create policy "staff_ai_runs" on public.ai_runs for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
create policy "staff_publication_history" on public.publication_history for select to authenticated using ((select private.has_any_role(array['OWNER','ADMIN','EDITOR','REVIEWER']::public.app_role[])));
