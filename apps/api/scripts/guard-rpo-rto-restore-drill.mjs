#!/usr/bin/env node
/**
 * DEC-125 — RPO/RTO appendix + restore drill script + monthly workflow.
 * @see docs/phase-5/appendices/rpo-rto-production.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

const docPath = "docs/phase-5/appendices/rpo-rto-production.md";
const scriptPath = "scripts/restore-drill-smoke.sh";
const workflowPath = ".github/workflows/restore-drill-monthly.yml";
const checklistPath = "docs/phase-4/production-deploy-checklist.md";

for (const rel of [docPath, scriptPath, workflowPath]) {
  if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

if (fs.existsSync(path.join(REPO_ROOT, workflowPath))) {
  const workflow = read(workflowPath);
  if (!workflow.includes("restore-drill-smoke.sh")) {
    violations.push(`${workflowPath} must run restore-drill-smoke.sh`);
  }
  if (!workflow.includes("schedule:")) {
    violations.push(`${workflowPath} must define monthly schedule`);
  }
  if (!workflow.includes("workflow_dispatch")) {
    violations.push(`${workflowPath} must support workflow_dispatch`);
  }
}

if (fs.existsSync(path.join(REPO_ROOT, scriptPath))) {
  const script = read(scriptPath);
  if (!script.includes("pg_dump")) {
    violations.push(`${scriptPath} must use pg_dump`);
  }
  if (!script.includes("_prisma_migrations")) {
    violations.push(`${scriptPath} must verify _prisma_migrations`);
  }
}

if (fs.existsSync(path.join(REPO_ROOT, checklistPath))) {
  const checklist = read(checklistPath);
  if (!checklist.includes("RPO") || !checklist.includes("RTO")) {
    violations.push(`${checklistPath} must document RPO/RTO (DEC-125)`);
  }
  if (!checklist.includes("rpo-rto-production.md")) {
    violations.push(`${checklistPath} must link rpo-rto-production.md`);
  }
}

const rpoDoc = fs.existsSync(path.join(REPO_ROOT, docPath)) ? read(docPath) : "";
if (rpoDoc.length > 0) {
  if (!rpoDoc.includes("15")) {
    violations.push(`${docPath} must state RPO target`);
  }
  if (!rpoDoc.includes("60")) {
    violations.push(`${docPath} must state RTO target`);
  }
}

if (violations.length > 0) {
  console.error("guard-rpo-rto-restore-drill: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-rpo-rto-restore-drill: PASS");
