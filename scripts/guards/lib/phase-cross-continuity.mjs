#!/usr/bin/env node
/**
 * Phases 0–5 — cross-phase continuity doc links and entry-map integrity.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

/**
 * @param {string} rel
 * @returns {string}
 */
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * @param {string} rel
 * @returns {boolean}
 */
function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluatePhaseCrossContinuity() {
  const failures = [];

  const canonical = "docs/appendices/PLATFORM-CONTINUITY-0-5.md";
  if (!exists(canonical)) {
    failures.push(`missing ${canonical}`);
  } else {
    const body = read(canonical);
    if (!/phase-5-agent-router\.md/.test(body)) {
      failures.push("canonical continuity must list phase-5-agent-router");
    }
    if (!/phase_5_entry_requires_modular/.test(body)) {
      failures.push("canonical continuity must reference phase_5_entry_requires_modular");
    }
    if (!/CROSS-PHASE-ENTRY-MAP/.test(body)) {
      failures.push("canonical continuity must link CROSS-PHASE-ENTRY-MAP");
    }
  }

  const phase5Ext = "docs/phase-5/appendices/platform-continuity-0-5.md";
  if (!exists(phase5Ext)) {
    failures.push(`missing ${phase5Ext}`);
  } else {
    const ext = read(phase5Ext);
    if (!/PLATFORM-CONTINUITY-0-5\.md/.test(ext)) {
      failures.push("phase-5 platform-continuity must defer to docs/appendices canonical");
    }
  }

  for (const rel of [
    "docs/phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md",
    "docs/phase-5/appendices/phase-0-3-bridge.md",
  ]) {
    if (!exists(rel)) failures.push(`missing ${rel}`);
  }

  const entryMap = exists("docs/phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md")
    ? read("docs/phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md")
    : "";
  if (entryMap && !/phase_5_entry_requires_modular/.test(entryMap)) {
    failures.push("CROSS-PHASE-ENTRY-MAP must cite phase_5_entry_requires_modular");
  }
  if (entryMap && !/phase-5-entry-verified\.yaml/.test(entryMap)) {
    failures.push("CROSS-PHASE-ENTRY-MAP must cite phase-5-entry-verified.yaml");
  }

  const handoff = read("docs/phase-4/appendices/phase-handoff-3-4-5.md");
  if (!/PLATFORM-CONTINUITY-0-5/.test(handoff)) {
    failures.push("phase-handoff-3-4-5 must link PLATFORM-CONTINUITY-0-5");
  }
  if (!/CROSS-PHASE-ENTRY-MAP/.test(handoff)) {
    failures.push("phase-handoff-3-4-5 must link CROSS-PHASE-ENTRY-MAP");
  }

  const boot = read("docs/phase-5/appendices/BOOT-MANIFEST.yaml");
  if (!/appendices\/PLATFORM-CONTINUITY-0-5\.md/.test(boot)) {
    failures.push("BOOT-MANIFEST must boot-read docs/appendices/PLATFORM-CONTINUITY-0-5.md");
  }

  const migration = read("docs/MIGRATION.md");
  if (!/phase-5/.test(migration)) {
    failures.push("MIGRATION.md must index Phase 5");
  }

  const p4Readme = read("docs/phase-4/README.md");
  if (!/phase-5-agent-router/.test(p4Readme)) {
    failures.push("phase-4/README must link Phase 5 router");
  }

  const p5Readme = read("docs/phase-5/README.md");
  if (!/PLATFORM-CONTINUITY-0-5/.test(p5Readme)) {
    failures.push("phase-5/README must link PLATFORM-CONTINUITY-0-5");
  }

  const continuity06 = "docs/appendices/PLATFORM-CONTINUITY-0-6.md";
  if (!exists(continuity06)) {
    failures.push(`missing ${continuity06}`);
  } else if (!/phase-6-agent-router/.test(read(continuity06))) {
    failures.push("PLATFORM-CONTINUITY-0-6 must list phase-6 router");
  }

  if (!exists("docs/phase-6/phase-6-agent-router.md")) {
    failures.push("missing docs/phase-6/phase-6-agent-router.md");
  }

  if (!/phase-6/.test(migration)) {
    failures.push("MIGRATION.md must index Phase 6");
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
  };
}
