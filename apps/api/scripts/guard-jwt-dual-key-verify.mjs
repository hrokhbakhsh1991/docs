#!/usr/bin/env node
/** DEC-107 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const jwtEnv = read("src/tenant-kernel/jwt-env.ts");
if (!jwtEnv.includes("AUTH_JWT_PUBLIC_KEY_PREVIOUS")) {
  violations.push("jwt-env.ts must read AUTH_JWT_PUBLIC_KEY_PREVIOUS");
}

const parser = read("src/tenant-kernel/parse-jwt-bearer.ts");
if (!parser.includes("previousPublicKeyPem")) {
  violations.push("parse-jwt-bearer.ts must fallback to previous public key");
}

const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
if (!envExample.includes("AUTH_JWT_PUBLIC_KEY_PREVIOUS")) {
  violations.push(".env.example must document AUTH_JWT_PUBLIC_KEY_PREVIOUS");
}

if (violations.length) {
  console.error("guard-jwt-dual-key-verify: FAIL");
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}
console.log("guard-jwt-dual-key-verify: PASS");
