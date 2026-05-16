#!/usr/bin/env node
/**
 * Phase 9 — capability registry audit (prompt.md).
 *
 * - Every registered capability has documented CASL or query-layer wiring
 * - Product aliases resolve to registered implementation capabilities
 * - No duplicate / orphan alias targets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readRepo(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) {
    fail(`missing file: ${relPath}`);
    return "";
  }
  return fs.readFileSync(abs, "utf8");
}

/** Capabilities enforced outside CASL `apply*FromSet` (query / route policy only). */
const QUERY_OR_POLICY_ONLY_CAPABILITIES = new Set(["tour.regional.manage"]);

function extractConstStringArray(source, constName) {
  const re = new RegExp(
    `export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`,
    "m",
  );
  const match = source.match(re);
  if (!match) {
    return [];
  }
  const values = [];
  const inner = match[1];
  const capRe = /"([a-zA-Z][a-zA-Z0-9_.]+)"/g;
  let capMatch;
  while ((capMatch = capRe.exec(inner)) !== null) {
    values.push(capMatch[1]);
  }
  return values;
}

function extractWorkspaceCapabilityValues(registrySource) {
  const start = registrySource.indexOf("WORKSPACE_CAPABILITY_VALUES");
  if (start < 0) {
    return [];
  }
  const slice = registrySource.slice(start, start + 2000);
  const values = [];
  const re = /"([^"]+)"/g;
  let match;
  while ((match = re.exec(slice)) !== null) {
    if (match[1].includes(".")) {
      values.push(match[1]);
    }
  }
  return [...new Set(values)];
}

function extractCaslCapabilityChecks(abilityFactorySource) {
  const checks = new Set();
  const re = /caps\.has\("([^"]+)"\)/g;
  let match;
  while ((match = re.exec(abilityFactorySource)) !== null) {
    checks.add(match[1]);
  }
  return checks;
}

function extractProductAliases(registrySource) {
  const start = registrySource.indexOf("PRODUCT_CAPABILITY_ALIASES");
  if (start < 0) {
    return new Map();
  }
  const slice = registrySource.slice(start, start + 2000);
  const aliases = new Map();
  const re = /"([^"]+)":\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(slice)) !== null) {
    aliases.set(match[1], match[2]);
  }
  return aliases;
}

function extractMarketingLabelAliases(registrySource) {
  const start = registrySource.indexOf("MARKETING_LABEL_CAPABILITY_ALIASES");
  if (start < 0) {
    return new Map();
  }
  const slice = registrySource.slice(start, start + 1500);
  const aliases = new Map();
  const re = /(\w+):\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(slice)) !== null) {
    aliases.set(match[1], match[2]);
  }
  return aliases;
}

const capabilitiesSrc = readRepo("packages/shared/rbac/capabilities.ts");
const registrySrc = readRepo("packages/shared/rbac/capability-registry.ts");
const abilitySrc = readRepo("packages/shared/rbac/ability.factory.ts");

const registered = new Set(extractWorkspaceCapabilityValues(registrySrc));
const caslWired = extractCaslCapabilityChecks(abilitySrc);
const productAliases = extractProductAliases(registrySrc);
const marketingAliases = extractMarketingLabelAliases(registrySrc);

for (const cap of registered) {
  if (QUERY_OR_POLICY_ONLY_CAPABILITIES.has(cap)) {
    continue;
  }
  if (!caslWired.has(cap)) {
    fail(`[casl-wiring] registered capability "${cap}" has no caps.has() grant in ability.factory.ts`);
  }
}

for (const [alias, target] of productAliases) {
  if (!registered.has(target)) {
    fail(`[alias] PRODUCT_CAPABILITY_ALIASES.${alias} → "${target}" is not in WORKSPACE_CAPABILITY_VALUES`);
  }
}

for (const [, target] of marketingAliases) {
  if (!registered.has(target)) {
    fail(`[alias] MARKETING_LABEL alias target "${target}" is not registered`);
  }
}

const tourCaps = new Set(extractConstStringArray(capabilitiesSrc, "TOUR_CAPABILITIES"));
const settingsCaps = new Set(extractConstStringArray(capabilitiesSrc, "SETTINGS_CAPABILITIES"));
const moduleCaps = new Set(extractConstStringArray(capabilitiesSrc, "MODULE_CAPABILITIES"));
const marketingCaps = new Set(extractConstStringArray(capabilitiesSrc, "MARKETING_CAPABILITIES"));

for (const cap of registered) {
  const inFamily =
    tourCaps.has(cap) ||
    settingsCaps.has(cap) ||
    moduleCaps.has(cap) ||
    marketingCaps.has(cap);
  if (!inFamily) {
    fail(`[registry] "${cap}" in WORKSPACE_CAPABILITY_VALUES but missing from TOUR/SETTINGS/MODULE/MARKETING const arrays`);
  }
}

for (const cap of tourCaps) {
  if (!registered.has(cap)) {
    warn(`[registry] TOUR_CAPABILITIES includes "${cap}" but not WORKSPACE_CAPABILITY_VALUES`);
  }
}

const policySrc = readRepo("apps/api/src/modules/tours/utils/tour-patch-field-policy.ts");
const policyCaps = new Set();
const capRe = /requiredCapability:\s*"([^"]+)"/g;
let policyMatch;
while ((policyMatch = capRe.exec(policySrc)) !== null) {
  policyCaps.add(policyMatch[1]);
}

for (const cap of policyCaps) {
  if (!registered.has(cap)) {
    fail(`[patch-policy] requiredCapability "${cap}" is not a registered workspace capability`);
  }
}

if (failures.length > 0) {
  console.error("[audit-capability-registry] FAILED:\n");
  for (const line of failures) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log("[audit-capability-registry] OK");
if (warnings.length > 0) {
  console.warn("[audit-capability-registry] warnings:");
  for (const line of warnings) {
    console.warn(`  - ${line}`);
  }
}
