import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserPermissions {
  can_scan: boolean;
  can_validate: boolean;
  can_export: boolean;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    can_scan: true,
    can_validate: true,
    can_export: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is fine (defaults to true)
        throw error;
      }

      if (data) {
        setPermissions({
          can_scan: data.can_scan,
          can_validate: data.can_validate,
          can_export: data.can_export,
        });
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  return { permissions, loading, refetch: loadPermissions };
};