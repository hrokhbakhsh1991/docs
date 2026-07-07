#!/usr/bin/env node
/**
 * Phase 6 P2 — move non-contract package.json exports under ./host/*
 * Contract: ., ./plugin, ./theme/*, ./settings/*
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACES_DIR = path.join(REPO_ROOT, "packages/workspaces");

/** @param {string} key */
function isContractExportKey(key) {
  if (key === ".") return true;
  if (key === "./plugin") return true;
  if (key.startsWith("./theme/")) return true;
  if (key.startsWith("./settings/")) return true;
  return false;
}

/** @param {Record<string, unknown>} exports */
function toHostExports(exports) {
  /** @type {Record<string, unknown>} */
  const next = {};
  for (const [key, value] of Object.entries(exports)) {
    if (isContractExportKey(key)) {
      next[key] = value;
      continue;
    }
    const hostKey = key.startsWith("./") ? `./host/${key.slice(2)}` : `./host/${key}`;
    next[hostKey] = value;
  }
  return next;
}

/** @param {string} workspaceDir */
function syncWorkspacePackageJson(workspaceDir) {
  const pkgPath = path.join(workspaceDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (raw.exports === undefined || typeof raw.exports !== "object") {
    return null;
  }
  const beforeKeys = Object.keys(raw.exports);
  raw.exports = toHostExports(raw.exports);
  const afterKeys = Object.keys(raw.exports);
  fs.writeFileSync(pkgPath, `${JSON.stringify(raw, null, 2)}\n`);
  return {
    name: raw.name,
    before: beforeKeys.length,
    after: afterKeys.length,
  };
}

const results = [];
for (const ent of fs.readdirSync(WORKSPACES_DIR, { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  const result = syncWorkspacePackageJson(path.join(WORKSPACES_DIR, ent.name));
  if (result !== null) {
    results.push(result);
  }
}

for (const result of results) {
  console.log(
    `sync-workspace-host-exports: ${result.name} — ${result.before} → ${result.after} export keys (contract + ./host/*)`
  );
}

console.log("sync-workspace-host-exports: PASS");
