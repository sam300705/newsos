"""Native PostgreSQL only. Two independent psql sessions, fixed loopback DB.
Never accepts an external URL. This disposable stack is reset by test-supabase.sh.
"""
import pathlib
import subprocess
import time

URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
CMD = ['psql', URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At']
ARTICLE = '96000000-0000-0000-0000-000000000001'
ACTOR = '91000000-0000-0000-0000-000000000002'


def sql(statement):
    result = subprocess.run(CMD, input=statement, text=True, capture_output=True, timeout=30)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def race(first, second, expected_error):
    # The first session signals after its mutation acquires the advisory lock.
    proc = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True)
    proc.stdin.write("begin; " + first + "; select 'LOCK_ACQUIRED'; select pg_sleep(2); commit;\n")
    proc.stdin.close()
    started = time.monotonic()
    while True:
        line = proc.stdout.readline()
        if not line:
            raise RuntimeError('First session failed before lock signal: ' + proc.stderr.read())
        if line.strip() == 'LOCK_ACQUIRED':
            break
        if time.monotonic() - started > 15:
            proc.kill()
            raise RuntimeError('No lock signal')
    other = subprocess.run(CMD, input="begin; select pg_try_advisory_xact_lock(73203,1); "+second+"; commit;", text=True, capture_output=True, timeout=15)
    proc.wait(timeout=15)
    if proc.returncode:
        raise RuntimeError(proc.stderr.read())
    if 'f' not in other.stdout.splitlines():
        raise AssertionError('Sessions did not overlap under the editorial lock')
    if other.returncode == 0 or expected_error not in other.stderr:
        raise AssertionError(f'Expected {expected_error}, got {other.stdout} {other.stderr}')


# Shared fixtures stop at an approved revision. Existing fixtures always roll back.
fixture = pathlib.Path('supabase/tests/publication.sql').read_text().split('-- Non-numeric')[0]
sql(fixture + '\ncommit;')
content = '''jsonb_build_object('headline','Acme launched its product.','summary','Acme opened a laboratory.','body',E'Acme launched its product.\\n\\nAcme delayed its launch.')'''
edit = f"select public.edit_article_revision('{ARTICLE}','{ACTOR}',1,{content})"
race(edit, edit, 'Stale revision')
assert sql(f"select revision from public.articles where id='{ARTICLE}'") == '2'
print('PASS: competing editors cannot overwrite the winning revision')
sql(f"select public.refresh_article_gate('{ARTICLE}'); select public.approve_article_revision('{ARTICLE}','{ACTOR}',2)")
# Evidence mutation wins lock, invalidates approval, and the waiting publish fails.
race("update public.sources set independence_group='acme' where id='92000000-0000-0000-0000-000000000001'",
     f"select public.publish_article('{ARTICLE}','{ACTOR}')", 'Approval stale')
assert sql(f"select count(*) from public.article_versions where article_id='{ARTICLE}'") == '0'
print('PASS: concurrent evidence mutation invalidates waiting publication')
sql(f"select public.refresh_article_gate('{ARTICLE}'); select public.approve_article_revision('{ARTICLE}','{ACTOR}',2)")
publish = f"select public.publish_article('{ARTICLE}','{ACTOR}')"
race(publish, publish, 'Approved article not due')
assert sql(f"select count(*) from public.publication_outbox where article_id='{ARTICLE}'") == '1'
assert sql(f"select count(*) from public.article_versions where article_id='{ARTICLE}'") == '1'
print('PASS: competing publications create exactly one immutable version and outbox event')
proposal = f"select public.propose_correction_revision('{ARTICLE}','{ACTOR}',2,jsonb_build_object('reason','Restore reviewed laboratory statement.','body',E'Acme launched its product.\\n\\nAcme opened a laboratory.'))"
first_id, second_id = sql(proposal), sql(proposal)
sql(f"select public.approve_correction_revision('{first_id}','{ACTOR}',2); select public.approve_correction_revision('{second_id}','{ACTOR}',2)")
race(f"select public.publish_correction('{first_id}','{ACTOR}')", f"select public.publish_correction('{second_id}','{ACTOR}')", 'Correction stale')
assert sql(f"select revision from public.articles where id='{ARTICLE}'") == '3'
assert sql(f"select count(*) from public.publication_outbox where article_id='{ARTICLE}'") == '2'
print('PASS: competing corrections cannot replace a newer published revision')
