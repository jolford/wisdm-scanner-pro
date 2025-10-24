-- Fix error_logs RLS policies by dropping all and recreating
DO $$
BEGIN
  -- Drop all existing policies on error_logs
  DROP POLICY IF EXISTS "Users can insert their own error logs" ON error_logs;
  DROP POLICY IF EXISTS "Users can view their own error logs" ON error_logs;
  DROP POLICY IF EXISTS "Admins can view all error logs" ON error_logs;
  DROP POLICY IF EXISTS "System admins can view all error logs" ON error_logs;
  DROP POLICY IF EXISTS "Authenticated users can insert error logs" ON error_logs;
  DROP POLICY IF EXISTS "Users can view own error logs" ON error_logs;
END $$;

-- Allow all authenticated users to insert error logs (anonymous for logging)
CREATE POLICY "Anyone can insert error logs"
ON error_logs
FOR INSERT
WITH CHECK (true);

-- Users can view their own error logs
CREATE POLICY "Users view own logs"
ON error_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- System admins can view all error logs
CREATE POLICY "Admins view all logs"
ON error_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'system_admin'
  )
);