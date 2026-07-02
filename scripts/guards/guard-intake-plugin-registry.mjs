#!/usr/bin/env node
/**
 * P7 — intake plugin registry architecture guard.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SDK_CATALOG = path.join(REPO_ROOT, "packages/workspace-sdk/src/catalog");
const PORTAL_CATALOG = path.join(REPO_ROOT, "apps/portal/app/catalog");

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function listTsFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listTsFiles(p));
    } else if (/\.tsx?$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

const violations = [];

if (fs.existsSync(path.join(SDK_CATALOG, "resolve-catalog-intake-capabilities.ts"))) {
  violations.push("resolve-catalog-intake-capabilities.ts must be removed from SDK");
}

for (const file of listTsFiles(SDK_CATALOG)) {
  const source = fs.readFileSync(file, "utf8");
  if (/\bCATALOG_INTAKE_CAPABILITIES\b/.test(source)) {
    violations.push(`${path.relative(REPO_ROOT, file)} contains CATALOG_INTAKE_CAPABILITIES map`);
  }
  if (/participantProfileFields\.map/.test(source)) {
    violations.push(`${path.relative(REPO_ROOT, file)} contains participantProfileFields adapter logic`);
  }
  if (file.endsWith("resolve-intake-schema.ts")) {
    if (/switch\s*\(\s*fieldId/.test(source)) {
      violations.push("resolve-intake-schema.ts must not branch on fieldId — workspace plugins own effective schema");
    }
    if (/DEFAULT_MINIMAL_SCHEMA/.test(source)) {
      violations.push("resolve-intake-schema.ts must not define DEFAULT_MINIMAL_SCHEMA fallback");
    }
  }
  if (
    /export function (showPublicCatalog|buildPublicCatalog|initialPublicCatalog|isPublicCatalogTransport|computePublicCatalog)/.test(
      source
    )
  ) {
    violations.push(
      `${path.relative(REPO_ROOT, file)} exports Denali transport business logic — move to workspace plugin`
    );
  }
}

const registrationsRoute = read("apps/portal/app/api/catalog/registrations/route.ts");
if (!registrationsRoute.includes("@app-tour/workspace-plugin-host/register")) {
  violations.push("catalog registrations API route must bootstrap workspace intake plugin registry");
}

const instrumentationPath = path.join(REPO_ROOT, "apps/portal/instrumentation.ts");
if (fs.existsSync(instrumentationPath)) {
  const instrumentation = fs.readFileSync(instrumentationPath, "utf8");
  if (!instrumentation.includes("@app-tour/workspace-plugin-host/register")) {
    violations.push("portal instrumentation must bootstrap workspace intake plugin registry");
  }
}

for (const file of listTsFiles(PORTAL_CATALOG)) {
  const source = fs.readFileSync(file, "utf8");
  if (/@app-tour\/workspace-denali/.test(source) || /@app-tour\/workspace-urban/.test(source)) {
    violations.push(`${path.relative(REPO_ROOT, file)} imports workspace package directly`);
  }
  if (file.endsWith("public-catalog-registration-flow.tsx")) {
    if (!source.includes("@app-tour/workspace-plugin-host/register")) {
      violations.push(
        `${path.relative(REPO_ROOT, file)} must bootstrap intake registry on client bundle`
      );
    }
  }
  if (/features\.transportIntake/.test(source)) {
    violations.push(
      `${path.relative(REPO_ROOT, file)} gates transport via features.transportIntake — use registry transport surface`
    );
  }
  if (/resolveCatalogIntakeCapabilities/.test(source)) {
    violations.push(`${path.relative(REPO_ROOT, file)} still uses resolveCatalogIntakeCapabilities`);
  }
}

const layout = read("apps/portal/app/layout.tsx");
if (!layout.includes("@app-tour/workspace-plugin-host/register")) {
  violations.push("portal layout must bootstrap workspace intake plugin registry");
}

if (violations.length > 0) {
  console.error("guard-intake-plugin-registry: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-intake-plugin-registry: PASS");
