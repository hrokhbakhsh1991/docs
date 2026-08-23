import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GATE_ENV_ALLOWLIST = new Set([
  "DATABASE_URL",
  "DATABASE_URL_ADMIN",
  "DATABASE_URL_APP_TOUR",
  "STORAGE_DRIVER",
  "REDIS_URL",
]);

/**
 * Load gitignored API env files for local gate runs.
 * CI/VPS inject DATABASE_URL* via workflow env — never override non-empty values.
 * NODE_ENV and other build/runtime keys are excluded so Next.js builds stay valid.
 */
export function loadApiEnv(apiRoot) {
  for (const filename of [".env", ".env.local"]) {
    const filePath = join(apiRoot, filename);
    if (!existsSync(filePath)) continue;
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!GATE_ENV_ALLOWLIST.has(key)) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  }
}
