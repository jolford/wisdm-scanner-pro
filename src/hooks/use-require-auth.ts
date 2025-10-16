import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './use-auth';

export const useRequireAuth = (requireAdmin = false, requireSystemAdmin = false) => {
  const { user, isAdmin, isSystemAdmin, isTenantAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (requireSystemAdmin && !isSystemAdmin) {
        navigate('/');
      } else if (requireAdmin && !isAdmin) {
        navigate('/');
      }
    }
  }, [user, isAdmin, isSystemAdmin, loading, requireAdmin, requireSystemAdmin, navigate]);

  return { user, isAdmin, isSystemAdmin, isTenantAdmin, loading };
};
