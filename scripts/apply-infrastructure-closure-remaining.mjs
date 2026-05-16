#!/usr/bin/env node
/**
 * Completes repo-local "remaining" infrastructure closure steps:
 * - Jaeger stack
 * - OTLP env hint on API .env
 * - Local nginx BFF boundary test
 * - OTEL export check (when API restarted with OTLP)
 * - Full signoff + optional live gate
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const API_ENV = path.join(REPO_ROOT, "apps/api/.env");

function run(cmd, args, opts = {}) {
  console.log(`\n[remaining] → ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: REPO_ROOT, ...opts });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function ensureOtelInApiEnv() {
  const line = "OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318";
  if (!fs.existsSync(API_ENV)) {
    console.warn("[remaining] apps/api/.env missing — skip OTLP append");
    return false;
  }
  const text = fs.readFileSync(API_ENV, "utf8");
  if (text.includes("OTEL_EXPORTER_OTLP")) {
    console.log("[remaining] OTLP already configured in apps/api/.env");
    return true;
  }
  fs.appendFileSync(API_ENV, `\n# Infrastructure closure — local Jaeger (pnpm docker:observability)\n${line}\n`);
  console.log("[remaining] appended OTEL_EXPORTER_OTLP_ENDPOINT to apps/api/.env — restart API to export traces");
  return false;
}

function main() {
  run("docker", ["compose", "-f", "infra/docker-compose.observability.yml", "up", "-d"]);

  const otelReady = ensureOtelInApiEnv();

  run(process.execPath, ["scripts/verify-local-nginx-bff-boundary.mjs"]);

  const samplePath = path.join(REPO_ROOT, "scripts/fixtures/production-log-sample-live.ndjson");
  const gen = spawnSync(process.execPath, ["scripts/generate-production-log-sample.mjs"], {
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  if (gen.status === 0 && gen.stdout?.trim()) {
    fs.writeFileSync(samplePath, gen.stdout);
    process.env.PRODUCTION_LOG_SAMPLE = samplePath;
    console.log(`[remaining] wrote live error sample → ${samplePath}`);
  }

  run(process.execPath, ["scripts/infrastructure-closure-signoff.mjs"]);

  const apiUp = spawnSync("curl", ["-sf", "http://127.0.0.1:3001/health"], { encoding: "utf8" });
  const webUp = spawnSync("curl", ["-sf", "-o", "/dev/null", "http://ws1-rbac.localhost:3000/login"], {
    encoding: "utf8",
  });

  if (apiUp.status === 0 && webUp.status === 0) {
    run(process.execPath, ["scripts/infrastructure-closure-signoff.mjs", "--live"]);
  } else {
    console.warn("[remaining] live gate skipped — start API :3001 and Web :3000");
  }

  if (otelReady) {
    run(process.execPath, ["scripts/verify-otel-jaeger-export.mjs"]);
  } else {
    console.log(`
[remaining] Restart API after OTLP line was added, then run:
  node scripts/verify-otel-jaeger-export.mjs
`);
  }

  console.log(`
[remaining] Done (repo-local). For real staging/prod:
  • Copy docs/infrastructure/nginx-bff-ingress.example.conf to your ingress controller
  • Set OTEL_EXPORTER_OTLP_ENDPOINT on API deployment (see production-runbook §6.1)
  • PRODUCTION_LOG_SAMPLE=./drain.ndjson pnpm infra:signoff
`);
}

main();
