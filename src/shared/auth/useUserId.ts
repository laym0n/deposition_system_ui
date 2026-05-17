import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { getAccessTokenSubject } from './jwt';

/**
 * User id for ACL checks (Keycloak subject, i.e. JWT `sub`).
 */
export function useUserId(): string | null {
  const auth = useAuth();

  return useMemo(() => {
    if (auth.isLoading) return null;
    if (!auth.isAuthenticated) return null;
    return getAccessTokenSubject(auth.user);
  }, [auth.isLoading, auth.isAuthenticated, auth.user]);
}
