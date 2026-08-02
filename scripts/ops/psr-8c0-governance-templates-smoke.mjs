#!/usr/bin/env node
/**
 * PSR-8c0 — Governance templates ratchet (root LICENSE/SECURITY/CONTRIBUTING still absent).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-8c0-governance-templates-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-8c0-governance-templates-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-8c0-governance-templates") fail("wave mismatch");
if (inv.decision !== "templates_only_not_root") fail("decision mismatch");
if (!inv.policy?.forbid_root_license_land_in_this_wave) fail("forbid root license");
if (inv.ratchet.l_gov_closed !== false) fail("l_gov must be open");
if ((inv.templates || []).length !== inv.ratchet.template_count) {
  fail("template_count drift");
}

for (const rel of [...(inv.templates || []), ...(inv.static_assets || [])]) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`);
}

if (existsSync(join(root, "LICENSE")) || existsSync(join(root, "LICENSE.md"))) {
  fail("root LICENSE landed — this wave forbids it; update to PSR-8c1");
}
if (existsSync(join(root, "SECURITY.md"))) fail("root SECURITY.md landed unexpectedly");
if (existsSync(join(root, "CONTRIBUTING.md"))) {
  fail("root CONTRIBUTING.md landed unexpectedly");
}

const choice = readFileSync(
  join(root, "docs/audits/snapshots/2026-07-31/governance-templates/LICENSE.CHOICE.md"),
  "utf8",
);
if (!choice.includes("Open core") || !choice.includes("Selected:")) {
  fail("LICENSE.CHOICE incomplete");
}

if (inv.ratchet.next_slice !== "PSR-ARCHITECT-DECISION-POINT") {
  fail("next must be decision point");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-8c0-governance-templates-smoke: OK — templates=${inv.ratchet.template_count} root_trio=absent next=ARCHITECT-DECISION`,
);
