#!/usr/bin/env node
/**
 * Next `output: "standalone"` does not bundle client static assets.
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/output
 */
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = join(appRoot, ".next/standalone/apps/web");

if (!existsSync(join(standaloneRoot, "server.js"))) {
  console.error("copy-standalone-static: missing standalone output — run `next build` first");
  process.exit(1);
}

const copies = [
  { from: join(appRoot, ".next/static"), to: join(standaloneRoot, ".next/static") },
  { from: join(appRoot, "public"), to: join(standaloneRoot, "public") },
];

for (const { from, to } of copies) {
  if (!existsSync(from)) {
    console.error(`copy-standalone-static: missing source ${from}`);
    process.exit(1);
  }
  cpSync(from, to, { recursive: true });
  console.log(`copy-standalone-static: ${from} → ${to}`);
}
