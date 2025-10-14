import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './use-auth';

export const useRequireAuth = (requireAdmin = false) => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (requireAdmin && !isAdmin) {
        navigate('/');
      }
    }
  }, [user, isAdmin, loading, requireAdmin, navigate]);

  return { user, isAdmin, loading };
};
