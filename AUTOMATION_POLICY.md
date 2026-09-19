# Automation Policy

## Modes

1. **Human approval:** automation may discover/research/verify/draft; publication is editorial.
2. **Shadow autonomy:** the system records `WOULD_AUTO_PUBLISH` but does not publish. Editor decisions are compared to system intent and disagreement rate is reported.
3. **Controlled autonomy:** only explicitly approved, non-high-risk stories can auto-publish after every deterministic gate passes.

## Controlled-autonomy requirements

Auto-publication requires: auto-publish feature enabled; global automation not paused; approved category; approved source tier; confidence threshold met; no unresolved contradiction; provenance complete; article quality gate passed; high-risk=false; budget not exhausted.

## Operational controls

A global pause stops automatically scheduled/processed work. Capability flags independently control RSS, Tavily discovery/crawl, extraction, clustering, article generation, Aveiro, newsletter, social and auto-publish. Explicit manual newsroom operations are recorded and may run independently of automated scheduling.

## Costs

At 80% of configured daily spend, optional deep research/newsletter/social automation is deferred. At 100%, paid automated jobs are deferred; RSS can continue. Pricing is only considered complete when explicit provider rates are configured.

## Safety

No model can bypass authorization, publication gates, RLS or the high-risk human-review policy. Retries are bounded and dead-lettered.
