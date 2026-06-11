import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

/** Ephemeral RS256 keys for Playwright smoke — avoids .env.local dependency. */
export async function resolveSmokeApiJwtEnv() {
  const pair = await generateKeyPair("RS256", { extractable: true });
  return {
    AUTH_JWT_PUBLIC_KEY: await exportSPKI(pair.publicKey),
    AUTH_JWT_PRIVATE_KEY: await exportPKCS8(pair.privateKey),
    AUTH_JWT_ISSUER: "tour-ops",
    AUTH_JWT_AUDIENCE: "tour-ops-api",
  };
}
