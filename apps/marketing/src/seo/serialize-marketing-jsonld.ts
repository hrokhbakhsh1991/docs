/**
 * XSS-safe JSON-LD serialization for <script type="application/ld+json"> blocks.
 */
export function serializeMarketingJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
