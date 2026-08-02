#!/usr/bin/env node
/**
 * PSR-7g — Tip RC evidence draft ratchet (gates must stay false).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7g-tip-rc-evidence-draft-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-7g-tip-rc-evidence-draft-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-7g-tip-rc-evidence-draft") fail("wave mismatch");
if (inv.decision !== "draft_generator_only") fail("decision mismatch");
if (!inv.policy?.forbid_claiming_any_program_gate_true) {
  fail("forbid_claiming_any_program_gate_true required");
}
if (inv.ratchet.next_slice !== "PSR-ARCHITECT-DECISION-POINT") {
  fail("next_slice must be decision point");
}

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const gen = spawnSync(
  process.execPath,
  [join(root, "scripts/ops/psr-7g-tip-rc-evidence-draft.mjs"), "--json"],
  { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
if (gen.status !== 0) fail(`draft generator failed: ${gen.stderr || gen.stdout}`);
const text = (gen.stdout || "").trim();
let pack;
try {
  pack = JSON.parse(text);
} catch {
  const start = text.indexOf('{"schema_version"');
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) fail("draft stdout missing pack JSON");
  pack = JSON.parse(text.slice(start, end + 1));
}

for (const [k, v] of Object.entries(pack.program_gates || {})) {
  if (v !== false) fail(`program_gates.${k} must be false`);
}
if (pack.artifacts?.harbor?.production_tier !== "stub") {
  fail("harbor tier must be stub in draft");
}
if (pack.artifacts?.branch_protection?.live_verify_complete !== false) {
  fail("must not claim live branch verify");
}
if (pack.artifacts?.sbom?.provenance_included !== false) {
  fail("must not claim provenance");
}
if (!existsSync(join(root, inv.output_path))) {
  fail(`draft output missing: ${inv.output_path}`);
}

const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
if (!gitignore.split(/\r?\n/).some((l) => l.trim() === "reports/psr/")) {
  fail("reports/psr/ must stay gitignored");
}

// schema validate
const pyValidate = `
import json, sys
try:
    import jsonschema
except ImportError:
    print("NO_JSONSCHEMA")
    sys.exit(0)
schema=json.load(open(sys.argv[1], encoding="utf-8"))
data=json.load(open(sys.argv[2], encoding="utf-8"))
jsonschema.validate(instance=data, schema=schema)
print("VALID")
`;
const v = spawnSync(
  "python3",
  [
    "-c",
    pyValidate,
    join(root, inv.schema),
    join(root, inv.output_path),
  ],
  { cwd: root, encoding: "utf8" },
);
if (v.status !== 0) fail(`draft schema invalid: ${v.stderr || v.stdout}`);

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-7g-tip-rc-evidence-draft-smoke: OK — sha=${pack.git_sha.slice(0, 8)} gates=all_false next=ARCHITECT-DECISION`,
);
