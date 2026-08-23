#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const surfaces = [
  ["Admin", "apps/web/next.config.ts"],
  ["Portal", "apps/portal/next.config.ts"],
  ["Marketing", "apps/marketing/next.config.ts"],
];
const requiredHeaders = [
  "Content-Security-Policy",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
];

const failures = [];

for (const [name, rel] of surfaces) {
  const source = readFileSync(join(root, rel), "utf8");
  if (!/async\s+headers\s*\(/.test(source)) {
    failures.push(`${name}: missing Next headers() hook`);
  }
  if (!source.includes("frame-ancestors 'none'")) {
    failures.push(`${name}: CSP must deny framing`);
  }
  if (!source.includes("object-src 'none'")) {
    failures.push(`${name}: CSP must deny plugin/object execution`);
  }
  for (const header of requiredHeaders) {
    if (!source.includes(header)) {
      failures.push(`${name}: missing ${header}`);
    }
  }
}

if (failures.length) {
  console.error("prod6-security-headers: FAIL");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`prod6-security-headers: PASS — surfaces=${surfaces.length} headers=${requiredHeaders.length}`);
