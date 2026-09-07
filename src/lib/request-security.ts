export function isAllowedMutation(request: Request, trustedOrigin: string): boolean {
 if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
 let expected: string;
 try { expected = new URL(trustedOrigin).origin; } catch { return false; }
 const origin = request.headers.get('origin');
 if (origin) return origin === expected;
 const referer = request.headers.get('referer');
 if (!referer) return false;
 try { return new URL(referer).origin === expected; } catch { return false; }
}
