#!/usr/bin/env node
/**
 * CI: `apps/api/src/modules/finance` must not import Tours, Registrations, or Identity (users) modules.
 * Allowed integration is via ports, shared contracts, or inbound calls from other modules.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportAndExit, reportFatal } from "./guardrail-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const FINANCE_SRC = path.join(REPO_ROOT, "apps/api/src/modules/finance");

const FORBIDDEN_SEGMENTS = ["/tours/", "/registrations/", "/identity/"];

function walkTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walkTs(p, acc);
    } else if (ent.isFile() && ent.name.endsWith(".ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function normPosix(p) {
  return p.split(path.sep).join("/");
}

function importPathsFromLine(line) {
  const paths = [];
  const re = /\bfrom\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

function isForbidden(spec) {
  const s = spec.replace(/\\/g, "/");
  return FORBIDDEN_SEGMENTS.some((seg) => s.includes(seg));
}

function main() {
  const violations = [];
  for (const abs of walkTs(FINANCE_SRC)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    lines.forEach((line, idx) => {
      const t = line.trimStart();
      if (!t.startsWith("import ") && !t.startsWith("export ")) return;
      for (const spec of importPathsFromLine(line)) {
        if (!isForbidden(spec)) continue;
        violations.push(`${rel}:${idx + 1}: forbidden import "${spec}" (finance boundary)`);
      }
    });
  }
  reportAndExit("check-finance-boundary-isolation", violations);
}

try {
  main();
} catch (err) {
  reportFatal("check-finance-boundary-isolation", err);
}
