#!/usr/bin/env node
/**
 * Standalone 10k outbox-relay + withTenantRls reliability profile.
 *
 * Usage:
 *   DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db \
 *   DATABASE_URL_ADMIN=postgresql://postgres:postgres@127.0.0.1:5434/tour_db \
 *   node --import tsx --expose-gc scripts/reliability-outbox-relay-profile.ts
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sanitizeReliabilitySamplePayload } from "../src/observability/log-safety";

const specPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/reliability/outbox-relay-connection-leak.spec.ts"
);

const result = spawnSync(process.execPath, ["--import", "tsx", "--expose-gc", "--test", specPath], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "test" },
});

const rawSamples = process.env.P5_RELIABILITY_SAMPLES?.trim();
if (rawSamples) {
  try {
    const parsed = JSON.parse(rawSamples) as unknown;
    process.stderr.write(
      `${JSON.stringify({
        event: "p5.reliability.samples",
        samples: sanitizeReliabilitySamplePayload(parsed),
      })}\n`
    );
  } catch {
    process.stderr.write(
      `${JSON.stringify({ event: "p5.reliability.samples.invalid", code: "INVALID_SAMPLES" })}\n`
    );
  }
}

process.exit(result.status ?? 1);
