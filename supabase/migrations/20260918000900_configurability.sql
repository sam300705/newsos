alter table public.feeds add column if not exists interval_minutes integer not null default 10 check (interval_minutes between 5 and 10080);

insert into public.app_config(key,value,description) values
('confidence.thresholds','{"autoEligible":90,"quickReview":75,"manualReview":50}'::jsonb,'Confidence band thresholds'),
('newsworthiness.weights','{"sourceCount":15,"sourceAuthority":15,"primarySourcePresence":10,"recency":10,"subjectImportance":15,"eventMagnitude":10,"geographicRelevance":5,"novelty":10,"readerInterest":5,"socialSignal":5}'::jsonb,'Deterministic newsworthiness weights'),
('autonomy.approved_categories','["ai","technology","startups","funding","developer-tools"]'::jsonb,'Categories eligible for controlled autonomy'),
('autonomy.approved_source_tiers','["PRIMARY","REGULATOR"]'::jsonb,'Source tiers eligible for controlled autonomy')
on conflict(key) do nothing;
