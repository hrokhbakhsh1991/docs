#!/usr/bin/env node
/**
 * Concurrent workspace-host probes across ws1/ws2/ws3 (Phase 7.5 — staging/local).
 */
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

const SLUGS = (process.env.LOAD_TENANT_SLUGS ?? "ws1-rbac,ws2-rbac,ws3-rbac")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ROOT = process.env.LOAD_TENANT_ROOT ?? "localhost";
const PORT = process.env.LOAD_API_PORT ?? "3001";
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? "30");
const ROUNDS = Number(process.env.LOAD_ROUNDS ?? "3");
const PATH = process.env.LOAD_PROBE_PATH ?? "/api/v2/auth/workspace-host";

function probe(slug) {
  const host = `${slug}.${ROOT}:${PORT}`;
  const t0 = performance.now();
  const r = spawnSync(
    "curl",
    [
      "-sf",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      `http://127.0.0.1:${PORT}${PATH}`,
      "-H",
      `Host: ${host}`,
    ],
    { encoding: "utf8" },
  );
  return {
    slug,
    ms: performance.now() - t0,
    ok: r.status === 0,
    status: (r.stdout || "").trim(),
  };
}

const health = spawnSync("curl", ["-sf", `http://127.0.0.1:${PORT}/health`], { encoding: "utf8" });
if (health.status !== 0) {
  process.exit(0);
}

const samples = [];
for (let round = 0; round < ROUNDS; round += 1) {
  for (let i = 0; i < CONCURRENCY; i += 1) {
    const slug = SLUGS[i % SLUGS.length];
    samples.push(probe(slug));
  }
}

const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
const _p95 = ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))];
const _p50 = ms[Math.floor(ms.length * 0.5)];
const errors = samples.filter((s) => !s.ok || (s.status !== "204" && s.status !== "200")).length;


if (errors > samples.length * 0.05) {
  process.exit(1);
}
