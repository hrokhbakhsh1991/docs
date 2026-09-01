#!/usr/bin/env node
/**
 * Dev JWT parity guard — API, marketing, portal must share the same RS256 public verify key.
 * Mismatch → Marketing shows authenticated while Portal middleware rejects /me/* → /login.
 * @see docs/architecture/denali-gravity-remediation.mdoc DG-4.7.2
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.env.JWT_PARITY_REPO_ROOT?.trim() || resolve(import.meta.dirname, "..");

const SURFACES = [
  { name: "api", path: "apps/api/.env.local", required: true },
  { name: "marketing", path: "apps/marketing/.env.local", required: true },
  { name: "portal", path: "apps/portal/.env.local", required: true },
  { name: "web", path: "apps/web/.env.local", required: false },
];

function readEnvValue(envPath, key) {
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
}

function fingerprintPem(pem) {
  return createHash("sha256").update(pem).digest("hex").slice(0, 16);
}

const rows = [];
for (const surface of SURFACES) {
  const envPath = resolve(repoRoot, surface.path);
  let pub = null;
  try {
    pub = readEnvValue(envPath, "AUTH_JWT_PUBLIC_KEY");
  } catch {
    if (surface.required) {
      console.error(`guard-dev-jwt-parity: missing ${surface.path}`);
      process.exit(1);
    }
    continue;
  }
  if (pub === null || pub.length === 0) {
    if (surface.required) {
      console.error(`guard-dev-jwt-parity: AUTH_JWT_PUBLIC_KEY unset in ${surface.path}`);
      process.exit(1);
    }
    continue;
  }
  rows.push({ name: surface.name, fingerprint: fingerprintPem(pub) });
}

const apiFp = rows.find((r) => r.name === "api")?.fingerprint;
const mismatches = rows.filter((r) => r.fingerprint !== apiFp);

if (mismatches.length > 0) {
  console.error("guard-dev-jwt-parity: FAIL — JWT public key fingerprint mismatch");
  for (const row of rows) {
    console.error(`  ${row.name}: ${row.fingerprint}`);
  }
  console.error(
    "  Fix: run bash scripts/cloud/agent-start.sh (re-syncs guest surfaces) or restart smoke servers with matched jwtEnv."
  );
  process.exit(1);
}

console.log(
  `guard-dev-jwt-parity: OK — ${rows.map((r) => `${r.name}=${r.fingerprint}`).join(", ")}`
);
