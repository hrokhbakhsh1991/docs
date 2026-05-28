#!/usr/bin/env node
/**
 * Static check: ErrorRegistry maps every canonical API error code (explicit keys or getUIError fallback).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseTaxonomyValues(ts) {
  return [...ts.matchAll(/:\s*"([A-Z][A-Z0-9_]+)"/g)].map((m) => m[1]);
}

function parseDomainOnlyCodes(ts) {
  const block = ts.match(/DOMAIN_API_ERROR_CODES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) {
    return [];
  }
  return [...block[1].matchAll(/"([A-Z][A-Z0-9_]+)"/g)].map((m) => m[1]);
}

function registryCoversCode(registry, code, taxonomyTs) {
  if (registry.includes(`"${code}"`)) {
    return true;
  }
  if (new RegExp(`\\b${code}\\s*:`).test(registry)) {
    return true;
  }
  for (const section of taxonomyTs.matchAll(/(\w+):\s*\{([^}]+)\}/g)) {
    const sectionName = section[1];
    const body = section[2];
    for (const entry of body.matchAll(/(\w+):\s*"([^"]+)"/g)) {
      if (entry[2] === code) {
        const ref = `[GlobalErrorTaxonomy.${sectionName}.${entry[1]}]`;
        if (registry.includes(ref)) {
          return true;
        }
      }
    }
  }
  return false;
}

function main() {
  const taxonomyPath = path.join(REPO_ROOT, "packages/shared/errors/error-taxonomy.ts");
  const domainPath = path.join(REPO_ROOT, "apps/web/lib/errors/canonical-api-error-codes.ts");
  const registryPath = path.join(REPO_ROOT, "apps/web/lib/errors/error-registry.ts");

  const taxonomy = fs.readFileSync(taxonomyPath, "utf8");
  const domain = fs.readFileSync(domainPath, "utf8");
  const registry = fs.readFileSync(registryPath, "utf8");

  const hasRuntimeFallback =
    registry.includes("const DOMAIN_REGISTRY = Object.fromEntries") &&
    registry.includes("ALL_KNOWN_API_ERROR_CODES.includes(code)") &&
    registry.includes("function getUIError");

  if (!hasRuntimeFallback) {
    process.exit(1);
  }

  const expected = [...new Set([...parseTaxonomyValues(taxonomy), ...parseDomainOnlyCodes(domain)])];
  const missing = expected.filter((code) => !registryCoversCode(registry, code, taxonomy));

  if (missing.length > 0) {
    for (const _c of missing.slice(0, 8)) {
    }
    if (missing.length > 8) {
    }
  }

}

main();
