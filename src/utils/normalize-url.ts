/**
 * Ensure a URL has a protocol prefix.
 * "example.com" → "https://example.com"
 * "http://example.com" → "http://example.com" (unchanged)
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
