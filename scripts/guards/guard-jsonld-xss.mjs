#!/usr/bin/env node
/**
 * SEO-5++ — JSON-LD must serialize via serializeMarketingJsonLd (XSS-safe).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MARKETING_ROOT = path.join(REPO_ROOT, "apps/marketing");
const violations = [];

function scanDir(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      scanDir(full);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(ent.name)) {
      continue;
    }
    const source = readFileSync(full, "utf8");
    if (!source.includes('type="application/ld+json"')) {
      continue;
    }
    if (full.endsWith("serialize-marketing-jsonld.ts")) {
      continue;
    }
    if (source.includes("JSON.stringify(") && source.includes("application/ld+json")) {
      violations.push(
        `${path.relative(REPO_ROOT, full)}: JSON-LD must use serializeMarketingJsonLd, not JSON.stringify`
      );
    }
    if (!source.includes("serializeMarketingJsonLd")) {
      violations.push(
        `${path.relative(REPO_ROOT, full)}: JSON-LD script must call serializeMarketingJsonLd`
      );
    }
  }
}

scanDir(path.join(MARKETING_ROOT, "app"));
scanDir(path.join(MARKETING_ROOT, "src"));

const serializer = path.join(MARKETING_ROOT, "src/seo/serialize-marketing-jsonld.ts");
if (!readFileSync(serializer, "utf8").includes("\\u003c")) {
  violations.push("serialize-marketing-jsonld.ts must escape < for script safety");
}

if (violations.length > 0) {
  console.error("guard-jsonld-xss: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-jsonld-xss: PASS");
