-- Remove overly-broad auth-only policies that trigger security findings
-- (Authentication is already implied by scoped policies like auth.uid() = id / has_customer())

-- =========================
-- PROFILES
-- =========================
DROP POLICY IF EXISTS "profiles_require_auth" ON public.profiles;

-- Ensure we still have scoped access policies (no-ops if they already exist)
-- (Do not recreate auth-only gate)


-- =========================
-- CUSTOMERS
-- =========================
DROP POLICY IF EXISTS "customers_require_auth" ON public.customers;

-- Ensure membership-scoped SELECT exists (no-ops if already exists)
-- NOTE: keeping existing scoped policies in place.

