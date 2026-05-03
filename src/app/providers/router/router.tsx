import React from 'react';
import { createRoute, createRootRoute, createRouter, Outlet } from '@tanstack/react-router';
import { MainPage } from '@pages/main';
import { AuthCallbackPage } from '@pages/auth-callback';
import { AuthSilentRenewPage } from '@pages/auth-silent-renew';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MainPage,
});

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallbackPage,
});

const authSilentRenewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/silent-renew',
  component: AuthSilentRenewPage,
});

const routeTree = rootRoute.addChildren([indexRoute, authCallbackRoute, authSilentRenewRoute]);

export const router = createRouter({
  routeTree,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
