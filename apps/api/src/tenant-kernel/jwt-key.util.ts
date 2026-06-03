import { importSPKI } from "jose";

export function normalizePublicKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

export type JwtPublicKey = Awaited<ReturnType<typeof importSPKI>>;

export async function loadPublicKey(rawKey: string): Promise<JwtPublicKey> {
  const publicKeyPem = normalizePublicKey(rawKey);

  if (!publicKeyPem.includes("BEGIN PUBLIC KEY")) {
    throw new Error("AUTH_JWT_PUBLIC_KEY must be SPKI format (BEGIN PUBLIC KEY)");
  }

  return importSPKI(publicKeyPem, "RS256");
}
