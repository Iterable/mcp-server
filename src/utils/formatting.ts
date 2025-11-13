/**
 * Test-friendly, chalk-free formatter for Keychain choice labels.
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
