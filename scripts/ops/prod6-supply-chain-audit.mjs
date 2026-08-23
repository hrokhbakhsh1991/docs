#!/usr/bin/env node
/** PROD-6 R6-16/R6-28 — production dependency vulnerability policy. */
import { spawnSync } from "node:child_process";

const r = spawnSync("pnpm", ["audit", "--prod", "--audit-level", "high", "--json"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
let data = {};
try {
  data = JSON.parse(r.stdout || "{}");
} catch {
  console.error("prod6-supply-chain-audit: FAIL — pnpm audit JSON parse failed");
  process.exit(2);
}
const advisories = Object.values(data.advisories || {});
const blocking = advisories.filter((a) => ["critical", "high"].includes(a.severity));
const counts = advisories.reduce((acc, a) => {
  acc[a.severity] = (acc[a.severity] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ policy: "prod dependencies: zero critical/high", advisory_count: advisories.length, blocking_count: blocking.length, counts }, null, 2));
if (blocking.length > 0) {
  for (const a of blocking) console.error(`  BLOCK ${a.severity} ${a.module_name} ${a.id}`);
  process.exit(1);
}
if (r.status !== 0 && advisories.length === 0) process.exit(r.status);
