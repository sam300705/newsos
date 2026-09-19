# NewsOS Pipeline

```text
RSS / Tavily Search / Tavily Crawl watchlists
                    ↓
              discovered_urls
                    ↓
 Tavily Extract / direct RSS metadata normalization
                    ↓
              source_documents
                    ↓
 canonical URL + hash + title/time + optional embeddings
                    ↓
                  stories
                    ↓
 newsworthiness / entities / source reputation / primary evidence
                    ↓
      selective corroboration / Tavily Research
                    ↓
          claims + claim_evidence
                    ↓
 deterministic confidence + contradiction state
                    ↓
        source-constrained AI article
                    ↓
      article_citations from verified evidence
                    ↓
         deterministic quality gate
                    ↓
 editorial REVIEW / shadow decision / controlled policy
                    ↓
              publish_article RPC
                    ↓
 article_versions + publication_history + public site
                    ↓
 RSS / sitemap / company timeline / optional Aveiro drafts
```

## Failure semantics

All external providers are adapters. Failure marks/retries jobs and preserves canonical PostgreSQL state. Jobs use idempotency keys; duplicate ingestion is normalized before expensive research. Paid optional work can be deferred by budget state.
