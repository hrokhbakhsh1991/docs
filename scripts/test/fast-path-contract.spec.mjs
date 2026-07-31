import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const API_RESOLVER = join(ROOT, "scripts/lib/resolve-api-test-specs.mjs");
const WEB_RESOLVER = join(ROOT, "scripts/lib/resolve-web-test-specs.mjs");
const TEST_CHANGED = readFileSync(join(ROOT, "scripts/test-changed.sh"), "utf8");
const PRE_COMMIT = readFileSync(join(ROOT, "scripts/pre-commit-fast.sh"), "utf8");
const BENCHMARK = readFileSync(join(ROOT, "scripts/benchmark-pre-commit-fast.sh"), "utf8");

function resolveSpecs(resolver, paths) {
  const result = spawnSync(process.execPath, [resolver], {
    cwd: ROOT,
    input: `${paths.join("\n")}\n`,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("mapped API paths resolve targeted specs", () => {
  const result = resolveSpecs(API_RESOLVER, ["apps/api/src/tours/tours.service.ts"]);
  assert.equal(result.fallbackBaseline, false);
  assert.ok(result.specs.length > 0);
  assert.ok(result.specs.every((spec) => spec.startsWith("test/tours-")));
});

test("unknown API production paths select the bounded baseline", () => {
  assert.deepEqual(resolveSpecs(API_RESOLVER, ["apps/api/src/unknown/service.ts"]), {
    specs: [],
    fallbackBaseline: true,
  });
});

test("API docs and scripts do not select product tests", () => {
  assert.deepEqual(
    resolveSpecs(API_RESOLVER, ["apps/api/docs/note.md", "apps/api/scripts/tool.mjs"]),
    {
      specs: [],
      fallbackBaseline: false,
    }
  );
});

test("web resolver selects direct references and bounds unknown paths", () => {
  const mapped = resolveSpecs(WEB_RESOLVER, ["apps/web/src/auth/bff-login-rate-limit.ts"]);
  assert.equal(mapped.fallbackBaseline, false);
  assert.ok(mapped.specs.includes("test/bff-login-rate-limit.spec.ts"));

  assert.deepEqual(resolveSpecs(WEB_RESOLVER, ["apps/web/src/unknown/component.tsx"]), {
    specs: [],
    fallbackBaseline: true,
  });
});

test("web pre-commit uses targeted specs or the bounded baseline", () => {
  assert.match(TEST_CHANGED, /full web suite deferred to checkpoint\/CI/);
  assert.match(TEST_CHANGED, /resolve-web-test-specs\.mjs/);
  for (const spec of [
    "test/barrel-hunt.spec.ts",
    "test/dashboard-smoke.spec.ts",
    "test/phase-9.contract.spec.ts",
  ]) {
    assert.match(TEST_CHANGED, new RegExp(spec.replaceAll(".", "\\.")));
  }
});

test("pre-commit API fallback is bounded and defers the full suite", () => {
  assert.match(TEST_CHANGED, /full API suite deferred to checkpoint\/CI/);
  for (const spec of [
    "test/package-boundary.spec.ts",
    "test/resolve-workspace-type.spec.ts",
    "test/tours-operator.spec.ts",
  ]) {
    assert.match(TEST_CHANGED, new RegExp(spec.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(TEST_CHANGED, /@apps\/api test \(spec map fallback\)/);
});

test("cache keys use content and support files instead of HEAD identity", () => {
  assert.ok(TEST_CHANGED.includes('git show ":$path"'));
  assert.match(TEST_CHANGED, /hash_file_if_present "pnpm-lock\.yaml"/);
  assert.match(TEST_CHANGED, /hash_file_if_present "scripts\/test-changed\.sh"/);
  assert.doesNotMatch(TEST_CHANGED, /git rev-parse HEAD 2>\/dev\/null \|\| true/);
});

test("fast path reports timing without enforcing the budget as correctness", () => {
  assert.match(PRE_COMMIT, /FAST_PATH_BUDGET_SECONDS="\$\{[^}]+:-60\}"/);
  assert.match(PRE_COMMIT, /PRE_COMMIT_FAST_REPORT_DIR/);
  assert.match(PRE_COMMIT, /\.cache\/pre-commit-fast\/latest\.tsv/);
  assert.match(PRE_COMMIT, /WARN budget exceeded/);
  assert.doesNotMatch(PRE_COMMIT, /^  'packages\/workspaces\/'$/m);
  assert.match(PRE_COMMIT, /packages\/workspaces\/\[\^\/\]\+/);
});

test("benchmark requires three isolated cold/warm runs before activation", () => {
  assert.match(BENCHMARK, /for run in 1 2 3/);
  assert.match(BENCHMARK, /mktemp -d/);
  assert.match(BENCHMARK, /TEST_CHANGED_CACHE_DIR/);
  assert.match(BENCHMARK, /docs\) BUDGET_SECONDS=10/);
  assert.match(BENCHMARK, /ui\) BUDGET_SECONDS=30/);
  assert.match(BENCHMARK, /package-api\) BUDGET_SECONDS=60/);
  assert.match(BENCHMARK, /PASS \(3\/3\)/);
});
