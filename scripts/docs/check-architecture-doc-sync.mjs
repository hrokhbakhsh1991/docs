#!/usr/bin/env node
/**
 * M7 — documentation architecture drift report (report-only).
 * @see docs/phase-19/platform-portal-member-profile.mdoc
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectArchitectureTruthFindings,
  writeArchitectureTruthDriftReport,
} from "../guards/lib/member-profile-architecture-truth.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const docFindings = collectArchitectureTruthFindings(REPO_ROOT, { docsOnly: true });
const reportPath = writeArchitectureTruthDriftReport(REPO_ROOT, docFindings);

console.log(`check-architecture-doc-sync — wrote ${path.relative(REPO_ROOT, reportPath)}`);
console.log(
  `  doc findings: ${docFindings.length} (high: ${docFindings.filter((f) => f.severity === "HIGH").length})`
);

for (const finding of docFindings) {
  const line = finding.line !== undefined ? `:${finding.line}` : "";
  console.log(`  - [${finding.severity}] ${finding.file}${line} — ${finding.message}`);
}
