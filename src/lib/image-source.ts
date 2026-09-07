export function safeInternalStorageUrl(rawPath: string | null, origin: string): string | null {
  if (!rawPath || rawPath.length > 4096) return null;

  let path = rawPath.trim();

  if (!path) return null;

  // Reject absolute/external protocols:
  // http:, https:, file:, data:, javascript:, etc.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;

  // Normalize an optional leading /storage/.
  path = path
    .replace(/^\/?storage\//, '')
    .replace(/^\/+/, '');

  if (
    !path ||
    path.includes('\0') ||
    path.includes('\\')
  ) {
    return null;
  }

  const segments = path.split('/');

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..'
    )
  ) {
    return null;
  }

  /*
   * Decode each segment twice to catch encoded and double-encoded traversal:
   * %2e%2e
   * %252e%252e
   * %2f
   * %255c
   */
  for (const segment of segments) {
    let decoded = segment;

    for (let i = 0; i < 2; i++) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        return null;
      }

      if (
        decoded === '.' ||
        decoded === '..' ||
        decoded.includes('/') ||
        decoded.includes('\\') ||
        decoded.includes('\0')
      ) {
        return null;
      }
    }
  }

  const encodedPath = segments
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${origin}/storage/${encodedPath}`;
}

