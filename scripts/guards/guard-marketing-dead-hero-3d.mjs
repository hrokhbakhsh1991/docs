#!/usr/bin/env node
/**
 * MKT-DEAD-01 — hero-3d dead code must not exist.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HERO_3D = path.join(REPO_ROOT, "apps/marketing/src/home/hero-3d");

if (existsSync(HERO_3D)) {
  console.error("guard-marketing-dead-hero-3d: FAIL — hero-3d/ still exists");
  process.exit(1);
}

console.log("guard-marketing-dead-hero-3d: PASS");
