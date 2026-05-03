import { useEffect } from 'react';
import { oidcUserManager } from '@shared/auth/oidc';

// This route is loaded in an iframe by oidc-client-ts to refresh tokens silently.
export function AuthSilentRenewPage() {
  useEffect(() => {
    oidcUserManager.signinSilentCallback();
  }, []);

  return null;
}
