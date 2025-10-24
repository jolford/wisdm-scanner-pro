-- Fix SUPA_extension_in_public (0014): move extensions out of the `public` schema
-- Safe to re-run (idempotent). Skips extensions that don't support SET SCHEMA.

-- 1) Create dedicated schema for extensions
create schema if not exists extensions;

-- 2) Lock down: allow usage, deny create
revoke create on schema extensions from public;
grant usage on schema extensions to public;

-- 3) Move any extensions currently installed in `public` into `extensions`
-- Skip those that don't support SET SCHEMA (like pg_net)
do $$
declare
  r record;
  move_count int := 0;
  skip_count int := 0;
begin
  for r in
    select e.extname
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where n.nspname = 'public'
  loop
    begin
      execute format('alter extension %I set schema extensions', r.extname);
      move_count := move_count + 1;
      raise notice 'Moved extension: %', r.extname;
    exception
      when feature_not_supported then
        skip_count := skip_count + 1;
        raise notice 'Skipped extension % (does not support SET SCHEMA)', r.extname;
      when others then
        raise warning 'Failed to move extension %: %', r.extname, sqlerrm;
    end;
  end loop;
  
  raise notice 'Extensions moved: %, skipped: %', move_count, skip_count;
end $$;