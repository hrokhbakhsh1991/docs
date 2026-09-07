import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvValue(envPath, key) {
  try {
    const text = readFileSync(envPath, "utf8");
    const match = text.match(new RegExp(`^${key}=(.+)$`, "m"));
    if (!match) {
      return null;
    }
    const raw = match[1].trim();
    if (raw.startsWith('"') && raw.endsWith('"')) {
      return raw.slice(1, -1).replace(/\\n/g, "\n");
    }
    return raw;
  } catch {
    return null;
  }
}

function resolveDevJwtEnvFromApiEnvLocal() {
  const envPath = path.join(apiDir, ".env.local");
  const publicKey = readEnvValue(envPath, "AUTH_JWT_PUBLIC_KEY")?.trim();
  const privateKey = readEnvValue(envPath, "AUTH_JWT_PRIVATE_KEY")?.trim();
  if (!publicKey || !privateKey) {
    return null;
  }
  return {
    AUTH_JWT_PUBLIC_KEY: publicKey,
    AUTH_JWT_PRIVATE_KEY: privateKey,
    AUTH_JWT_ISSUER: readEnvValue(envPath, "AUTH_JWT_ISSUER")?.trim() || "tour-ops",
    AUTH_JWT_AUDIENCE: readEnvValue(envPath, "AUTH_JWT_AUDIENCE")?.trim() || "tour-ops-api",
  };
}

/** RS256 keys for Playwright smoke — prefers dev `.env.local` when present (portal parity). */
export async function resolveSmokeApiJwtEnv() {
  const devKeys = resolveDevJwtEnvFromApiEnvLocal();
  if (devKeys !== null) {
    return devKeys;
  }

  const pair = await generateKeyPair("RS256", { extractable: true });
  return {
    AUTH_JWT_PUBLIC_KEY: await exportSPKI(pair.publicKey),
    AUTH_JWT_PRIVATE_KEY: await exportPKCS8(pair.privateKey),
    AUTH_JWT_ISSUER: "tour-ops",
    AUTH_JWT_AUDIENCE: "tour-ops-api",
  };
}
