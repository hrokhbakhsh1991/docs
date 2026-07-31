#!/usr/bin/env node
/**
 * PSR-4b-whyDenali-alias-expiry — whyDenali dual-read removed; manifests forbid alias.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-4b-whyDenali-alias-expiry-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-4b-whyDenali-alias-expiry-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-4b-whyDenali-alias-expiry") {
  fail("inventory wave must be PSR-4b-whyDenali-alias-expiry");
}

const gateSrc = readFileSync(
  join(root, "scripts/codegen/workspace-registry/domains/guest-catalog.mjs"),
  "utf8",
);
if (/hasLegacy|deprecated whyDenali|accept deprecated/.test(gateSrc)) {
  fail("guest-catalog still dual-reads whyDenali");
}
if (!/whyDenali alias expired/.test(gateSrc)) {
  fail("guest-catalog missing alias-expired reject path");
}
if ((inv.metrics?.dual_read_sites_in_codegen ?? -1) !== 0) {
  fail("inventory dual_read_sites_in_codegen must be 0");
}

const manifestsDir = join(root, "packages/workspaces");
let withWhySection = 0;
let withWhyDenali = 0;
for (const name of readdirSync(manifestsDir)) {
  try {
    const m = JSON.parse(
      readFileSync(join(manifestsDir, name, "workspace.manifest.json"), "utf8"),
    );
    if (!m.guestLanding?.sections) continue;
    const sec = m.guestLanding.sections;
    if ("whyDenali" in sec) {
      withWhyDenali += 1;
      fail(`${name}: guestLanding.sections still declares whyDenali`);
    }
    if ("whySection" in sec) withWhySection += 1;
  } catch {
    /* skip */
  }
}

if ((inv.metrics?.manifests_with_whySection ?? -1) !== withWhySection) {
  fail(
    `metrics.manifests_with_whySection ${inv.metrics?.manifests_with_whySection} != ${withWhySection}`,
  );
}
if ((inv.metrics?.manifests_with_whyDenali ?? -1) !== withWhyDenali) {
  fail(
    `metrics.manifests_with_whyDenali ${inv.metrics?.manifests_with_whyDenali} != ${withWhyDenali}`,
  );
}
if (withWhyDenali !== 0) fail("expected zero whyDenali manifest keys");

if (!process.exitCode) {
  console.log("psr-4b-whyDenali-alias-expiry-smoke: PASS");
  console.log(`  whySection manifests=${withWhySection} whyDenali=${withWhyDenali} dual_read=0`);
}
