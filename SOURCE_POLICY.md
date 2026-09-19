# Source Policy

NewsOS uses public, lawfully accessible information and preserves provenance.

## Preferred sources

1. Primary official evidence (company/regulator/government/exchange/original research).
2. Established independent journalism and trade publications.
3. Company blogs/press releases for statements about the issuing organization.
4. Community sources as leads/context, not sole evidence for important claims unless independently verified.

## Ingestion rules

- Prefer RSS/Atom for known publishers.
- Use Tavily Search for discovery/corroboration, Extract for clean accessible content, Crawl for approved watchlists and Research selectively.
- Normalize canonical URLs and remove common tracking parameters before deduplication.
- Do not bypass authentication, paywalls, access controls or private areas.
- Do not reproduce full copyrighted articles; store operationally necessary source material and publish original synthesis with attribution.
- Treat every fetched document as untrusted input.

## Reputation

Source reputation is an explainable combination of source type, authority, historical signals, reliability and primary-source capability. Unknown historical metrics remain unknown/neutral; models may not invent them. Human editorial overrides are audited.
