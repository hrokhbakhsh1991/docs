#!/usr/bin/env node
/**
 * PSR-3a — public `dev` front door (ops helper, not a multi-process orchestrator).
 * Prints the supported surface commands and exits 1 so callers do not assume
 * a silent all-apps boot.
 */
const surfaces = [
  ["api", "pnpm --filter @apps/api run dev"],
  ["web (admin)", "pnpm --filter @apps/web run dev"],
  ["portal", "pnpm --filter @apps/portal run dev"],
  ["marketing", "pnpm --filter @apps/marketing run dev"],
];

console.log("Public front door: dev");
console.log("");
console.log("This monorepo does not boot all surfaces from one process.");
console.log("Pick a surface:");
console.log("");
for (const [name, cmd] of surfaces) {
  console.log(`  ${name.padEnd(14)} ${cmd}`);
}
console.log("");
console.log("Infra (optional): pnpm run infra:up");
process.exit(1);
