# Security Architecture Guide

## Overview

This application implements defense-in-depth security with authorization enforced at multiple layers:

1. **Database RLS Policies** - Primary defense (enforced by PostgreSQL)
2. **Edge Function Checks** - Secondary verification for privileged operations
3. **Client-Side Guards** - UX only (never trust these for security)

## Admin Authorization Pattern

### ✅ Correct: Database-First Authorization

```typescript
// Edge Function Example
import { verifyAuth, corsHeaders, handleCors } from '../_shared/auth-helpers.ts';

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Verify authentication and admin status
  const authResult = await verifyAuth(req, { requireAdmin: true });
  if (authResult instanceof Response) return authResult; // Auth failed
  
  const { user, isAdmin } = authResult;

  // Perform privileged operation - RLS will also enforce
  // ...
});
```

### ❌ Wrong: Client-Side Only

```typescript
// NEVER DO THIS - easily bypassed
if (localStorage.getItem('isAdmin') === 'true') {
  // Perform admin operation
}
```

## Database Security

### JWT-Based Authorization

The database has helper functions to check authorization from JWT claims:

```sql
-- Check admin status from JWT app_metadata
SELECT is_admin_jwt();

-- Combined JWT + database role check (backwards compatible)
SELECT is_admin_enhanced();

-- Check specific database role
SELECT has_role(auth.uid(), 'admin'::app_role);
```

### RLS Policy Pattern

All tables must have RLS enabled with proper policies:

```sql
-- Enable RLS
ALTER TABLE public.sensitive_data ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "users_read_own"
ON public.sensitive_data
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "admins_all_access"
ON public.sensitive_data
FOR ALL
USING (is_admin_enhanced())
WITH CHECK (is_admin_enhanced());
```

### SECURITY DEFINER Functions

For privileged operations that need to bypass RLS:

```sql
CREATE OR REPLACE FUNCTION public.admin_operation(params...)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner's privileges
SET search_path = public
AS $$
BEGIN
  -- ALWAYS check authorization FIRST
  IF NOT is_admin_enhanced() THEN
    RAISE EXCEPTION 'forbidden: admin required' USING ERRCODE = '42501';
  END IF;

  -- Perform privileged operation
  -- ...
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION public.admin_operation TO authenticated;
```

## Edge Function Security

### Authentication Flow

1. **Extract JWT** from Authorization header
2. **Verify with Supabase** using service role key
3. **Check admin status** from JWT app_metadata OR database
4. **Enforce requirements** before proceeding

### Using Shared Helpers

```typescript
import { verifyAuth } from '../_shared/auth-helpers.ts';

// Require authentication only
const auth = await verifyAuth(req);

// Require admin access
const auth = await verifyAuth(req, { requireAdmin: true });

// Require system admin access
const auth = await verifyAuth(req, { requireSystemAdmin: true });
```

### Calling Admin RPCs

```typescript
// Call SECURITY DEFINER function that checks admin internally
const { data, error } = await supabase.rpc('admin_bulk_delete_batches', {
  batch_ids: ['uuid1', 'uuid2']
});

// The RPC function will:
// 1. Check is_admin_enhanced()
// 2. Throw exception if not admin
// 3. Perform operation with elevated privileges
```

## Storage Security

Apply RLS policies to storage buckets:

```sql
-- Only admins can delete files
CREATE POLICY "admins_can_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (is_admin_enhanced());

-- Users can only access their own files
CREATE POLICY "users_access_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## Client-Side Security

### ⚠️ Important: Client Checks are UX Only

```typescript
// In React components - ONLY for showing/hiding UI
const { isAdmin } = useAuth();

return (
  <div>
    {isAdmin && <AdminPanel />}  {/* UX only - backend enforces */}
  </div>
);
```

### Never Trust Client Data

```typescript
// ❌ WRONG - attacker can modify
const isAdmin = localStorage.getItem('isAdmin');

// ✅ CORRECT - fetched from database with RLS
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);
```

## Security Checklist

### For New Tables
- [ ] Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Add policies for all operations (SELECT, INSERT, UPDATE, DELETE)
- [ ] Test with non-admin user to verify access is restricted
- [ ] Include admin policy: `USING (is_admin_enhanced())`

### For New Edge Functions
- [ ] Use `verifyAuth()` helper for authentication
- [ ] Add `requireAdmin: true` for admin-only operations
- [ ] Never trust client-provided authorization claims
- [ ] Call admin RPCs instead of direct queries when possible

### For Admin Operations
- [ ] Prefer SECURITY DEFINER RPCs over direct queries
- [ ] Always check `is_admin_enhanced()` first in RPCs
- [ ] Log admin actions for audit trail
- [ ] Prevent privilege escalation (e.g., only system_admin can create system_admin)

## Pre-existing Security Warnings

The following warnings are architectural and do not indicate vulnerabilities:

1. **Extension in Public Schema** - PostgreSQL extensions location (not a security risk)
2. **Leaked Password Protection Disabled** - Can be enabled in Supabase Auth settings if needed

## Testing Security

```bash
# Test as non-admin user (should fail)
curl -X POST https://project.supabase.co/functions/v1/admin-operation \
  -H "Authorization: Bearer $USER_JWT"

# Test as admin (should succeed)  
curl -X POST https://project.supabase.co/functions/v1/admin-operation \
  -H "Authorization: Bearer $ADMIN_JWT"

# Test RLS policies
-- Connect as specific user
SET request.jwt.claims = '{"sub": "user-id", "role": "authenticated"}';
SELECT * FROM sensitive_data; -- Should only see user's own data

-- Connect as admin
SET request.jwt.claims = '{"sub": "admin-id", "role": "authenticated", "app_metadata": {"role": "admin"}}';
SELECT * FROM sensitive_data; -- Should see all data
```

## Best Practices Summary

1. **Never trust client-side authorization** - always verify server-side
2. **Use RLS as primary defense** - let PostgreSQL enforce access control
3. **Edge functions check auth** before privileged operations
4. **SECURITY DEFINER RPCs** include their own admin checks
5. **Client code** only uses auth for UX (show/hide elements)
6. **Log admin actions** for security auditing
7. **Test thoroughly** with different user roles

## Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Definer](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
