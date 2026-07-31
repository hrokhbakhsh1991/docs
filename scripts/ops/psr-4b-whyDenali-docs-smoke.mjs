#!/usr/bin/env node
/**
 * PSR-4b-whyDenali-docs — narrative docs teach whySection as canonical gate.
 *
 * Asserts each inventory narrative path:
 *  - contains whySection
 *  - does not contain sections.whyDenali or "whyDenali": as a current key
 *    (deprecated mentions must use the word deprecated/legacy/alias)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-4b-whyDenali-docs-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-4b-whyDenali-docs-smoke: FAIL — ${msg}`);
  process.exitCode = 1;
}

function loadYaml(abs) {
  const py = `
import json, sys, yaml
from datetime import date, datetime
def default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))
with open(sys.argv[1], encoding="utf-8") as f:
    json.dump(yaml.safe_load(f), sys.stdout, default=default)
`;
  const r = spawnSync("python3", ["-c", py, abs], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "yaml failed");
  return JSON.parse(r.stdout);
}

const inv = loadYaml(invPath);
if (inv.wave !== "PSR-4b-whyDenali-docs") {
  fail("inventory wave must be PSR-4b-whyDenali-docs");
}

const docs = inv.narrative_docs || [];
if ((inv.metrics?.narrative_docs ?? -1) !== docs.length) {
  fail(`metrics.narrative_docs ${inv.metrics?.narrative_docs} != ${docs.length}`);
}

/** Current-key shapes that must not appear after retarget. */
const FORBIDDEN = [
  /sections\.whyDenali\b/,
  /"whyDenali"\s*:/,
  /readonly whyDenali\s*:/,
  /\{whyDenali\s*&&/,
  /Gates:\s*`whyDenali`/,
  /PR-6 \| `whyDenali`/,
];

for (const row of docs) {
  const abs = join(root, row.path);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch (e) {
    fail(`missing narrative doc: ${row.path}`);
    continue;
  }
  if (!text.includes("whySection")) {
    fail(`${row.path} missing whySection (canonical gate)`);
  }
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      fail(`${row.path} still teaches whyDenali as current (${re})`);
    }
  }
}

if (!process.exitCode) {
  console.log("psr-4b-whyDenali-docs-smoke: PASS");
  console.log(`  narrative_docs=${docs.length}`);
}
