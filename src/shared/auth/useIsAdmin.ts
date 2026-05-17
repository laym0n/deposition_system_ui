import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { hasRole } from './roles';

const ADMIN_ROLE = 'ROLE_ADMIN';

export function useIsAdmin(): boolean {
  const auth = useAuth();

  return useMemo(() => {
    if (auth.isLoading) return false;
    if (!auth.isAuthenticated) return false;
    return hasRole(auth.user, ADMIN_ROLE);
  }, [auth.isLoading, auth.isAuthenticated, auth.user]);
}
