// React hooks
import { useEffect, useState } from 'react';

// Supabase client for authentication and database access
import { supabase } from '@/integrations/supabase/client';

// React Router for navigation
import { useNavigate } from 'react-router-dom';

/**
 * useAuth Hook
 * Custom hook for managing authentication state and user roles
 * 
 * Features:
 * - Monitors authentication state changes (login/logout)
 * - Checks user roles (system admin, tenant admin, regular user)
 * - Provides sign out functionality with navigation
 * - Automatically updates when auth state changes
 * 
 * Returns:
 * - user: Current authenticated user object (null if not logged in)
 * - isAdmin: True if user is any kind of admin (system or tenant)
 * - isSystemAdmin: True if user has system_admin role
 * - isTenantAdmin: True if user has tenant admin role
 * - loading: True while checking authentication status
 * - signOut: Function to sign out and navigate to auth page
 */
export const useAuth = () => {
  // State management for user and roles
  const [user, setUser] = useState<any>(null);                // Current authenticated user
  const [session, setSession] = useState<any>(null);          // Current session (includes tokens)
  const [isAdmin, setIsAdmin] = useState(false);              // Any admin role
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);  // System-wide admin
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);  // Customer/tenant admin
  const [loading, setLoading] = useState(true);               // Loading state
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session on component mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Check roles for authenticated user
        checkAdminStatus(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for authentication state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event); // Debug logging
      
      // Handle different auth events
      if (event === 'SIGNED_OUT') {
        // User explicitly signed out - clear everything
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setIsSystemAdmin(false);
        setIsTenantAdmin(false);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // User signed in, token refreshed, or user updated - update session smoothly
        // This prevents the user from being kicked out during automatic token refreshes
        if (session) {
          setSession(session);
          setUser(session.user);
          // Only check admin status on initial sign-in, not on every token refresh
          if (event === 'SIGNED_IN') {
            checkAdminStatus(session.user.id);
          }
        }
      } else if (event === 'INITIAL_SESSION' && session) {
        // Initial session loaded
        setSession(session);
        setUser(session.user);
      }
    });

    // Cleanup: unsubscribe from auth changes when component unmounts
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Check if a user has admin roles
   * Queries the user_roles table to determine the user's role(s)
   * @param userId - The ID of the user to check
   */
  const checkAdminStatus = async (userId: string) => {
    try {
      // Query user_roles table for admin roles
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'system_admin']);  // Only check for admin roles

      if (error) throw error;

      // Extract roles from query result
      const roles = data?.map(r => r.role) || [];
      const systemAdmin = roles.includes('system_admin');
      const tenantAdmin = roles.includes('admin');

      // Update state with role information
      setIsSystemAdmin(systemAdmin);
      setIsTenantAdmin(tenantAdmin);
      setIsAdmin(systemAdmin || tenantAdmin);  // Either type of admin
    } catch (error) {
      console.error('Error checking admin status:', error);
      // On error, assume no admin privileges
      setIsAdmin(false);
      setIsSystemAdmin(false);
      setIsTenantAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out the current user and navigate to the authentication page
   */
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Return all auth state and functions for use in components
  return {
    user,
    session,
    isAdmin,
    isSystemAdmin,
    isTenantAdmin,
    loading,
    signOut,
  };
};
