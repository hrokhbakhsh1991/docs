#!/usr/bin/env node
/**
 * Phase 5 — documentation ↔ enterprise multi-tenant repo alignment checks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

/**
 * @param {string} rel
 * @returns {string}
 */
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluatePhase5RepoAlignment() {
  const failures = [];

  const main = read("apps/api/src/main.ts");
  if (!/createTourStorageRepository/.test(main)) {
    failures.push("main.ts must use createTourStorageRepository()");
  }
  if (/new InMemoryTourRepository/.test(main)) {
    failures.push("main.ts must not construct InMemoryTourRepository directly");
  }

  const factory = read("apps/api/src/storage/create-tour-storage.ts");
  if (!/STORAGE_DRIVER/.test(factory)) {
    failures.push("create-tour-storage.ts must document STORAGE_DRIVER");
  }
  if (!/production.*prisma/s.test(factory.replace(/\s/g, ""))) {
    failures.push("create-tour-storage must default production to prisma");
  }

  const schema = read("apps/api/prisma/schema.prisma");
  if (!/@map\("canonical_data"\)/.test(schema)) {
    failures.push("Prisma Tour.canonical must map to canonical_data");
  }
  if (!/@map\("workspace_type"\)/.test(schema)) {
    failures.push("Prisma Tenant.workspaceType must map to workspace_type");
  }
  if (!/model OutboxEvent/.test(schema) || !/model AuditEvent/.test(schema)) {
    failures.push("Prisma must define OutboxEvent and AuditEvent");
  }

  const blockers = read("docs/phase-5/appendices/blockers.md");
  if (/main\.ts InMemoryTourRepository default/.test(blockers)) {
    failures.push("blockers.md still claims main.ts InMemory default — update BLOCKER-P5-007");
  }

  const entry = read("docs/phase-5/subphases/5.0-entry-gate.md");
  if (/TOUR_STORAGE/.test(entry)) {
    failures.push("5.0-entry-gate still references TOUR_STORAGE — use STORAGE_DRIVER");
  }

  const entryYaml = read("reports/phase-5-entry-verified.yaml");
  if (/phase_4_gate:\s*\n\s+command:[\s\S]*?status:\s*PASS/.test(entryYaml)) {
    if (!/verified_at:/.test(entryYaml) || /verified_at:\s*null/.test(entryYaml)) {
      failures.push("entry yaml phase_4_gate PASS requires verified_at");
    }
  }

  const alignment = read("docs/phase-5/appendices/REPO-PROJECT-ALIGNMENT.md");
  if (!/create-tour-storage/.test(alignment)) {
    failures.push("REPO-PROJECT-ALIGNMENT.md missing storage factory truth");
  }

  const map = read("docs/phase-5/appendices/IMPLEMENTATION-MAP.md");
  if (/\| \*\*5\.1\*\* \| VERIFIED \| scaffold \|/.test(map)) {
    failures.push("IMPLEMENTATION-MAP 5.1 must use VERIFIED_SCAFFOLD not bare VERIFIED");
  }

  if (!fs.existsSync(path.join(REPO_ROOT, "infra/sql/002_phase5_data_layer.sql"))) {
    failures.push("missing infra/sql/002_phase5_data_layer.sql");
  }

  if (!fs.existsSync(path.join(REPO_ROOT, "packages/tenant-kernel/package.json"))) {
    failures.push("missing packages/tenant-kernel");
  }

  const pkg = read("apps/api/package.json");
  if (!/"@app-tour\/tenant-kernel"/.test(pkg)) {
    failures.push("apps/api must depend on @app-tour/tenant-kernel");
  }

  const commandCatalog = read("docs/phase-5/appendices/command-catalog.md");
  if (/TOUR_STORAGE/.test(commandCatalog)) {
    failures.push("command-catalog must use STORAGE_DRIVER not TOUR_STORAGE");
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluatePhase5RepoAlignment();
  if (!r.ok) {
    console.error(`phase-5-repo-alignment: FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log("phase-5-repo-alignment: PASS");
}
