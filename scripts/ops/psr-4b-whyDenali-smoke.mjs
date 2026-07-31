#!/usr/bin/env node
/**
 * PSR-4b-whyDenali — generated guest landing must emit whySection (not whyDenali).
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function fail(msg) {
  console.error(`psr-4b-whyDenali-smoke: FAIL — ${msg}`);
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

const generated = readFileSync(
  join(root, "packages/workspace-sdk/src/catalog/workspace-guest-landing.generated.ts"),
  "utf8",
);
if (/readonly whyDenali:/.test(generated) || /\bwhyDenali:/.test(generated)) {
  fail("generated guest landing still emits whyDenali");
}
if (!/readonly whySection:/.test(generated)) {
  fail("generated guest landing missing whySection type");
}

const manifestsDir = join(root, "packages/workspaces");
let whySectionManifests = 0;
for (const name of readdirSync(manifestsDir)) {
  try {
    const m = JSON.parse(
      readFileSync(join(manifestsDir, name, "workspace.manifest.json"), "utf8"),
    );
    if (!m.guestLanding?.sections) continue;
    const sec = m.guestLanding.sections;
    if ("whyDenali" in sec && !("whySection" in sec)) {
      fail(`${name}: still uses whyDenali without whySection`);
    }
    if ("whySection" in sec) whySectionManifests += 1;
  } catch {
    /* skip */
  }
}
if (whySectionManifests < 1) fail("no manifests declare whySection");

const inv = loadYaml(join(root, "docs/audits/snapshots/2026-07-31/psr-4b-whyDenali-inventory.yaml"));
if (inv.wave !== "PSR-4b-whyDenali") fail("inventory wave must be PSR-4b-whyDenali");
if ((inv.metrics?.manifests_with_whySection ?? 0) !== whySectionManifests) {
  fail(
    `inventory manifests_with_whySection ${inv.metrics?.manifests_with_whySection} != ${whySectionManifests}`,
  );
}

if (!process.exitCode) {
  console.log("psr-4b-whyDenali-smoke: PASS");
  console.log(`  manifests with whySection: ${whySectionManifests}`);
  console.log("  generated field: whySection");
}
