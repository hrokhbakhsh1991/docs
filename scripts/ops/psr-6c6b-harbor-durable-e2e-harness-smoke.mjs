#!/usr/bin/env node
/**
 * PSR-6c6b — Durable Harbor E2E harness ratchet (no live Playwright).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6c6b-harbor-durable-e2e-harness-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6c6b-harbor-durable-e2e-harness-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-6c6b-harbor-durable-e2e-harness") fail("wave mismatch");
if (inv.decision !== "harness_landed_no_live_run") fail("decision mismatch");
if (!inv.policy?.forbid_live_playwright_in_this_wave) fail("forbid live pw required");
if (!inv.policy?.keep_seed_harness_default) fail("keep seed default required");
if (inv.ratchet.live_playwright_executed !== false) fail("live must be false");
if (!(inv.gaps_closed || []).includes("G-SEED-E2E-HARNESS")) {
  fail("must claim G-SEED-E2E-HARNESS closed");
}

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`);
}

const seed = readFileSync(
  join(root, "apps/marketing/scripts/smoke-marketing-harbor-e2e-servers.mjs"),
  "utf8",
);
if (!seed.includes('HARBOR_SMOKE_E2E_SEED: "1"')) {
  fail("seed harness must still force seed=1");
}

const durable = readFileSync(
  join(root, "apps/marketing/scripts/smoke-marketing-harbor-durable-e2e-servers.mjs"),
  "utf8",
);
if (!durable.includes("assertDurableEnv") && !durable.includes("HARBOR_SMOKE_E2E_SEED must")) {
  fail("durable harness must reject seed=1");
}
if (!durable.includes("HARBOR_DURABLE_E2E_DRY_RUN")) {
  fail("durable harness must support DRY_RUN");
}
if (durable.includes('HARBOR_SMOKE_E2E_SEED: "1"')) {
  fail("durable harness must not force seed=1");
}

const pkg = JSON.parse(
  readFileSync(join(root, "apps/marketing/package.json"), "utf8"),
);
if (!pkg.scripts?.["test:smoke:harbor:durable"]) {
  fail("missing test:smoke:harbor:durable script");
}
if (!pkg.scripts?.["test:smoke:harbor"]?.includes("marketing-harbor.config")) {
  fail("default harbor smoke must remain seed config");
}

const pwDurable = readFileSync(
  join(root, "apps/marketing/playwright.marketing-harbor-durable.config.ts"),
  "utf8",
);
if (!pwDurable.includes("smoke-marketing-harbor-durable-e2e-servers.mjs")) {
  fail("durable playwright config must point at durable servers");
}

const rejectSeed = spawnSync(
  process.execPath,
  [join(root, "apps/marketing/scripts/smoke-marketing-harbor-durable-e2e-servers.mjs")],
  {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      HARBOR_SMOKE_E2E_SEED: "1",
      DATABASE_URL: "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db",
      DATABASE_URL_ADMIN: "postgresql://postgres:postgres@127.0.0.1:5434/tour_db",
      HARBOR_DURABLE_E2E_DRY_RUN: "1",
    },
  },
);
if (rejectSeed.status === 0) fail("durable harness must reject seed=1 even in dry-run");

const dryOk = spawnSync(
  process.execPath,
  [join(root, "apps/marketing/scripts/smoke-marketing-harbor-durable-e2e-servers.mjs")],
  {
    cwd: root,
    encoding: "utf8",
    env: Object.fromEntries(
      Object.entries({
        ...process.env,
        HARBOR_DURABLE_E2E_DRY_RUN: "1",
        DATABASE_URL: "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db",
        DATABASE_URL_ADMIN: "postgresql://postgres:postgres@127.0.0.1:5434/tour_db",
        STORAGE_DRIVER: "prisma",
      }).filter(([k]) => k !== "HARBOR_SMOKE_E2E_SEED"),
    ),
  },
);
if (dryOk.status !== 0) {
  fail(`dry-run should pass: ${dryOk.stderr || dryOk.stdout}`);
}

const harbor = JSON.parse(
  readFileSync(
    join(root, "packages/workspaces/harbor/workspace.manifest.json"),
    "utf8",
  ),
);
if (harbor?.guestConformance?.productionTier !== "stub") fail("tier must stay stub");

if (inv.ratchet.next_slice !== "PSR-8c0-governance-templates") fail("next_slice drift");

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-6c6b-harbor-durable-e2e-harness-smoke: OK — harness=landed seed_default=intact live_pw=false next=PSR-8c0`,
);
