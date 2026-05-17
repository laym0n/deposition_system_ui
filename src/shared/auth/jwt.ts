function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function base64UrlDecode(input: string): string {
  // base64url -> base64
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${'='.repeat(padLen)}`;
  return atob(padded);
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  // JWT: header.payload.signature
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payloadB64 = parts[1];
  if (!payloadB64) return null;

  try {
    const json = base64UrlDecode(payloadB64);
    const parsed = JSON.parse(json) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Returns Keycloak/OpenID `sub` claim from access_token.
 * Backend ACL principal.id is expected to match this value.
 */
export function getAccessTokenSubject(user: unknown): string | null {
  const token = (user as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== 'string' || !token.trim()) return null;
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  return typeof sub === 'string' && sub.trim() ? sub : null;
}
