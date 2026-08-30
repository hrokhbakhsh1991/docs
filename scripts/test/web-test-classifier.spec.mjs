import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyWebTestSpec,
  isNodeUnitSpec,
  isPlaywrightRuntimeSpec,
  SpecKind,
} from "../lib/classify-web-test-spec.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const WEB_ROOT = join(ROOT, "apps/web");
const RUNTIME_SWEEP_CONFIG = readFileSync(
  join(WEB_ROOT, "playwright.runtime-sweep.config.ts"),
  "utf8"
);

const RUNTIME_SPECS = [
  "test/bookings-avatar-row-identity.spec.ts",
  "test/bookings-directory-controls-responsive.spec.ts",
  "test/operator-ux-runtime-sweep.spec.ts",
  "test/settings-responsive.spec.ts",
  "test/users-directory-controls-responsive.spec.ts",
  "test/users-loyalty-detail-responsive.spec.ts",
];

test("classifier marks Playwright runtime sweep specs", () => {
  for (const spec of RUNTIME_SPECS) {
    assert.equal(classifyWebTestSpec(spec), SpecKind.PLAYWRIGHT_RUNTIME, spec);
    assert.ok(isPlaywrightRuntimeSpec(spec), spec);
    assert.ok(!isNodeUnitSpec(spec), spec);
    assert.match(RUNTIME_SWEEP_CONFIG, new RegExp(spec.replace("test/", "").replace(".", "\\.")));
  }
});

test("classifier keeps ordinary node specs as NODE_UNIT", () => {
  assert.equal(classifyWebTestSpec("test/dashboard-smoke.spec.ts"), SpecKind.NODE_UNIT);
  assert.equal(classifyWebTestSpec("test/resolve-operator-admin-root-redirect.spec.ts"), SpecKind.NODE_UNIT);
});

test("list-node-unit-specs excludes Playwright runtime specs", () => {
  const result = spawnSync(process.execPath, [join(WEB_ROOT, "scripts/list-node-unit-specs.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const listed = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((abs) => abs.replace(`${WEB_ROOT}/`, ""));
  for (const spec of RUNTIME_SPECS) {
    assert.ok(!listed.includes(spec), `listed playwright runtime spec: ${spec}`);
  }
  assert.ok(listed.includes("test/dashboard-smoke.spec.ts"));
});

test("test:file rejects Playwright runtime specs with a clear error", () => {
  const result = spawnSync("pnpm", ["--filter", "@apps/web", "run", "test:file", "test/settings-responsive.spec.ts"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Playwright-owned specs cannot run under node:test/);
  assert.match(result.stderr + result.stdout, /settings-responsive\.spec\.ts/);
});

test("test:file still runs a normal node unit spec", () => {
  const result = spawnSync(
    "pnpm",
    ["--filter", "@apps/web", "run", "test:file", "test/resolve-operator-admin-root-redirect.spec.ts"],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } }
  );
  assert.equal(result.status, 0, result.stderr + result.stdout);
});
