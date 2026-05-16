#!/usr/bin/env node
/**
 * Static check: example ingress blocks public /api/v2/ (BFF-first Phase 6).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONF = path.resolve(__dirname, "../docs/infrastructure/nginx-bff-ingress.example.conf");

function main() {
  const text = fs.readFileSync(CONF, "utf8");
  const violations = [];

  if (!/location\s+\/api\/v2\//.test(text)) {
    violations.push("missing location /api/v2/ block");
  }
  if (!/return\s+403/.test(text)) {
    violations.push("missing return 403 for /api/v2/");
  }
  if (!/proxy_pass\s+http:\/\/tour_ops_web/.test(text)) {
    violations.push("missing proxy_pass to web upstream for /");
  }
  if (/location\s+\/api\/v2\/[\s\S]*?proxy_pass\s+http:\/\/tour_ops_api/.test(text)) {
    violations.push("/api/v2/ must not proxy_pass to public API upstream");
  }

  if (violations.length > 0) {
    console.error("[nginx-bff-ingress] FAIL —", CONF);
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log("[nginx-bff-ingress] OK — example blocks browser /api/v2/");
}

main();
