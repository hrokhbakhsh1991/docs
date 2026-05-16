#!/usr/bin/env node
/**
 * Static check: .env*.example files document production CORS/cookie/tenant vars (Phase 0.5).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const checks = [
  {
    file: "apps/api/.env.example",
    needles: ["CORS_ALLOW_TENANT_SUBORIGINS", "TENANT_ROOT_DOMAIN", "CORS_ORIGIN", "TRUST_PROXY_HOPS"],
  },
  {
    file: "apps/web/.env.local.example",
    needles: [
      "NEXT_PUBLIC_SESSION_COOKIE_DOMAIN",
      "NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE",
      "NEXT_PUBLIC_TENANT_ROOT_DOMAIN",
      "CORS_ALLOW_TENANT_SUBORIGINS",
    ],
  },
];

let failures = 0;
console.log("[prod-env-template] Checking example env files\n");

for (const { file, needles } of checks) {
  const src = read(file);
  for (const needle of needles) {
    if (src.includes(needle)) {
      console.log(`  OK ${file} mentions ${needle}`);
    } else {
      console.error(`  FAIL ${file} missing ${needle}`);
      failures += 1;
    }
  }
}

const checklist = "docs/security/production-cors-cookie-checklist.md";
if (!fs.existsSync(path.join(root, checklist))) {
  console.error(`  FAIL missing ${checklist}`);
  failures += 1;
} else {
  console.log(`  OK ${checklist} exists`);
}

console.log(`\n[prod-env-template] Done (${failures} failure(s))`);
process.exit(failures > 0 ? 1 : 0);
