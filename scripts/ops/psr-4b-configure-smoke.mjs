#!/usr/bin/env node
/**
 * PSR-4b-configure — ratchet product-named http/configure-* adapters.
 *
 * Asserts:
 *  - exact set of apps/api/src/http/configure-*.ts matches inventory
 *  - product-named count <= ceiling
 *  - finance adapter has zero branded workspace imports
 *  - configure adapters must not import bare workspace .../http (use .../host/http)
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const httpDir = join(root, "apps/api/src/http");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-4b-configure-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-4b-configure-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-4b-configure") fail("inventory wave must be PSR-4b-configure");

const live = readdirSync(httpDir)
  .filter((n) => n.startsWith("configure-") && n.endsWith(".ts"))
  .map((n) => `apps/api/src/http/${n}`)
  .sort();
const listed = (inv.adapters || []).map((a) => a.path).sort();
if (JSON.stringify(live) !== JSON.stringify(listed)) {
  fail(
    `configure set drift\n  live:   ${live.join(", ")}\n  listed: ${listed.join(", ")}`,
  );
}

const productNamed = (inv.adapters || []).filter((a) => a.class === "product-named");
const ceiling = inv.policy?.product_named_configure_ceiling;
if (typeof ceiling !== "number") fail("policy.product_named_configure_ceiling required");
if (productNamed.length > ceiling) {
  fail(`product-named configure ${productNamed.length} > ceiling ${ceiling}`);
}
if ((inv.metrics?.product_named ?? -1) !== productNamed.length) {
  fail(
    `metrics.product_named ${inv.metrics?.product_named} != live ${productNamed.length}`,
  );
}
if ((inv.metrics?.configure_files ?? -1) !== live.length) {
  fail(`metrics.configure_files ${inv.metrics?.configure_files} != ${live.length}`);
}

const BARE_HTTP_RE =
  /@app-tour\/workspace-(?:denali|urban|harbor)\/http(?!\/)/;
const HOST_PATH_RE =
  /@app-tour\/workspace-(?:denali|urban|harbor)\/host\//;
const BRANDED_RE = /@app-tour\/workspace-(?:denali|urban|harbor)(?:\/[^"'\s]+)?/;

let bareHits = 0;
let hostPathHits = 0;
for (const row of inv.adapters || []) {
  const abs = join(root, row.path);
  const text = readFileSync(abs, "utf8");
  if (BARE_HTTP_RE.test(text)) {
    bareHits += 1;
    fail(`${row.path} still imports bare workspace */http (use /host/http via generated façade)`);
  }
  if (HOST_PATH_RE.test(text)) {
    hostPathHits += 1;
    fail(
      `${row.path} still imports workspace */host/* directly (use workspace-product-http-host-bindings.generated.ts)`,
    );
  }
  if (row.class === "platform-neutral") {
    const branded = [...text.matchAll(new RegExp(BRANDED_RE, "g"))].map((m) => m[0]);
    // workspace-sdk is ok for types in some adapters; product packages must be zero
    const productBranded = branded.filter((s) => !s.includes("workspace-sdk"));
    if (productBranded.length > 0) {
      fail(`${row.path} platform-neutral but has branded imports: ${productBranded.join(", ")}`);
    }
    const allowedNeutral = new Set([
      "apps/api/src/http/configure-finance-http-host.ts",
      "apps/api/src/http/configure-product-http-hosts.ts",
    ]);
    if (!allowedNeutral.has(row.path)) {
      fail(`unexpected platform-neutral adapter: ${row.path}`);
    }
  }
}

if ((inv.metrics?.bare_http_imports_in_configure ?? -1) !== bareHits) {
  fail(
    `metrics.bare_http_imports_in_configure ${inv.metrics?.bare_http_imports_in_configure} != ${bareHits}`,
  );
}
if ((inv.metrics?.direct_host_path_imports_in_configure ?? -1) !== hostPathHits) {
  fail(
    `metrics.direct_host_path_imports_in_configure ${inv.metrics?.direct_host_path_imports_in_configure} != ${hostPathHits}`,
  );
}

if (!process.exitCode) {
  console.log("psr-4b-configure-smoke: PASS");
  console.log(
    `  configure_files=${live.length} product_named=${productNamed.length}/${ceiling} platform_neutral=${live.length - productNamed.length} bare_http=${bareHits} direct_host=${hostPathHits}`,
  );
}
