// Simple runtime debug flag for UI.
// We intentionally avoid NODE_ENV checks here, because production builds may
// still need the ability to show diagnostic details to support teams.

export function isDebugEnabled(): boolean {
  try {
    const qs = new URLSearchParams(window.location.search);
    const v = (qs.get('debug') ?? '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}
