import type { User } from 'oidc-client-ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export type SimpleUserProfile = {
  displayName: string;
  email?: string;
  preferredUsername?: string;
  name?: string;
};

/**
 * Extracts a minimal, UI-friendly profile from OIDC user object.
 */
export function getSimpleUserProfile(user: User | null | undefined): SimpleUserProfile | null {
  if (!user) return null;

  const profile = isRecord((user as unknown as { profile?: unknown }).profile)
    ? ((user as unknown as { profile?: unknown }).profile as Record<string, unknown>)
    : undefined;

  const name = typeof profile?.name === 'string' ? profile.name : undefined;
  const preferredUsername = typeof profile?.preferred_username === 'string' ? profile.preferred_username : undefined;
  const email = typeof profile?.email === 'string' ? profile.email : undefined;

  const displayName = name ?? preferredUsername ?? email ?? 'Пользователь';

  return {
    displayName,
    email,
    preferredUsername,
    name,
  };
}

export function getInitials(displayName: string) {
  const parts = displayName
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean);
  const first = parts[0]?.[0] ?? 'U';
  const second = parts.length > 1 ? parts[1]?.[0] : '';
  return `${first}${second}`.toUpperCase();
}
