-- Fix service_health RLS - ensure INSERT policy exists for system operations
DROP POLICY IF EXISTS "System can update service health" ON public.service_health;

CREATE POLICY "System admins can manage service health" ON public.service_health
  FOR ALL USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Service health insert for system" ON public.service_health
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service health update for system" ON public.service_health
  FOR UPDATE USING (true) WITH CHECK (true);