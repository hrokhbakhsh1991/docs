#!/usr/bin/env node
/**
 * Workspace isolation — apps/api must not import workspace host internals directly.
 * @see docs/dev/denali-plugin-encapsulation.mdoc
 */
import fs from "node:fs";
import { HOST_IMPORT_LEGACY_ALLOWLIST } from "./lib/api-host-import-allowlist.mjs";
import {
  API_SRC_ROOT,
  extractImportSpecifiers,
  relFromApiSrc,
  relFromRepo,
  walkApiSrcFiles,
} from "./lib/walk-api-src.mjs";

const HOST_SETTINGS_IMPORT_RE = /@app-tour\/workspace-[a-z0-9-]+\/host\/settings\//;
const HOST_IMPORT_RE = /@app-tour\/workspace-[a-z0-9-]+\/host\//;

/** @type {string[]} */
const violations = [];

for (const file of walkApiSrcFiles({ excludeGenerated: false })) {
  const relApi = relFromApiSrc(file);
  const isGenerated = file.endsWith(".generated.ts");
  const source = fs.readFileSync(file, "utf8");

  for (const spec of extractImportSpecifiers(source)) {
    if (HOST_SETTINGS_IMPORT_RE.test(spec)) {
      violations.push(`${relFromRepo(file)} — host/settings import forbidden: ${spec}`);
      continue;
    }
    if (isGenerated || HOST_IMPORT_LEGACY_ALLOWLIST.has(relApi)) {
      continue;
    }
    if (HOST_IMPORT_RE.test(spec)) {
      violations.push(
        `${relFromRepo(file)} — direct workspace host import (use generated bindings or shrink allowlist): ${spec}`
      );
    }
  }
}

if (violations.length > 0) {
  console.error("guard-api-workspace-isolation: FAIL");
  console.error(`  scope: ${API_SRC_ROOT}/**`);
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  "guard-api-workspace-isolation: PASS (apps/api workspace isolation — settings contract + host import ratchet)"
);
