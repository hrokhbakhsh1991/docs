#!/usr/bin/env node
/**
 * Phase 6 — ingress / browser boundary static verification.
 *
 * Ensures runtime web code does not call Nest `/api/v2` directly (BFF-first).
 * Prints recommended ingress snippet for operators.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const WEB_LIB = path.join(REPO_ROOT, "apps/web/lib");

const ALLOWLIST = new Set([
  "apps/web/lib/api-client.ts",
  "apps/web/lib/tour-ops-api-origin.ts",
  "apps/web/lib/api/bff-fetch.ts",
  "apps/web/lib/api/get-api-base-url.ts",
  "apps/web/lib/api-paths.ts",
  "apps/web/lib/me-bff.ts",
]);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function normPosix(p) {
  return p.split(path.sep).join("/");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p, acc);
    } else if (ent.isFile() && (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx"))) {
      acc.push(p);
    }
  }
  return acc;
}

function lineAt(src, idx) {
  return src.slice(0, idx).split("\n").length;
}

function main() {
  const violations = [];
  const patterns = [
    { re: /\bfetch\s*\(\s*[`'"][^`'"]*\/api\/v2\//g, label: "browser fetch() to /api/v2" },
    {
      re: /\bresolveTourOpsApiBaseUrl\s*\(/g,
      label: "resolveTourOpsApiBaseUrl() outside legacy api-client",
    },
  ];

  for (const abs of walk(WEB_LIB)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (rel.endsWith(".spec.ts")) continue;
    if (ALLOWLIST.has(rel)) continue;
    const text = stripComments(fs.readFileSync(abs, "utf8"));
    for (const { re, label } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        violations.push(`[INGRESS_BYPASS] ${rel}:${lineAt(text, m.index)} — ${label}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("[ingress-bff-boundary] FAIL\n");
    for (const v of violations) {
      console.error(`  ${v}`);
    }
    process.exit(1);
  }

  console.log("[ingress-bff-boundary] OK — no direct /api/v2 or dynamic API origin in apps/web/lib");
  console.log(`
Recommended ingress (browser traffic → web only):

  # Public: Next.js / BFF
  location / {
    proxy_pass http://web_upstream;
  }

  # Block direct Nest API from the public internet (internal mesh only)
  location /api/v2/ {
    return 403;
  }

  # Or restrict API upstream to internal CIDR / service mesh, not browser Hosts.
`);
}

main();
