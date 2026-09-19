# Phase 0 Verification

## Required gate

Run from a clean checkout:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:run
npm run build
```

The build environment must provide only public Supabase placeholders for Phase 0. No server secret is required unless server Supabase client construction is invoked.

## Behavior checks

- Missing public Supabase key is rejected.
- Missing server Supabase secret is rejected when constructing server configuration.
- Public environment parsing never returns the server secret.
- Safe incoming `x-request-id` values are preserved.
- Unsafe request IDs are replaced with generated UUIDs.
- Health payload contains no environment secrets.

## Current sandbox note

The execution sandbox used during initial implementation has no DNS access to `registry.npmjs.org`. Offline behavior tests for environment validation and health/request-ID helpers were executed with the preinstalled TypeScript/ts-node toolchain. Full framework verification remains mandatory in an internet-enabled CI or developer environment before Phase 0 can be marked PASS.
