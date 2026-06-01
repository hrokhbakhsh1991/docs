/**
 * Cross-runtime UUID generation (Node.js Web Crypto API + modern browsers).
 * Avoids `node:crypto` so `@repo/denali-domain` can ship in Next.js client bundles.
 */
export function generateUuid(): string {
  const crypto = globalThis.crypto;
  if (crypto != null && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  throw new Error(
    "generateUuid: globalThis.crypto.randomUUID is not available in this runtime",
  );
}
