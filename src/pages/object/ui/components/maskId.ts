export function maskId(id: string, left = 8, right = 4) {
  const v = String(id ?? '');
  if (v.length <= left + right + 3) return v;
  return `${v.slice(0, left)}…${v.slice(-right)}`;
}
