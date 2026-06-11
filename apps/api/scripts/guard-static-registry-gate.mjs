#!/usr/bin/env node
/**
 * DI-REG-01 — static DEV_TENANTS lookups must be gated by isStaticTenantRegistryAllowed.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-039
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const ALLOWLIST = new Set([path.join(SRC, "tenant", "tenant-registry.ts")]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p, out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
      out.push(p);
    }
  }
  return out;
}

const violations = [];

for (const file of walk(SRC)) {
  if (ALLOWLIST.has(file)) {
    continue;
  }
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/\bfindTenantBy(Id|Subdomain)\s*\(/.test(line)) {
      continue;
    }

    const windowStart = Math.max(0, i - 6);
    const window = lines.slice(windowStart, i + 1).join("\n");
    if (
      !/\b(isStaticTenantRegistryAllowed|canResolveDevTenantRegistryFallback)\s*\(/.test(window)
    ) {
      violations.push(
        `${rel}:${i + 1}: findTenantBy* requires static-registry guard (DEC-039)`
      );
    }
  }
}

if (violations.length > 0) {
  console.error("guard-static-registry-gate: FAIL");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("guard-static-registry-gate: PASS");
