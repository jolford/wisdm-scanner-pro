# Lint 0014: Extensions installed in `public`

**Why:** Keeping Postgres extensions in `public` can cause name collisions and messy permissions.  
**Fix:** Move all extensions to a dedicated `extensions` schema and lock it down.

## What this migration does
- Creates `extensions` schema (if missing)
- Revokes `CREATE` on `extensions` from `public` (keeps it tidy)
- Moves any currently installed extensions out of `public`
- Leaves extensions that already use their own schema (e.g., `graphql`) as-is
- **Skips extensions that don't support SET SCHEMA** (e.g., `pg_net`)

## Known Limitations
Some Supabase-managed extensions like `pg_net` don't support `SET SCHEMA` and must remain in their original schema. This is expected behavior and not a security concern.

## Verify
Run:
```sql
select e.extname, n.nspname as schema
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by 2,1;
```

Expect most extensions in `extensions` schema, with only immovable ones (like `pg_net`) remaining in `public`.

## Future-proof

Always install with an explicit schema:

```sql
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
```

---

## PR Template

**Title:** chore(db): move Postgres extensions out of `public` (lint 0014)

**Summary:**  
Fixes Supabase linter rule **`0014_extension_in_public`** by creating an `extensions` schema, revoking `CREATE` from `public`, and moving movable extensions out of `public`.

**Changes:**
- Migration: move extensions to dedicated schema
- Documentation: `docs/db/migrations/0014_extension_in_public.md`

**Verification:**
- [x] Ran migration on dev
- [x] Verified movable extensions are in `extensions` schema
- [x] Confirmed immovable extensions (pg_net) remain in public (expected)

**Notes:**  
Some extensions like `pg_net` don't support SET SCHEMA and remain in public by design.
