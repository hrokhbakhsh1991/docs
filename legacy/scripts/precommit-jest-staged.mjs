#!/usr/bin/env node
/**
 * Pre-commit unit tests for staged sources.
 *
 * 1. pnpm exec jest --config jest.config.precommit.cjs --findRelatedTests --bail --passWithNoTests
 * 2. Colocated node:test specs (*.spec.ts/tsx) — most monorepo unit tests use node:test, not Jest.
 *
 * Invoked by lint-staged; staged file paths are passed as argv.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { precommitCentralizedNodeTests } from "./test-owners-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const STAGED = process.argv.slice(2).filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));

function run(cmd, args, cwd = REPO_ROOT) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isExcludedFromPrecommitNodeTest(relPosix) {
  return (
    /\/tests\/(smoke|audit|e2e)\//.test(relPosix) ||
    /\/__tests__\/(smoke|integration)\//.test(relPosix)
  );
}

function colocatedSpecPaths(sourcePath) {
  const abs = path.isAbsolute(sourcePath) ? sourcePath : path.join(REPO_ROOT, sourcePath);
  if (!fs.existsSync(abs)) return [];

  const dir = path.dirname(abs);
  const ext = path.extname(abs);
  const base = path.basename(abs, ext);
  const candidates = [
    path.join(dir, `${base}.spec.ts`),
    path.join(dir, `${base}.spec.tsx`),
    path.join(dir, `${base}.test.ts`),
    path.join(dir, `${base}.test.tsx`),
    path.join(dir, "__tests__", `${base}.spec.ts`),
    path.join(dir, "__tests__", `${base}.spec.tsx`),
    path.join(dir, "__tests__", `${base}.integration.test.tsx`),
    path.join(dir, "__tests__", `${base}.integration.test.ts`),
  ];

  return [...new Set(candidates.filter((p) => fs.existsSync(p)))];
}

function nodeTestSpecsForStaged(files) {
  const specs = new Set();
  for (const file of files) {
    const rel = (path.isAbsolute(file) ? path.relative(REPO_ROOT, file) : file).replace(/\\/g, "/");
    if (isExcludedFromPrecommitNodeTest(rel)) continue;

    if (/\.(spec|test)\.(ts|tsx)$/.test(file)) {
      const abs = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
      if (fs.existsSync(abs)) specs.add(abs);
      continue;
    }
    for (const spec of colocatedSpecPaths(file)) {
      const specRel = path.relative(REPO_ROOT, spec).replace(/\\/g, "/");
      if (isExcludedFromPrecommitNodeTest(specRel)) continue;
      specs.add(spec);
    }
  }
  return [...specs].filter((p) => {
    if (p.includes(".integration.test.") || p.includes(".integration.spec.")) {
      return false;
    }
    try {
      const src = fs.readFileSync(p, "utf8");
      if (/\bfrom\s+["']vitest["']/.test(src)) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  });
}

if (STAGED.length === 0) {
  process.exit(0);
}

const relativeStaged = STAGED.map((f) =>
  path.isAbsolute(f) ? path.relative(REPO_ROOT, f) : f,
);

run("pnpm", [
  "exec",
  "jest",
  "--config",
  "jest.config.precommit.cjs",
  "--findRelatedTests",
  "--bail",
  "--passWithNoTests",
  ...relativeStaged,
]);

const CSS_STUB_REGISTER = path.join(REPO_ROOT, "packages/ui/scripts/tsx-ignore-css.mjs");

function groupNodeSpecsByCwd(specPaths) {
  const groups = new Map();
  for (const spec of specPaths) {
    const abs = path.isAbsolute(spec) ? spec : path.join(REPO_ROOT, spec);
    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
    let cwd = REPO_ROOT;
    let testArg = rel;
    if (rel.startsWith("apps/web/")) {
      cwd = path.join(REPO_ROOT, "apps", "web");
      testArg = rel.slice("apps/web/".length);
    } else if (rel.startsWith("apps/api/")) {
      cwd = path.join(REPO_ROOT, "apps", "api");
      testArg = rel.slice("apps/api/".length);
    } else if (rel.startsWith("packages/")) {
      cwd = path.join(REPO_ROOT, "apps", "api");
      testArg = path.join("..", "..", rel);
    }
    if (!groups.has(cwd)) groups.set(cwd, []);
    groups.get(cwd).push(testArg);
  }
  return groups;
}

const nodeSpecs = nodeTestSpecsForStaged(relativeStaged);
const nodeSpecRel = new Set(
  nodeSpecs.map((p) => path.relative(REPO_ROOT, p).replace(/\\/g, "/")),
);
for (const rel of precommitCentralizedNodeTests(REPO_ROOT, relativeStaged)) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs) || nodeSpecRel.has(rel)) continue;
  nodeSpecRel.add(rel);
  nodeSpecs.push(abs);
}
if (nodeSpecs.length > 0) {
  for (const [cwd, testPaths] of groupNodeSpecsByCwd(nodeSpecs)) {
    const isWeb = cwd.includes(`${path.sep}apps${path.sep}web`);
    const importFlags = ["--import", "tsx"];
    if (isWeb) {
      importFlags.unshift("--import", path.relative(cwd, CSS_STUB_REGISTER));
    }
    run(
      "pnpm",
      ["exec", "node", ...importFlags, "--test", "--test-reporter", "spec", ...testPaths],
      cwd,
    );
  }
}

process.exit(0);
