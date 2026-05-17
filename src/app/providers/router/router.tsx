import React from 'react';
import { createRoute, createRootRoute, createRouter } from '@tanstack/react-router';
import { MainPage } from '@pages/main';
import { AuthCallbackPage } from '@pages/auth-callback';
import { AuthSilentRenewPage } from '@pages/auth-silent-renew';
import { ObjectPage, ObjectViewPage } from '@pages/object';
import { DepositionAsyncPage } from '@pages/deposition-async';
import { DepositionAvailablePage } from '@pages/deposition-available';
import { DepositionObjectTypesPage } from '@pages/deposition-object-types';
import { DescriptiveMetadataSchemasPage } from '@pages/descriptive-metadata-schemas';
import { JobsPage } from '@pages/jobs';
import { ProfilePage } from '@pages/profile';
import { AppLayout } from '@shared/ui';

const rootRoute = createRootRoute({
  component: () => <AppLayout />,
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

const objectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/objects/$objectId',
  component: ObjectViewPage,
});

const objectEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/objects/$objectId/edit',
  component: ObjectPage,
});

const depositionAsyncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deposition/async',
  component: DepositionAsyncPage,
});

const depositionAvailableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deposition/available',
  component: DepositionAvailablePage,
});

const depositionObjectTypesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deposition/object-types',
  component: DepositionObjectTypesPage,
});

const descriptiveMetadataSchemasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/descriptive-metadata/schemas',
  component: DescriptiveMetadataSchemasPage,
});

const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs',
  component: JobsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authCallbackRoute,
  authSilentRenewRoute,
  objectRoute,
  objectEditRoute,
  depositionAsyncRoute,
  depositionAvailableRoute,
  depositionObjectTypesRoute,
  descriptiveMetadataSchemasRoute,
  jobsRoute,
  profileRoute,
]);

export const router = createRouter({
  routeTree,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
