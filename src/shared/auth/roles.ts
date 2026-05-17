import type { User } from 'oidc-client-ts';
import { decodeJwtPayload } from './jwt';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Extract roles from Keycloak token.
 * Supports both `realm_access.roles` and `resource_access[client].roles`.
 */
export function getKeycloakRoles(user: User | null | undefined): string[] {
  if (!user) return [];

  const roles: string[] = [];

  // 1) Prefer access_token payload (most complete)
  const token = (user as unknown as { access_token?: unknown }).access_token;
  if (typeof token === 'string' && token.trim()) {
    const payload = decodeJwtPayload(token);
    if (payload) {
      const realmAccess = typeof payload.realm_access === 'object' && payload.realm_access ? (payload.realm_access as Record<string, unknown>) : null;
      const realmRoles = realmAccess && Array.isArray(realmAccess.roles) ? realmAccess.roles : null;
      if (realmRoles) {
        for (const r of realmRoles) {
          if (typeof r === 'string') roles.push(r);
        }
      }

      const resourceAccess =
        typeof payload.resource_access === 'object' && payload.resource_access
          ? (payload.resource_access as Record<string, unknown>)
          : null;
      if (resourceAccess) {
        for (const [, clientAccess] of Object.entries(resourceAccess)) {
          if (!clientAccess || typeof clientAccess !== 'object' || Array.isArray(clientAccess)) continue;
          const clientRoles = Array.isArray((clientAccess as Record<string, unknown>).roles)
            ? ((clientAccess as Record<string, unknown>).roles as unknown[])
            : null;
          if (!clientRoles) continue;
          for (const r of clientRoles) {
            if (typeof r === 'string') roles.push(r);
          }
        }
      }
    }
  }

  // 2) Fallback to user.profile (depends on configured userinfo mappers)
  const profile = isRecord((user as unknown as { profile?: unknown }).profile)
    ? ((user as unknown as { profile?: unknown }).profile as Record<string, unknown>)
    : null;

  if (profile) {
    const realmAccess = isRecord(profile.realm_access) ? profile.realm_access : null;
    const realmRoles = realmAccess && Array.isArray(realmAccess.roles) ? realmAccess.roles : null;
    if (realmRoles) {
      for (const r of realmRoles) {
        if (typeof r === 'string') roles.push(r);
      }
    }
  }

  return uniq(roles);
}

export function hasRole(user: User | null | undefined, role: string): boolean {
  return getKeycloakRoles(user).includes(role);
}
