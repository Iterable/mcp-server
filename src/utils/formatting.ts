/**
 * Test-friendly, chalk-free formatter for stored key choice labels.
 * Production coloring/wrapping is applied in ui.ts.
 */
export function formatKeychainChoiceLabelPlain(
  name: string,
  endpoint: string,
  isActive: boolean,
  env?: {
    ITERABLE_USER_PII?: string;
    ITERABLE_ENABLE_WRITES?: string;
    ITERABLE_ENABLE_SENDS?: string;
  }
): string {
  const activeBadge = isActive ? "[ACTIVE] " : "  ";
  const flags = env
    ? `  PII: ${env.ITERABLE_USER_PII === "true" ? "On" : "Off"} • Writes: ${env.ITERABLE_ENABLE_WRITES === "true" ? "On" : "Off"} • Sends: ${env.ITERABLE_ENABLE_SENDS === "true" ? "On" : "Off"}`
    : "";
  return `${activeBadge}${name}  ${endpoint}${flags}`;
}

/**
 * Get platform-specific storage description for tips/help text
 * @param bulletPoint - Whether to include a bullet point prefix (default: false)
 */
export function getKeyStorageMessage(bulletPoint = false): string {
  const prefix = bulletPoint ? "• " : "";
  const message =
    "Keys are encrypted at rest using platform-specific security (Keychain on macOS, DPAPI on Windows)";
  return prefix + message;
}
