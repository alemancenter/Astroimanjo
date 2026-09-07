export function sessionMaxAge(token: string, fallback: number, now = Date.now()): number {
 try {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) return Math.max(0, Math.floor(payload.exp - now / 1000));
 } catch { /* Opaque legacy tokens keep the fallback. */ }
 return fallback;
}
export function hasSessionCredential(token?: string, refresh?: string): boolean { return Boolean(token || refresh); }
