#!/usr/bin/env node
/**
 * Run prisma generate in artifact API using build-host prisma CLI.
 * Usage: node bundle-api-prisma-for-artifact.mjs <artifactApiDir> <repoRoot>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const apiDir = resolve(process.argv[2] ?? "");
const repoRoot = resolve(process.argv[3] ?? "");
if (!apiDir || !repoRoot) {
  console.error("bundle-api-prisma-for-artifact: usage <artifactApiDir> <repoRoot>");
  process.exit(1);
}

const requireFromApi = createRequire(join(repoRoot, "apps/api/package.json"));
const repoPrismaCli = join(dirname(requireFromApi.resolve("prisma/package.json")), "build", "index.js");

const schemaPath = join(apiDir, "prisma/schema.prisma");
let schema = readFileSync(schemaPath, "utf8");
if (!schema.includes("binaryTargets")) {
  schema = schema.replace(
    'provider = "prisma-client-js"',
    'provider = "prisma-client-js"\n  binaryTargets = ["native", "debian-openssl-1.1.x"]'
  );
  writeFileSync(schemaPath, schema);
}

execFileSync(process.execPath, [repoPrismaCli, "generate", "--schema=./prisma/schema.prisma"], {
  cwd: apiDir,
  stdio: "inherit",
});

const clientPkg = join(apiDir, "node_modules", "@prisma", "client", "package.json");
if (!existsSync(clientPkg)) {
  console.error(`bundle-api-prisma-for-artifact: missing ${clientPkg}`);
  process.exit(1);
}

console.log("bundle-api-prisma-for-artifact: OK");
