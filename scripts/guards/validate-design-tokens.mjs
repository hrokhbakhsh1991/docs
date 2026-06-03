#!/usr/bin/env node
/**
 * Validates @app-tour/design-tokens CSS against packages/design-tokens/tokens.meta.json.
 * - Every registered variable must be defined in token CSS.
 * - Every defined CSS variable must be registered (no orphans).
 * - Forbidden name patterns fail the guard.
 * Optional CI: TOKEN_COMPARE_REF — no token name removed vs base branch.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOKENS_PKG = path.join(ROOT, "packages/design-tokens");
const META_PATH = path.join(TOKENS_PKG, "tokens.meta.json");
const CSS_FILES = [
  "src/primitives.css",
  "src/semantics.css",
  "src/themes/light.css",
  "src/themes/dark.css",
];

function extractDefinedVars(cssText) {
  const names = new Set();
  for (const line of cssText.split("\n")) {
    const match = line.match(/^\s*(--[a-z0-9-]+)\s*:/);
    if (match) {
      names.add(match[1]);
    }
  }
  return names;
}

function readCombinedCssFromDisk() {
  let combined = "";
  for (const rel of CSS_FILES) {
    const filePath = path.join(TOKENS_PKG, rel);
    if (!fs.existsSync(filePath)) {
      console.error(`validate-design-tokens: missing ${rel}`);
      process.exit(1);
    }
    combined += `${fs.readFileSync(filePath, "utf8")}\n`;
  }
  return combined;
}

function readCombinedCssFromGit(compareRef) {
  const parts = [];
  for (const rel of CSS_FILES) {
    const gitPath = `packages/design-tokens/${rel}`;
    try {
      parts.push(
        execSync(`git show ${compareRef}:${gitPath}`, {
          encoding: "utf8",
          cwd: ROOT,
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );
    } catch {
      return null;
    }
  }
  return parts.join("\n");
}

function loadRegistered(meta) {
  const registered = new Set(meta.sharedVariables ?? []);
  for (const theme of Object.values(meta.themes ?? {})) {
    for (const name of theme.requiredVariables ?? []) {
      registered.add(name);
    }
  }
  return registered;
}

function compareRemovalGuard(cssNow, compareRef) {
  if (!compareRef) {
    return;
  }
  const cssBefore = readCombinedCssFromGit(compareRef.trim());
  if (!cssBefore) {
    return;
  }
  const before = extractDefinedVars(cssBefore);
  const after = extractDefinedVars(cssNow);
  const removed = [...before].filter((name) => !after.has(name)).sort();
  if (removed.length > 0) {
    console.error("validate-design-tokens: token names removed vs base branch:");
    for (const name of removed) {
      console.error(`  - ${name}`);
    }
    process.exit(1);
  }
}

function main() {
  if (!fs.existsSync(META_PATH)) {
    console.error("validate-design-tokens: missing tokens.meta.json");
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
  const registered = loadRegistered(meta);
  const css = readCombinedCssFromDisk();
  const defined = extractDefinedVars(css);
  const forbidden = meta.forbiddenPatterns ?? [];

  const missing = [...registered].filter((name) => !defined.has(name)).sort();
  if (missing.length > 0) {
    console.error("validate-design-tokens: registered variables missing from CSS:");
    for (const name of missing) {
      console.error(`  - ${name}`);
    }
    process.exit(1);
  }

  const orphans = [...defined].filter((name) => !registered.has(name)).sort();
  if (orphans.length > 0) {
    console.error("validate-design-tokens: CSS variables not listed in tokens.meta.json:");
    for (const name of orphans) {
      console.error(`  - ${name}`);
    }
    process.exit(1);
  }

  for (const name of registered) {
    for (const pattern of forbidden) {
      if (name.toLowerCase().includes(pattern.toLowerCase())) {
        console.error(`validate-design-tokens: forbidden pattern "${pattern}" in ${name}`);
        process.exit(1);
      }
    }
  }

  compareRemovalGuard(css, process.env.TOKEN_COMPARE_REF ?? "");
  console.log(
    `validate-design-tokens: OK (${registered.size} registered, ${defined.size} defined in CSS)`,
  );
}

main();
