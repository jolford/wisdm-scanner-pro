-- Add RLS policy for system admins to delete any documents
CREATE POLICY "System admins can delete any documents"
ON documents
FOR DELETE
TO authenticated
USING (is_system_admin(auth.uid()));