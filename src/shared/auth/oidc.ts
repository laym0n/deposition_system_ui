import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

function normalizeAuthority(input: string): string {
  return input;
}

function getProxiedRealmPath(): string {
  // Token/userinfo/jwks requests are XHR/fetch and may be blocked by CORS.
  // We proxy ONLY these endpoints via webpack-dev-server under /keycloak.
  return '/keycloak/realms/deposition';
}

const authority = normalizeAuthority(
  // NOTE: dotenv-webpack replaces only static references like process.env.OIDC_AUTHORITY.
  // Dynamic access `process.env[name]` won't be inlined, and will fall back to defaults.
  ((process.env.OIDC_AUTHORITY as string | undefined) ?? '').trim() ||
    'https://158.160.194.122/keycloak/realms/deposition',
);
const clientId =
  ((process.env.OIDC_CLIENT_ID as string | undefined) ?? '').trim() || 'deposition-client';

// Development-time diagnostics: helps quickly spot invalid env/URLs.
function assertValidUrl(name: string, value: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[OIDC] Invalid URL for ${name}:`, value);
  }
}

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
  // In dev environments auth redirects may take longer (VPN, slow network, debugging),
  // which can cause `authentication_expired` if state is considered stale.
  staleStateAgeInSeconds: 15 * 60,
  // Keep user in localStorage so page refresh doesn't log you out
  userStore: new WebStorageStateStore({ store: window.localStorage }),

  // IMPORTANT (dev proxy / no CORS):
  // Even if we call discovery via proxy, Keycloak often returns absolute endpoints
  // in openid-configuration (token_endpoint, etc.) pointing to real host.
  // Then oidc-client-ts will POST to that host and you'll still get CORS.
  // For proxied authority we hardcode metadata endpoints to same-origin.
  // Keep AUTHORIZATION endpoint on real Keycloak origin (browser navigation; no CORS issue),
  // but proxy XHR endpoints via same-origin /keycloak to avoid CORS.
  metadata: {
    issuer: authority,
    authorization_endpoint: `${authority}/protocol/openid-connect/auth`,
    end_session_endpoint: `${authority}/protocol/openid-connect/logout`,
    token_endpoint: `${window.location.origin}${getProxiedRealmPath()}/protocol/openid-connect/token`,
    userinfo_endpoint: `${window.location.origin}${getProxiedRealmPath()}/protocol/openid-connect/userinfo`,
    jwks_uri: `${window.location.origin}${getProxiedRealmPath()}/protocol/openid-connect/certs`,
  },
});

// Validate URLs early (will print to console if something is off)
assertValidUrl('OIDC_AUTHORITY', authority);
assertValidUrl('token_endpoint', `${window.location.origin}${getProxiedRealmPath()}/protocol/openid-connect/token`);

export async function getAccessToken(): Promise<string | undefined> {
  const user = await oidcUserManager.getUser();
  if (!user || user.expired) return undefined;
  return user.access_token;
}
