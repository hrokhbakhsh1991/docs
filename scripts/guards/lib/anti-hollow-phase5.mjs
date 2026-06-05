#!/usr/bin/env node
/**
 * Phase 5 — anti-hollow checks for spec honesty.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

const REQUIRED_ARTIFACTS = [
  { id: "BLOCKER-P5-001", path: "docs/phase-5-canonical-schema.md", phase: "5.1+" },
];

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluateAntiHollowPhase5() {
  const failures = [];

  for (const item of REQUIRED_ARTIFACTS) {
    const abs = path.join(REPO_ROOT, item.path);
    if (!fs.existsSync(abs)) {
      failures.push(`${item.id}: missing ${item.path} (blocks honest ${item.phase})`);
    }
  }

  const contractGlob = ["packages", "apps"].flatMap((root) => {
    const base = path.join(REPO_ROOT, root);
    if (!fs.existsSync(base)) return [];
    return walkForFile(base, "phase-5.contract.spec.ts");
  });

  if (contractGlob.length > 0) {
    for (const f of contractGlob) {
      const c = fs.readFileSync(f, "utf8");
      if (!/\bassert\s*\./.test(c)) {
        failures.push(`${f}: phase-5.contract.spec.ts has no assertions`);
      }
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
    warnings: null,
  };
}

/**
 * @param {string} dir
 * @param {string} name
 * @returns {string[]}
 */
function walkForFile(dir, name) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules") {
      out.push(...walkForFile(p, name));
    } else if (ent.isFile() && ent.name === name) {
      out.push(p);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluateAntiHollowPhase5();
  if (r.warnings) console.warn(`anti-hollow-phase5: NOTE — ${r.warnings}`);
  if (!r.ok) {
    console.error(`anti-hollow-phase5: FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log("anti-hollow-phase5: PASS (schema artifacts present; no hollow contract)");
}
