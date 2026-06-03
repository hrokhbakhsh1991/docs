#!/usr/bin/env node
/**
 * Enforces package.json engines.node (>=24 <25) and .nvmrc major 24.
 * Usage: node scripts/guards/check-node-engine.mjs
 */
const major = Number(process.versions.node.split(".")[0]);
const full = process.versions.node;

if (!Number.isFinite(major) || major !== 24) {
  console.error(`check-node-engine: FAIL — Node 24 required (.nvmrc / engines); got ${full}`);
  process.exit(1);
}

console.log(`check-node-engine: PASS (Node ${full})`);
