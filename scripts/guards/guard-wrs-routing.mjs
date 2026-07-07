#!/usr/bin/env node
/**
 * WRS-001 — block legacy shop.* egress in cross-app URL builders.
 * Ingress strip (shop. before parse) is allowed in tenant-kernel / guest-surface-host only.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCAN_DIRS = ["apps/web/src", "apps/portal/src", "apps/marketing/src"];

const FORBIDDEN_PATTERNS = [
  { re: /`shop\.\$\{/, label: "template literal shop.${...} prepend" },
  { re: /['"]shop\.\$\{/, label: "quoted shop.${ prepend" },
  {
    re: /marketingHost\s*=\s*hostname\.startsWith\("shop\."\)/,
    label: "shop. ternary marketingHost",
  },
  { re: /buildDevPortalPublicBaseUrl\s*\(/, label: "direct buildDevPortalPublicBaseUrl (use guest-surface-host)" },
  {
    re: /buildDevMarketingPublicBaseUrl\s*\(/,
    label: "direct buildDevMarketingPublicBaseUrl (use guest-surface-host)",
  },
];

const ALLOWLIST = new Set([
  "packages/tenant-kernel/src/host/build-dev-marketing-public-base-url.ts",
  "packages/tenant-kernel/src/host/build-dev-portal-public-base-url.ts",
  "packages/guest-surface-host/src/resolve-public-branding-host.ts",
  "packages/guest-surface-host/src/resolve-tenant-id-from-dev-host.ts",
]);

const PLAYWRIGHT_DEFAULT_FILES = [
  "apps/marketing/playwright.marketing.config.ts",
  "apps/marketing/playwright.marketing-seo.config.ts",
  "apps/marketing/playwright.marketing-seo-matrix.config.ts",
];

const ENV_EXAMPLES = [
  "apps/marketing/.env.local.example",
  "apps/portal/.env.local.example",
  "apps/web/.env.local.example",
];

function listTsFiles(dir) {
  const abs = path.join(REPO_ROOT, dir);
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
        out.push(full);
      }
    }
  };
  if (statSync(abs, { throwIfNoEntry: false })?.isDirectory()) {
    walk(abs);
  }
  return out;
}

const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of listTsFiles(dir)) {
    const rel = path.relative(REPO_ROOT, file);
    if (ALLOWLIST.has(rel)) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    for (const { re, label } of FORBIDDEN_PATTERNS) {
      if (re.test(content)) {
        violations.push(`${rel}: ${label}`);
      }
    }
  }
}

for (const rel of PLAYWRIGHT_DEFAULT_FILES) {
  const abs = path.join(REPO_ROOT, rel);
  if (!statSync(abs, { throwIfNoEntry: false })) {
    continue;
  }
  const content = readFileSync(abs, "utf8");
  if (content.includes("shop.operator.localhost")) {
    violations.push(`${rel}: default baseURL must use operator.localhost (WRS canonical)`);
  }
}

for (const rel of ENV_EXAMPLES) {
  const abs = path.join(REPO_ROOT, rel);
  if (!statSync(abs, { throwIfNoEntry: false })) {
    continue;
  }
  const content = readFileSync(abs, "utf8");
  if (/MARKETING_PUBLIC_BASE_URL=.*shop\./.test(content)) {
    violations.push(`${rel}: MARKETING_PUBLIC_BASE_URL example must not use shop. prefix`);
  }
}

if (violations.length > 0) {
  console.error("guard-wrs-routing: FAIL");
  for (const v of violations) {
    console.error(` - ${v}`);
  }
  process.exit(1);
}

console.log("guard-wrs-routing: PASS");
