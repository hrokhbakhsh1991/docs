#!/usr/bin/env node
/**
 * DEC-075 / Phase 4 step 5 — proxy upstream timeout + circuit breaker.
 * @see docs/phase-5/appendices/proxy-upstream-timeout.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const proxy = read("src/proxy/tenant-http-proxy.ts");
if (!proxy.includes("AbortSignal.timeout")) {
  violations.push("tenant-http-proxy.ts must use AbortSignal.timeout for upstream deadline");
}
if (!proxy.includes("ProxyUpstreamCircuitBreaker")) {
  violations.push("tenant-http-proxy.ts must use ProxyUpstreamCircuitBreaker");
}
if (!proxy.includes("recordProxyUpstreamTimeout")) {
  violations.push("tenant-http-proxy.ts must call recordProxyUpstreamTimeout on deadline exceeded");
}

const timeout = read("src/proxy/proxy-upstream-timeout.ts");
if (!timeout.includes("PROXY_UPSTREAM_TIMEOUT_MS")) {
  violations.push("proxy-upstream-timeout.ts must read PROXY_UPSTREAM_TIMEOUT_MS");
}
if (!timeout.includes("ProxyUpstreamTimeoutError")) {
  violations.push("proxy-upstream-timeout.ts must define ProxyUpstreamTimeoutError");
}

const circuit = read("src/proxy/proxy-upstream-circuit.ts");
if (!circuit.includes("PROXY_CIRCUIT_FAILURE_THRESHOLD")) {
  violations.push("proxy-upstream-circuit.ts must read PROXY_CIRCUIT_FAILURE_THRESHOLD");
}
if (!circuit.includes("proxy_upstream_circuit_open_total")) {
  violations.push("proxy-upstream-circuit.ts must increment proxy_upstream_circuit_open_total");
}

for (const spec of [
  "src/proxy/tenant-http-proxy.spec.ts",
  "test/4-integration/proxy-upstream-timeout.spec.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, spec))) {
    violations.push(`${spec} must exist`);
  }
}

if (violations.length > 0) {
  console.error("guard-proxy-upstream-timeout: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-proxy-upstream-timeout: PASS");
