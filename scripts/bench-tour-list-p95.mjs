#!/usr/bin/env node
/**
 * Optional p95 probe for tour list path (Phase 7.4 — local/staging only).
 * Requires API :3001 and optional web :3000 with ws1-rbac host.
 */
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

const SAMPLES = Number(process.env.BENCH_TOUR_SAMPLES ?? "12");
const WARN_P95_MS = Number(process.env.BENCH_TOUR_P95_WARN_MS ?? "800");
const HOST = process.env.BENCH_TOUR_HOST ?? "ws1-rbac.localhost:3001";
const PATH = process.env.BENCH_TOUR_PATH ?? "/api/v2/tours";

function curlMs(args) {
  const t0 = performance.now();
  const r = spawnSync("curl", args, { encoding: "utf8" });
  return { ms: performance.now() - t0, ok: r.status === 0, status: r.status };
}

const health = curlMs(["-sf", "http://127.0.0.1:3001/health"]);
if (!health.ok) {
  process.exit(0);
}

const samples = [];
for (let i = 0; i < SAMPLES; i += 1) {
  const { ms, ok, _status } = curlMs([
    "-sf",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    `http://127.0.0.1:3001${PATH}`,
    "-H",
    `Host: ${HOST}`,
  ]);
  if (!ok) {
    process.exit(0);
  }
  samples.push(ms);
}

samples.sort((a, b) => a - b);
const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
const _p50 = samples[Math.floor(samples.length * 0.5)];

if (p95 > WARN_P95_MS) {
  process.exit(1);
}
