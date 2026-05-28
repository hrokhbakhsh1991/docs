#!/usr/bin/env node
/**
 * Micro-benchmark: sync tenant host parse vs lookup cache hit (optional live API).
 */
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ITER = Number(process.env.BENCH_ITER ?? "200000");
const WARN_LOOKUP_P95_MS = Number(process.env.BENCH_LOOKUP_P95_WARN_MS ?? "50");

const rtcPath = path.join(REPO_ROOT, "apps/web/lib/tenant/runtime-tenant-context.ts");
const rtc = fs.readFileSync(rtcPath, "utf8");

if (!rtc.includes("resolveTenantSlugFromHost")) {
  process.exit(1);
}

const benchScript = `
import { evaluateWorkspaceHost } from "./apps/web/lib/tenant/workspace-host-policy.ts";
const host = "ws1-rbac.localhost:3000";
const t0 = performance.now();
for (let i = 0; i < ${ITER}; i++) evaluateWorkspaceHost(host);
const ms = (performance.now() - t0) / ${ITER};
`;

const r = spawnSync(
  "pnpm",
  ["exec", "tsx", "-e", benchScript],
  { cwd: REPO_ROOT, encoding: "utf8", env: process.env },
);

if (r.status !== 0) {
  process.exit(1);
}

const line = (r.stdout || "").trim().split("\n").pop();
const parsed = JSON.parse(line || "{}");

if (parsed.usPerOp > 5000) {
  process.exit(1);
}

const apiUp =
  spawnSync("curl", ["-sf", "http://127.0.0.1:3001/health"], { encoding: "utf8" }).status === 0;
if (!apiUp) {
  process.exit(0);
}

const samples = [];
for (let i = 0; i < 10; i += 1) {
  const t0 = performance.now();
  spawnSync(
    "curl",
    [
      "-sf",
      "-o",
      "/dev/null",
      "http://127.0.0.1:3001/api/v2/auth/workspace-host",
      "-H",
      "Host: ws1-rbac.localhost:3001",
    ],
    { encoding: "utf8" },
  );
  samples.push(performance.now() - t0);
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
if (p95 > WARN_LOOKUP_P95_MS) {
}
