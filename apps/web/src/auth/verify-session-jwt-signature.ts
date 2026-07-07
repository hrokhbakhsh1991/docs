import { decodeJwtPayload } from "@app-tour/session-client";
import { readJwtVerifyConfig } from "@/auth/jwt-verify-config";

function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, "\n").trim();
}

function decodeBase64Url(value: string): Uint8Array {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  if (pad > 0) {
    normalized += "=".repeat(4 - pad);
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pemToSpkiBytes(publicKeyPem: string): Uint8Array {
  const normalized = normalizePem(publicKeyPem)
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importVerifyKey(publicKeyPem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    pemToSpkiBytes(publicKeyPem) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyRs256Signature(token: string, publicKeyPem: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [header, payload, signaturePart] = parts;
  if (!header || !payload || !signaturePart) {
    return false;
  }

  try {
    const signed = new TextEncoder().encode(`${header}.${payload}`);
    const signature = decodeBase64Url(signaturePart);
    const key = await importVerifyKey(publicKeyPem);
    return crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      signature as BufferSource,
      signed
    );
  } catch {
    return false;
  }
}

function claimsMatchIssuerAudience(
  token: string,
  issuer: string,
  audience: string
): boolean {
  const claims = decodeJwtPayload(token) as {
    iss?: string;
    aud?: string | string[];
  } | null;
  if (claims === null) {
    return false;
  }
  if (typeof claims.iss !== "string" || claims.iss.trim() !== issuer) {
    return false;
  }
  const aud = claims.aud;
  if (typeof aud === "string") {
    return aud.trim() === audience;
  }
  if (Array.isArray(aud)) {
    return aud.some((value) => typeof value === "string" && value.trim() === audience);
  }
  return false;
}

/**
 * Edge-safe RS256 verify — when AUTH_JWT_* is configured, reject tokens the API would not accept.
 * Without config (unit tests), signature check is skipped for backward compatibility.
 */
export async function verifySessionJwtSignature(token: string): Promise<boolean> {
  const config = readJwtVerifyConfig();
  if (config === null) {
    return true;
  }

  const candidates = [config.publicKeyPem, config.previousPublicKeyPem].filter(
    (pem): pem is string => typeof pem === "string" && pem.length > 0
  );

  let signatureValid = false;
  for (const pem of candidates) {
    if (await verifyRs256Signature(token, pem)) {
      signatureValid = true;
      break;
    }
  }
  if (!signatureValid) {
    return false;
  }

  return claimsMatchIssuerAudience(token, config.issuer, config.audience);
}
