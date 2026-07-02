#!/usr/bin/env node
/**
 * M7/M8 — architecture truth guard (code + docs + contract + semantic alignment).
 * @see docs/phase-19/platform-portal-member-profile.mdoc
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectArchitectureTruthFindings,
  hasBlockingArchitectureTruthDrift,
  writeArchitectureTruthDriftReport,
} from "./lib/member-profile-architecture-truth.mjs";
import { collectSemanticDriftFindings } from "./lib/member-profile-semantic-drift.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const findings = [
  ...collectArchitectureTruthFindings(REPO_ROOT),
  ...collectSemanticDriftFindings(REPO_ROOT),
];
const reportPath = writeArchitectureTruthDriftReport(REPO_ROOT, findings);

if (hasBlockingArchitectureTruthDrift(findings)) {
  console.error("\narchitecture-truth-guard — FAIL");
  console.error(`  report: ${path.relative(REPO_ROOT, reportPath)}`);
  for (const finding of findings.filter((f) => f.severity === "HIGH")) {
    const line = finding.line !== undefined ? `:${finding.line}` : "";
    console.error(`  ✗ [HIGH] ${finding.file}${line} — ${finding.message}`);
  }
  process.exit(1);
}

const medium = findings.filter((f) => f.severity === "MEDIUM").length;
const low = findings.filter((f) => f.severity === "LOW").length;
console.log(
  `architecture-truth-guard — PASS (${findings.length} findings: ${medium} medium, ${low} low)`
);
console.log(`  report: ${path.relative(REPO_ROOT, reportPath)}`);
