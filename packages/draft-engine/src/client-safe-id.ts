let fallbackCounter = 0;

function readCrypto(): Crypto | undefined {
  return typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
}

function fillFallbackBytes(bytes: Uint8Array): void {
  fallbackCounter = (fallbackCounter + 1) >>> 0;
  let state =
    (Date.now() ^
      fallbackCounter ^
      (typeof performance !== "undefined" ? Math.floor(performance.now() * 1000) : 0) ^
      Math.floor(Math.random() * 0xffffffff)) >>>
    0;

  for (let index = 0; index < bytes.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = state & 0xff;
  }
}

function formatUuidV4(bytes: Uint8Array): string {
  const normalized = bytes.slice();
  normalized[6] = (normalized[6]! & 0x0f) | 0x40;
  normalized[8] = (normalized[8]! & 0x3f) | 0x80;
  const hex = Array.from(normalized, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Browser/SSR-safe UUID for client intent and draft-local ids.
 *
 * Secure contexts use `crypto.randomUUID`. HTTP/IP staging still exposes
 * `getRandomValues` in modern browsers, so keep UUID shape without depending
 * on secure-context-only APIs.
 */
export function createClientSafeUuid(): string {
  const cryptoRef = readCrypto();
  if (typeof cryptoRef?.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoRef?.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes);
  } else {
    fillFallbackBytes(bytes);
  }
  return formatUuidV4(bytes);
}

export function createClientSafeId(prefix?: string): string {
  const id = createClientSafeUuid();
  const normalizedPrefix = prefix?.trim();
  return normalizedPrefix && normalizedPrefix.length > 0 ? `${normalizedPrefix}-${id}` : id;
}
