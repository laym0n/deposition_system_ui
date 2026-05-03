import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

function getEnv(name: string): string | undefined {
  const v = process.env[name] as string | undefined;
  return v && v.trim().length > 0 ? v : undefined;
}

const authority = getEnv('OIDC_AUTHORITY') ?? 'https://158.160.194.122/keycloak/realms/deposition';
const clientId = getEnv('OIDC_CLIENT_ID') ?? 'deposition-client';

export const oidcUserManager = new UserManager({
  authority,
  client_id: clientId,
  // SPA best practice for Keycloak: Authorization Code Flow + PKCE
  response_type: 'code',
  scope: 'openid profile email',
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  silent_redirect_uri: `${window.location.origin}/auth/silent-renew`,
  automaticSilentRenew: true,
  // Keep user in localStorage so page refresh doesn't log you out
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

export async function getAccessToken(): Promise<string | undefined> {
  const user = await oidcUserManager.getUser();
  if (!user || user.expired) return undefined;
  return user.access_token;
}
