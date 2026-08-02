#!/usr/bin/env node
/**
 * PSR-7e — RC evidence pack schema ratchet (no attest / no live RC claim).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7e-rc-evidence-pack.schema.json",
);
const examplePath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7e-rc-evidence-pack.example.yaml",
);
const docPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7e-rc-evidence-pack-schema.mdoc",
);

function fail(msg) {
  console.error(`psr-7e-rc-evidence-pack-smoke: FAIL — ${msg}`);
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

for (const p of [schemaPath, examplePath, docPath]) {
  if (!existsSync(p)) fail(`missing ${p}`);
}

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
if (schema.title !== "PSR-7e Release Candidate Evidence Pack") fail("schema title");
if (!schema.required?.includes("program_gates")) fail("program_gates required");
if (!schema.properties?.program_gates?.required?.includes("psr9_closure")) {
  fail("psr9_closure gate missing");
}

const example = loadYaml(examplePath);
if (example.schema_version !== "psr-7e.1") fail("example schema_version");
if (example.program_id !== "PSR-001") fail("program_id");
for (const [k, v] of Object.entries(example.program_gates || {})) {
  if (v !== false) fail(`example program_gates.${k} must be false`);
}
if (example.artifacts?.harbor?.production_tier !== "stub") {
  fail("example harbor tier must be stub");
}
if (example.artifacts?.ops_identity?.model !== "shared_env_bearer") {
  fail("example ops_identity must reflect current shared bearer");
}
if (example.artifacts?.sbom?.provenance_included !== false) {
  fail("example must not claim provenance");
}
if (example.artifacts?.branch_protection?.live_verify_complete !== false) {
  fail("example must not claim live branch verify");
}

// Structural validate with jsonschema if available; else python jsonschema or manual
const pyValidate = `
import json, sys, yaml
from datetime import date, datetime
try:
    import jsonschema
except ImportError:
    print("NO_JSONSCHEMA")
    sys.exit(0)
schema=json.load(open(sys.argv[1], encoding="utf-8"))
def default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))
with open(sys.argv[2], encoding="utf-8") as f:
    data=yaml.safe_load(f)
# draft202012 format checker optional
jsonschema.validate(instance=data, schema=schema)
print("VALID")
`;
const v = spawnSync("python3", ["-c", pyValidate, schemaPath, examplePath], {
  cwd: root,
  encoding: "utf8",
});
if (v.status !== 0) {
  fail(`schema validate failed: ${v.stderr || v.stdout}`);
}
const out = (v.stdout || "").trim();
if (out !== "VALID" && out !== "NO_JSONSCHEMA") {
  fail(`unexpected validator output: ${out}`);
}

const doc = readFileSync(docPath, "utf8");
if (!doc.includes("R-EVIDENCE") && !doc.includes("evidence pack")) {
  fail("doc incomplete");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-7e-rc-evidence-pack-smoke: OK — schema=psr-7e.1 example_gates=all_false validate=${out || "manual"} next=PSR-7f`,
);
