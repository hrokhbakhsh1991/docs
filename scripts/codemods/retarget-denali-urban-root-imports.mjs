#!/usr/bin/env node
/**
 * Phase 6 P2 follow-up — retarget @app-tour/workspace-denali|urban root imports to /host/* or /plugin.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {readonly string[]} */
const SCAN_ROOTS = ["apps", "packages", "scripts"];

/** @type {Array<{ from: RegExp; to: string }>} */
const REPLACEMENTS = [
  {
    from: /from "@app-tour\/workspace-denali";/g,
    to: 'from "@app-tour/workspace-denali/NEEDS_MANUAL";',
  },
];

/** Symbol → subpath (denali). Order: longest/specific imports handled per-file via rules below. */
const DENALI_SYMBOL_TARGETS = {
  bookingWalletId: "@app-tour/workspace-denali/host/finance",
  emitFinanceLedgerDoubleEntryAppliedOutbox: "@app-tour/workspace-denali/host/finance",
  LEDGER_ACCOUNTS: "@app-tour/workspace-denali/host/finance",
  postDoubleEntryJournal: "@app-tour/workspace-denali/host/finance",
  assertDenaliFinanceWorkspace: "@app-tour/workspace-denali/host/finance",
  createDenaliFinanceOutboxConsumer: "@app-tour/workspace-denali/host/finance",
  FinanceOutboxConsumerResult: "@app-tour/workspace-denali/host/finance",
  DenaliOutboxDomainEvent: "@app-tour/workspace-denali/host/finance",
  OutboxReader: "@app-tour/workspace-denali/host/finance",
  OutboxWriter: "@app-tour/workspace-denali/host/finance",
  TourCreatedLedgerPayload: "@app-tour/workspace-denali/host/finance",
  DENALI_SMOKE_TENANT_ID: "@app-tour/workspace-denali/host/smoke/phase-6-denali-smoke-tenant",
  isDenaliOperatorTourPhotoReadKeyAllowed: "@app-tour/workspace-denali/host/photos",
  isDenaliWizardDraftPhotoReadKeyAllowed: "@app-tour/workspace-denali/host/photos",
  executeDenaliTourPhotoRemintPlan: "@app-tour/workspace-denali/host/photos",
  readMinioPhotoConfigFromEnv: "@app-tour/workspace-denali/host/photos",
  remintDenaliClonePhotosInCanonical: "@app-tour/workspace-denali/host/photos",
  assertDenaliFrozenWizardTemplateFieldsPresent: "@app-tour/workspace-denali/host/wizard/template-invariants",
  DenaliWizardTemplateFrozenFieldMissingError:
    "@app-tour/workspace-denali/host/wizard/template-invariants",
  normalizeDenaliWizardTemplatePayloadSteps: "@app-tour/workspace-denali/host/wizard/template-invariants",
  DENALI_CURRENT_CANONICAL_SCHEMA_VERSION: "@app-tour/workspace-denali/host/acl",
  DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION: "@app-tour/workspace-denali/host/acl",
  LEGACY_TRIP_DETAILS_SOT_ROOT: "@app-tour/workspace-denali/host/acl",
  wrapLegacyTripDetailsForMigration: "@app-tour/workspace-denali/host/acl",
  denaliPrepareDraftEnvelope: "@app-tour/workspace-denali/host/draft",
  denaliPluginForWizardEngine: "@app-tour/workspace-denali/host/plugin-for-wizard-engine",
  DENALI_LIFECYCLE: "@app-tour/workspace-denali/host/denali-plugin-build",
  buildDenaliFullWizardTemplatePayload: "@app-tour/workspace-denali/settings/denaliFullWizardTemplate",
  buildDenaliTenantWizardTemplatePayload:
    "@app-tour/workspace-denali/settings/denaliFullWizardTemplate",
  buildDenaliFullWizardTemplateSteps: "@app-tour/workspace-denali/settings/denaliFullWizardTemplate",
  appendDenaliCloneTitleSuffix: "@app-tour/workspace-denali/host/clone/hydration",
  projectDenaliWizardFormToCanonicalIngressData: "@app-tour/workspace-denali/host/acl",
  assertDenaliTourPhotoKeyTenantScope: "@app-tour/workspace-denali/host/photos",
  buildDenaliTourPhotoObjectKey: "@app-tour/workspace-denali/host/photos",
  buildDenaliWizardDraftPhotoObjectKey: "@app-tour/workspace-denali/host/photos",
  getDenaliTourPhotoSignedReadUrl: "@app-tour/workspace-denali/host/photos",
  ensureMinioPhotoBucket: "@app-tour/workspace-denali/host/photos",
  pingMinioPhotoStorage: "@app-tour/workspace-denali/host/photos",
  putDenaliTourPhoto: "@app-tour/workspace-denali/host/photos",
  getDenaliWorkspacePlugin: "@app-tour/workspace-denali/plugin",
  createDenaliWorkspacePlugin: "@app-tour/workspace-denali/plugin",
  DENALI_WORKSPACE_PLUGIN_ID: "@app-tour/workspace-denali/plugin",
  DENALI_WORKSPACE_TYPE: "@app-tour/workspace-denali/plugin",
  DENALI_THEME_TOKENS_STYLESHEET: "@app-tour/workspace-denali/plugin",
  DENALI_THEME_ADMIN_STYLESHEET: "@app-tour/workspace-denali/plugin",
};

const URBAN_SYMBOL_TARGETS = {
  validateUrbanRegistrationPayload: "@app-tour/workspace-urban/host/http",
  UrbanRegistrationPayload: "@app-tour/workspace-urban/host/http",
  URBAN_SMOKE_TENANT_ID: "@app-tour/workspace-urban/host/smoke/phase-7-urban-smoke-tenant",
  URBAN_SMOKE_SUBDOMAIN: "@app-tour/workspace-urban/host/smoke/phase-7-urban-smoke-tenant",
  getUrbanWorkspacePlugin: "@app-tour/workspace-urban/plugin",
  createUrbanWorkspacePlugin: "@app-tour/workspace-urban/plugin",
  URBAN_WORKSPACE_PLUGIN_ID: "@app-tour/workspace-urban/plugin",
  URBAN_WORKSPACE_TYPE: "@app-tour/workspace-urban/plugin",
  URBAN_THEME_TOKENS_STYLESHEET: "@app-tour/workspace-urban/plugin",
  buildUrbanMinimalWizardTemplatePayload: "@app-tour/workspace-urban/settings/urbanMinimalWizardTemplate",
};

/**
 * @param {string} dir
 * @param {string[]} acc
 */
function collectSourceFiles(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".next") continue;
    if (ent.isDirectory()) {
      collectSourceFiles(abs, acc);
    } else if (/\.(ts|tsx|mjs)$/.test(ent.name)) {
      acc.push(abs);
    }
  }
}

/**
 * @param {string} source
 * @param {Record<string, string>} symbolMap
 * @returns {string | null}
 */
function retargetImportBlock(source, symbolMap) {
  const importRe =
    /import\s+(type\s+)?\{([^}]+)\}\s+from\s+"@app-tour\/workspace-(denali|urban)";/g;
  let changed = false;
  const next = source.replace(importRe, (full, typeKw, specifiers, workspace) => {
    const map = workspace === "denali" ? DENALI_SYMBOL_TARGETS : URBAN_SYMBOL_TARGETS;
    /** @type {Map<string, { value: Set<string>; typeOnly: Set<string> }>} */
    const byTarget = new Map();

    for (const rawPart of specifiers.split(",")) {
      const part = rawPart.trim();
      if (!part) continue;
      const isTypeOnly = Boolean(typeKw) || part.startsWith("type ");
      const cleaned = part.replace(/^type\s+/, "").trim();
      const aliasMatch = cleaned.match(/^(\w+)\s+as\s+(\w+)$/);
      const name = aliasMatch ? aliasMatch[1] : cleaned;
      const exportName = aliasMatch ? aliasMatch[2] : cleaned;
      const target = map[name];
      if (!target) {
        console.error(`Unknown ${workspace} root symbol: ${name} in ${full}`);
        process.exitCode = 1;
        return full;
      }
      if (!byTarget.has(target)) {
        byTarget.set(target, { value: new Set(), typeOnly: new Set() });
      }
      const bucket = byTarget.get(target);
      const rendered = aliasMatch ? `${name} as ${exportName}` : exportName;
      if (isTypeOnly) {
        bucket.typeOnly.add(rendered);
      } else {
        bucket.value.add(rendered);
      }
    }

    const lines = [];
    for (const [target, { value, typeOnly }] of byTarget.entries()) {
      if (value.size > 0) {
        lines.push(`import { ${[...value].join(", ")} } from "${target}";`);
      }
      if (typeOnly.size > 0) {
        lines.push(`import type { ${[...typeOnly].join(", ")} } from "${target}";`);
      }
    }
    changed = true;
    return lines.join("\n");
  });
  return changed ? next : null;
}

/** @type {string[]} */
const files = [];
for (const root of SCAN_ROOTS) {
  collectSourceFiles(path.join(REPO_ROOT, root), files);
}

let updated = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes('@app-tour/workspace-denali"') && !source.includes('@app-tour/workspace-urban"')) {
    continue;
  }
  let next = source;
  const denali = retargetImportBlock(next, DENALI_SYMBOL_TARGETS);
  if (denali) next = denali;
  const urban = retargetImportBlock(next, URBAN_SYMBOL_TARGETS);
  if (urban) next = urban;
  if (next !== source) {
    fs.writeFileSync(file, next);
    updated += 1;
    console.log(`retarget: ${path.relative(REPO_ROOT, file)}`);
  }
}

console.log(`retarget-denali-urban-root-imports: ${updated} files updated`);
