#!/usr/bin/env bash
# Must be run only against the disposable local Supabase stack.
set -euo pipefail
command -v supabase >/dev/null
command -v psql >/dev/null
supabase db reset --local
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -X -v ON_ERROR_STOP=1 -f supabase/tests/permissions.sql

psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -X -v ON_ERROR_STOP=1 -f supabase/tests/publication.sql
python3 scripts/db/test-concurrency.py
