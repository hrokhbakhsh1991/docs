#!/usr/bin/env node
/**
 * P4-D2 — cold-path product fan-in budget (static analysis + numeric report).
 * @see docs/dev/p4-d2-cold-path-fan-in-ci.mdoc
 *
 * Usage: node scripts/guards/guard-p4-cold-path-fan-in.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  analyzeProductFanIn,
  listColdPathRelativeFiles,
  MIN_DYNAMIC_PRODUCT_FILES,
} from "./lib/p4-cold-path-fan-in.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const {
  PRODUCT_WORKSPACE_PACKAGES,
  PRODUCT_WORKSPACE_IDS,
} = require("../codegen/workspace-registry/generated/manifest-boundary-allowlist.generated.cjs");

const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const REPORT_JSON = path.join(REPORTS_DIR, "p4-cold-path-fan-in.json");

/** @type {string[]} */
const violations = [];
/** @type {object[]} */
const surfaces = [];

const productTrunkN = PRODUCT_WORKSPACE_PACKAGES.length;
const minDynamicFiles = new Set(MIN_DYNAMIC_PRODUCT_FILES);

for (const rel of listColdPathRelativeFiles()) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    violations.push(`missing cold-path file: ${rel}`);
    continue;
  }
  const src = fs.readFileSync(abs, "utf8");
  const fanIn = analyzeProductFanIn(src, PRODUCT_WORKSPACE_PACKAGES);
  const staticCount = fanIn.staticProductImports.length;
  const dynamicCount = fanIn.dynamicProductImports.length;

  surfaces.push({
    path: rel,
    staticProductImports: staticCount,
    dynamicProductImports: dynamicCount,
    staticSpecifiers: fanIn.staticProductImports,
    dynamicSpecifiers: [...new Set(fanIn.dynamicProductImports)],
  });

  if (staticCount > 0) {
    violations.push(
      `${rel}: static product fan-in (${staticCount}) — ${fanIn.staticProductImports.join(", ")}`
    );
  }

  if (minDynamicFiles.has(rel) && dynamicCount < productTrunkN) {
    violations.push(
      `${rel}: expected ≥ ${productTrunkN} dynamic product imports (got ${dynamicCount})`
    );
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  productTrunkN,
  productWorkspaceIds: PRODUCT_WORKSPACE_IDS,
  productWorkspacePackages: PRODUCT_WORKSPACE_PACKAGES,
  budgets: {
    staticProductImportsMax: 0,
    minDynamicProductImportsOnLoaders: productTrunkN,
  },
  surfaces,
  ok: violations.length === 0,
  violations,
};

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (violations.length > 0) {
  console.error("guard-p4-cold-path-fan-in: FAIL");
  for (const v of violations) {
    console.error(` - ${v}`);
  }
  console.error(`report: ${path.relative(REPO_ROOT, REPORT_JSON)}`);
  process.exit(1);
}

const totalStatic = surfaces.reduce((n, s) => n + s.staticProductImports, 0);
const totalDynamic = surfaces.reduce((n, s) => n + s.dynamicProductImports, 0);
console.log(
  `guard-p4-cold-path-fan-in: PASS (surfaces=${surfaces.length} static=${totalStatic} dynamic=${totalDynamic} trunk=${productTrunkN})`
);
console.log(`report: ${path.relative(REPO_ROOT, REPORT_JSON)}`);
