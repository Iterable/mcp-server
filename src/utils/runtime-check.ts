/* eslint-disable no-console */
/**
 * Runtime support checks for the CLI.
 * Throws an Error if the current Node.js version is unsupported.
 */
export function assertSupportedRuntime(): void {
  const [majorStr, minorStr] = (process.versions?.node || "0.0.0").split(".");
  const major = parseInt(majorStr || "0", 10);
  const minor = parseInt(minorStr || "0", 10);

  const hasMinVersion =
    Number.isFinite(major) && (major > 20 || (major === 20 && minor >= 0));
  if (!hasMinVersion) {
    throw new Error(
      `This CLI requires Node.js v20 or newer. Detected: v${process.versions.node}\n\n` +
        "Tips:\n" +
        "  • Install the LTS version from https://nodejs.org\n" +
        "  • Or with nvm:  nvm install --lts && nvm use --lts\n"
    );
  }

  // Sanity probe for modern regex flags (e.g., 'v' Unicode sets) used by dependencies.
  // Node 20+ should support this; keep the probe for defense-in-depth on vendor changes.
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _probe = new RegExp("a", "v");
  } catch {
    throw new Error(
      `Your Node.js runtime (v${process.versions.node}) lacks support for modern RegExp features used by this CLI.\n` +
        "Please upgrade to the latest LTS (Node 22) and try again."
    );
  }
}
