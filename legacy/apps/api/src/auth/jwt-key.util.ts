import { importPKCS8, importSPKI } from "jose";

export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

export function normalizePublicKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

export async function loadPrivateKey(rawKey: string): Promise<CryptoKey> {
  const privateKeyPem = normalizePrivateKey(rawKey);

  if (privateKeyPem.includes("BEGIN RSA PRIVATE KEY")) {
    throw new Error(
      "JWT_PRIVATE_KEY is PKCS1 (BEGIN RSA PRIVATE KEY). Convert it to PKCS8 with: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.pem -out private_pkcs8.pem"
    );
  }

  if (!privateKeyPem.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "JWT_PRIVATE_KEY must be PKCS8 format (BEGIN PRIVATE KEY)"
    );
  }

  return importPKCS8(privateKeyPem, "RS256");
}

export async function loadPublicKey(rawKey: string): Promise<CryptoKey> {
  const publicKeyPem = normalizePublicKey(rawKey);

  if (!publicKeyPem.includes("BEGIN PUBLIC KEY")) {
    throw new Error("JWT_PUBLIC_KEY must be SPKI format (BEGIN PUBLIC KEY)");
  }

  return importSPKI(publicKeyPem, "RS256");
}
