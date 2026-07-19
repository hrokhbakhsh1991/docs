/**
 * Import boundary for the second-repo simulation.
 * Allowed: @app-tour/finance-core, @app-tour/finance-http-contracts, relative, node:*.
 * Scans only consumer src/ + test/ (not staged packages).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = [join(ROOT, "src"), join(ROOT, "test")];

const ALLOWED = new Set([
  "@app-tour/finance-core",
  "@app-tour/finance-http-contracts",
]);

const FORBIDDEN = [
  /from\s+["'][^"']*apps\/api/,
  /from\s+["']@apps\/api/,
  /from\s+["']@app-tour\/workspace-/,
  /from\s+["'][^"']*packages\/workspaces/,
  /from\s+["']@prisma\/client["']/,
  /from\s+["'][^"']*generated/,
  /from\s+["'][^"']*finance-core\/src/,
  /from\s+["'][^"']*finance-http-contracts\/src/,
];

function walkTs(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const importRe = /from\s+["']([^"']+)["']/g;
let failed = false;

for (const dir of SCAN_DIRS) {
  for (const file of walkTs(dir)) {
    const src = readFileSync(file, "utf8");
    for (const bad of FORBIDDEN) {
      if (bad.test(src)) {
        console.error(`FORBIDDEN pattern ${bad} in ${file}`);
        failed = true;
      }
    }
    let m;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(src))) {
      const spec = m[1];
      if (spec.startsWith(".") || spec.startsWith("node:")) continue;
      const pkg = spec.startsWith("@")
        ? spec.split("/").slice(0, 2).join("/")
        : spec.split("/")[0];
      if (!ALLOWED.has(pkg)) {
        console.error(`DISALLOWED import "${spec}" in ${file}`);
        failed = true;
      }
    }
  }
}

if (failed) {
  console.error("external-finance-consumer import guard FAILED");
  process.exit(1);
}
console.log("external-finance-consumer import guard OK");
