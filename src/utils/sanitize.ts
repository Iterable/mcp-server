/**
 * Sanitization utilities for logging
 *
 * Prevents accidental exposure of Iterable API keys in logs and error messages.
 */

// Pattern to match Iterable API keys (32-character lowercase hexadecimal)
const ITERABLE_API_KEY_PATTERN = /\b[a-f0-9]{32}\b/gi;
// Pattern to match emails (basic heuristic)
const EMAIL_PATTERN = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Sanitize a string by replacing Iterable API keys with [REDACTED]
 *
 * @param text - The text to sanitize
 * @returns Sanitized text with API keys replaced
 */
export function sanitizeString(text: string): string {
  if (!text) return text;
  return text
    .replace(ITERABLE_API_KEY_PATTERN, "[REDACTED]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
}
