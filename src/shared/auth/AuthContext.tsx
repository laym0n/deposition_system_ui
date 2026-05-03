import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'oidc-client-ts';
import { oidcUserManager } from './oidc';

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    oidcUserManager.getUser().then((u) => {
      if (!mounted) return;
      setUser(u ?? null);
      setIsLoading(false);
    });

    const onUserLoaded = (u: User) => setUser(u);
    const onUserUnloaded = () => setUser(null);
    const onAccessTokenExpired = () => setUser(null);

    oidcUserManager.events.addUserLoaded(onUserLoaded);
    oidcUserManager.events.addUserUnloaded(onUserUnloaded);
    oidcUserManager.events.addAccessTokenExpired(onAccessTokenExpired);

    return () => {
      mounted = false;
      oidcUserManager.events.removeUserLoaded(onUserLoaded);
      oidcUserManager.events.removeUserUnloaded(onUserUnloaded);
      oidcUserManager.events.removeAccessTokenExpired(onAccessTokenExpired);
    };
  }, []);

  const login = useCallback(async () => {
    await oidcUserManager.signinRedirect();
  }, []);

  const logout = useCallback(async () => {
    await oidcUserManager.signoutRedirect();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user && !user.expired),
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}
