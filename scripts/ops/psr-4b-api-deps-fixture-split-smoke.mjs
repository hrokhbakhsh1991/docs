#!/usr/bin/env node
/**
 * PSR-4b-api-deps-fixture-split — fixtures retained on API; classification ratchet.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  collectApiHostManifestPackages,
  partitionApiHostManifestPackages,
} from "../codegen/workspace-registry/domains/theme.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function fail(msg) {
  console.error(`psr-4b-api-deps-fixture-split-smoke: FAIL — ${msg}`);
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

function discoverManifests() {
  const dir = join(root, "packages/workspaces");
  const out = [];
  for (const name of readdirSync(dir)) {
    try {
      out.push(JSON.parse(readFileSync(join(dir, name, "workspace.manifest.json"), "utf8")));
    } catch {
      /* skip */
    }
  }
  return out;
}

const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-4b-api-deps-fixture-split-inventory.yaml",
);
const inv = loadYaml(invPath);
if (inv.wave !== "PSR-4b-api-deps-fixture-split") {
  fail("inventory wave must be PSR-4b-api-deps-fixture-split");
}
if (inv.decision !== "retain") fail("decision must be retain");
if (!inv.policy?.retain_registry_fixtures_on_api) {
  fail("policy.retain_registry_fixtures_on_api must be true");
}
if (!inv.policy?.forbid_deleting_fixture_deps) {
  fail("policy.forbid_deleting_fixture_deps must be true");
}

const manifests = discoverManifests();
const parts = partitionApiHostManifestPackages(manifests);
const all = collectApiHostManifestPackages(manifests);

if (JSON.stringify(parts.all) !== JSON.stringify(all)) {
  fail("partition.all drift vs collectApiHostManifestPackages");
}

const apiPkg = JSON.parse(readFileSync(join(root, "apps/api/package.json"), "utf8"));
const deps = apiPkg.dependencies ?? {};
for (const pkg of parts.registryOnlyFixtures) {
  if (deps[pkg] !== "workspace:*") {
    fail(`registryOnly fixture missing from apps/api deps: ${pkg}`);
  }
}
for (const pkg of all) {
  if (deps[pkg] !== "workspace:*") {
    fail(`manifest package missing from apps/api deps: ${pkg}`);
  }
}

const expectedFixtures = (inv.classes?.finance_registry_only || []).slice().sort();
if (JSON.stringify(parts.registryOnlyFixtures) !== JSON.stringify(expectedFixtures)) {
  fail(
    `registryOnlyFixtures drift\n  live: ${parts.registryOnlyFixtures.join(", ")}\n  inv:  ${expectedFixtures.join(", ")}`,
  );
}

if ((inv.metrics?.finance_registry_only_fixtures ?? -1) !== parts.registryOnlyFixtures.length) {
  fail("metrics.finance_registry_only_fixtures mismatch");
}
if ((inv.metrics?.api_product_deps ?? -1) !== all.length) {
  fail("metrics.api_product_deps mismatch");
}

const trunk = (inv.classes?.product_trunk || []).slice().sort();
const cert = (inv.classes?.certification_non_registry_only || []).slice().sort();
const classUnion = [...new Set([...trunk, ...expectedFixtures, ...cert])].sort();
if (JSON.stringify(classUnion) !== JSON.stringify(all)) {
  fail(
    `class union != all manifests\n  union: ${classUnion.join(", ")}\n  all:   ${all.join(", ")}`,
  );
}
if ((inv.metrics?.product_trunk ?? -1) !== trunk.length) {
  fail("metrics.product_trunk mismatch");
}
if ((inv.metrics?.certification_non_registry_only ?? -1) !== cert.length) {
  fail("metrics.certification_non_registry_only mismatch");
}

// Generated bindings must still import at least one registryOnly finance fixture.
const bindingHits = [];
for (const rel of inv.proof_consumers || []) {
  const abs = join(root, rel);
  const text = readFileSync(abs, "utf8");
  const hit = parts.registryOnlyFixtures.some((pkg) => text.includes(pkg));
  if (hit) bindingHits.push(rel);
}
if (bindingHits.length === 0) {
  fail("no proof_consumer generated file imports a registryOnly finance fixture");
}

if (!process.exitCode) {
  console.log("psr-4b-api-deps-fixture-split-smoke: PASS");
  console.log(
    `  all=${all.length} registryOnly=${parts.registryOnlyFixtures.length} nonRegistryOnly=${parts.nonRegistryOnly.length} binding_hits=${bindingHits.length}`,
  );
  console.log("  decision=retain (fixtures stay on apps/api)");
}
