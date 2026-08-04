#!/usr/bin/env node
/**
 * PSR-6c2 — historical ratchet after PSR-6c3 wired API/durable list.
 * Live configure/durable ownership: PSR-6c3.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6c2-harbor-thin-host-card-mapper-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6c2-harbor-thin-host-card-mapper-smoke: FAIL — ${msg}`);
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

function listTsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listTsFiles(full));
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

const inv = loadYaml(invPath);
if (inv.wave !== "PSR-6c2-harbor-thin-host-card-mapper") fail("wave mismatch");
if (inv.decision !== "thin_host_slot_plus_card_mapper") fail("decision mismatch");

const mapper = join(
  root,
  "packages/workspaces/harbor/src/catalog/to-harbor-catalog-card.ts",
);
if (!existsSync(mapper)) fail("mapper missing");
const mapperSrc = readFileSync(mapper, "utf8");
if (!mapperSrc.includes("export function toHarborCatalogCard")) {
  fail("toHarborCatalogCard missing");
}
if (/@app-tour\/workspace-denali|listDenaliCatalog/.test(mapperSrc)) {
  fail("denali clone markers in mapper");
}

const hostRuntime = readFileSync(
  join(root, "packages/workspaces/harbor/src/http/harbor-http-host.ts"),
  "utf8",
);
if (!hostRuntime.includes("tryGetHarborHttpHost")) {
  fail("tryGetHarborHttpHost missing");
}

const slotSdk = readFileSync(
  join(root, "packages/workspace-sdk/src/http/create-workspace-http-host-slot.ts"),
  "utf8",
);
if (!slotSdk.includes("tryGet():")) fail("SDK tryGet missing");

const httpFiles = listTsFiles(
  join(root, "packages/workspaces/harbor/src/http"),
);
if (httpFiles.length > inv.ratchet.http_module_count_max) {
  fail(
    `http modules ${httpFiles.length} > max ${inv.ratchet.http_module_count_max}`,
  );
}

if (inv.ratchet.next_slice !== "PSR-6c3-api-configure-harbor-host" &&
    inv.ratchet.next_slice !== "PSR-6c4-harbor-durable-registration") {
  // allow historical next or progressed next after 6c3
  if (!String(inv.ratchet.next_slice).startsWith("PSR-6c")) {
    fail("next_slice drift");
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-6c2-harbor-thin-host-card-mapper-smoke: OK — historical mapper+slot http_modules=${httpFiles.length} (live wire owned by 6c3+)`,
);
