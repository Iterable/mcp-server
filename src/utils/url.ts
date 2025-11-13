/**
 * URL-related helpers
 */

/**
 * Return true if the hostname is a localhost variant.
 * Accepts IPv4/IPv6 loopback and "localhost".
 */
export function isLocalhostHost(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    // Some callers historically checked startsWith("localhost:")
    lower.startsWith("localhost:")
  );
}

/**
 * True if URL uses https, or is localhost over http(s).
 */
export function isHttpsOrLocalhost(url: URL): boolean {
  return url.protocol === "https:" || isLocalhostHost(url.hostname);
}

/**
 * Sanitize a URL string for safe logging:
 * - Removes query string
 * - Masks likely PII in path segments (emails)
 * - Masks long opaque IDs (segments > 24 chars)
 */
export function sanitizeUrlForLogs(fullUrl: string): string {
  try {
    const u = new URL(fullUrl);
    u.search = ""; // drop query params
    const emailRe = /.+@.+\..+/;
    const sanitizedPath = u.pathname
      .split("/")
      .map((seg) => {
        if (!seg) return seg;
        if (emailRe.test(seg)) return "[REDACTED_EMAIL]";
        if (seg.length > 24) return "[ID]";
        return seg;
      })
      .join("/");
    return `${u.origin}${sanitizedPath}`;
  } catch {
    return "[UNPARSEABLE_URL]";
  }
}
