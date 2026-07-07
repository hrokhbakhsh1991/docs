#!/usr/bin/env node
/**
 * AP15 — repository findMany must bound list reads (select alone is insufficient).
 *
 * Scans apps/api/src repository files (excludes platform admin repos and in-memory drivers).
 * Each tenant-scoped findMany must include `take:` OR bounded `where` with `in:` on a
 * documented caller cap.
 *
 * @see docs/dev/list-projection-guards.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API_SRC = path.join(REPO_ROOT, "apps/api/src");

/** Prisma delegates scanned — aligned with guard-repository-rls tenant models + P1 tables. */
const TENANT_DELEGATES = [
  "operatorRegistration",
  "operatorPendingInvite",
  "operatorSettingsAuditEvent",
  "operatorUserRoleAudit",
  "tour",
  "userTenant",
  "outboxEvent",
  "payment",
  "paymentReceipt",
  "exposureProfile",
  "exposureIntent",
  "integrationConnection",
  "integrationEventPolicy",
  "integrationDeliveryJob",
  "workspaceDraftEvent",
  "workspaceDraftSnapshot",
  "workspaceTourTheme",
  "workspaceGuideLanguage",
  "workspaceEquipment",
  "workspaceTourPreset",
  "workspaceRegion",
  "workspaceDestination",
  "denaliExposureReminderActivation",
  "user",
];

const FIND_MANY_PATTERNS = TENANT_DELEGATES.map((delegate) => `${delegate}.findMany`);

/** Repo-relative paths (from apps/api/src) deferred to platform batch jobs. */
const LEGACY_FILE_ALLOWLIST = new Set([]);

/** Skip entire platform admin registry repos (cross-tenant batch scans). */
const SKIP_DIR_NAMES = new Set(["platform"]);

function walkRepositoryFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || SKIP_DIR_NAMES.has(ent.name)) {
        continue;
      }
      walkRepositoryFiles(full, out);
    } else if (ent.name.endsWith(".repository.ts") && !ent.name.startsWith("in-memory-")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} source
 * @param {number} index
 */
function enclosingFunctionName(source, index) {
  const head = source.slice(0, index);
  const matches = head.match(/\basync\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g);
  if (matches === null || matches.length === 0) {
    return null;
  }
  const last = matches[matches.length - 1];
  const nameMatch = last?.match(/\basync\s+([A-Za-z0-9_]+)\s*\(/);
  return nameMatch?.[1] ?? null;
}

/**
 * @param {string} source
 * @param {number} startIndex
 */
function findManyBlock(source, startIndex) {
  const open = source.indexOf("(", startIndex);
  if (open < 0) {
    return "";
  }
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, i + 1);
      }
    }
  }
  return source.slice(startIndex, startIndex + 500);
}

/** @type {string[]} */
const violations = [];

for (const file of walkRepositoryFiles(API_SRC)) {
  const relFromSrc = path.relative(API_SRC, file).replaceAll("\\", "/");
  if (LEGACY_FILE_ALLOWLIST.has(relFromSrc)) {
    continue;
  }

  const source = fs.readFileSync(file, "utf8");
  const relFromApi = path.relative(path.join(REPO_ROOT, "apps/api"), file);

  for (const pattern of FIND_MANY_PATTERNS) {
    const regex = new RegExp(pattern.replace(".", "\\.") + "\\s*\\(", "g");
    let match = regex.exec(source);
    while (match !== null) {
      const block = findManyBlock(source, match.index);
      const hasTake = /\btake\s*:/.test(block);
      const hasSelect = /\bselect\s*:/.test(block);
      const hasBoundedIn = /\bin\s*:\s*\[/.test(block) || /\bin\s*:\s*\w+/.test(block);
      const fn = enclosingFunctionName(source, match.index);

      if (!hasTake && !hasSelect) {
        const line = source.slice(0, match.index).split("\n").length;
        violations.push(
          `${relFromApi}:${line} ${pattern} missing both take and select (fn=${fn ?? "?"})`
        );
      } else if (hasSelect && !hasTake && !hasBoundedIn) {
        const line = source.slice(0, match.index).split("\n").length;
        violations.push(
          `${relFromApi}:${line} ${pattern} select without take — full tenant scan risk (fn=${fn ?? "?"})`
        );
      }
      match = regex.exec(source);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-unbounded-list: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  "guard-unbounded-list: PASS (tenant-scoped findMany in *.repository.ts requires take or bounded in)"
);
