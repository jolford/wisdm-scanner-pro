import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
        setIsSystemAdmin(false);
        setIsTenantAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'system_admin']);

      if (error) throw error;

      const roles = data?.map(r => r.role) || [];
      const systemAdmin = roles.includes('system_admin');
      const tenantAdmin = roles.includes('admin');

      setIsSystemAdmin(systemAdmin);
      setIsTenantAdmin(tenantAdmin);
      setIsAdmin(systemAdmin || tenantAdmin);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setIsSystemAdmin(false);
      setIsTenantAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return {
    user,
    isAdmin,
    isSystemAdmin,
    isTenantAdmin,
    loading,
    signOut,
  };
};
