#!/usr/bin/env node
/**
 * Audits dependency-cruiser circular violations and documents remediation patterns
 * used in this repo (TypeORM entity contracts, Denali validation leaf modules).
 *
 * Usage:
 *   node scripts/resolve-circular-dependencies.mjs           # report only (exit 0)
 *   node scripts/resolve-circular-dependencies.mjs --check   # exit 1 if cycles remain
 *   node scripts/resolve-circular-dependencies.mjs --json    # machine-readable summary
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHECK = process.argv.includes("--check");
const JSON_OUT = process.argv.includes("--json");

const REMEDIATION = {
  "apps/api TypeORM entity cycles": [
    "Move bidirectional relation types to packages/domain-contracts (@repo/domain-contracts).",
    "Use string entity targets in @OneToOne/@ManyToOne/@OneToMany (e.g. TOUR_ENTITY, \"details\").",
    "Type relation properties with ITourEntity / ITourDetails interfaces — never import entity classes across files.",
    "Share enums (TourLifecycleStatus) from domain-contracts; re-export from entity modules if needed for backward compatibility.",
  ],
  "apps/web Denali validation cycles": [
    "Shared validation belongs in apps/web/src/features/tours/domain/denali-rules/ (leaf modules).",
    "denaliInvariantEngine and denaliRuleAccess must re-export from denali-rules, not import each other.",
    "resolveRuleModel + clearHiddenFormValues + structuralInvariants + invariantState form an acyclic DAG.",
  ],
  "tenant-runtime.contract ↔ guard": [
    "Define TenantRuntimeAction in @repo/domain-contracts; contract and guard import the type from there.",
  ],
  "draft-engine.facade ↔ draft-conflict.exception": [
    "Extract DraftSyncPayloadResponse to draft-sync-payload.types.ts (depends only on @repo/shared-contracts).",
  ],
  "post-double-entry-journal ↔ persist-ledger-journal": [
    "Extract PostDoubleEntryJournalResult to post-double-entry-journal.types.ts.",
  ],
};

function runDepcruise() {
  const args = [
    "--config",
    "dependency-cruiser.config.js",
    ".",
    "--output-type",
    "json",
    "--no-config-cache",
  ];
  const result = spawnSync("pnpm", ["exec", "depcruise", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(2);
  }
  const raw = result.stdout?.trim() || "[]";
  let modules;
  try {
    modules = JSON.parse(raw);
  } catch {
    console.error("Failed to parse dependency-cruiser JSON output");
    if (result.stderr) console.error(result.stderr);
    process.exit(2);
  }
  return { modules, exitCode: result.status ?? 0, stderr: result.stderr };
}

function collectCircularViolations(modules) {
  const cycles = [];
  for (const mod of modules) {
    for (const rule of mod.valid ?? []) {
      if (rule.name !== "no-circular-dependencies") continue;
      for (const v of rule.violations ?? []) {
        cycles.push({
          from: v.from,
          to: v.to,
          cycle: v.cycle,
          severity: v.severity,
        });
      }
    }
  }
  return cycles;
}

function groupByRoot(cycles) {
  const roots = new Map();
  for (const c of cycles) {
    const root = c.cycle?.[0] ?? c.from;
    if (!roots.has(root)) roots.set(root, []);
    roots.get(root).push(c);
  }
  return roots;
}

function suggestRemediation(cyclePath) {
  const joined = cyclePath.join(" → ");
  if (joined.includes("denaliInvariantEngine") && joined.includes("denaliRuleAccess")) {
    return REMEDIATION["apps/web Denali validation cycles"];
  }
  if (/entities\/.*\.entity\.ts/.test(joined)) {
    return REMEDIATION["apps/api TypeORM entity cycles"];
  }
  if (joined.includes("tenant-runtime.contract") && joined.includes("tenant-runtime-guard")) {
    return REMEDIATION["tenant-runtime.contract ↔ guard"];
  }
  if (joined.includes("draft-engine.facade") && joined.includes("draft-conflict")) {
    return REMEDIATION["draft-engine.facade ↔ draft-conflict.exception"];
  }
  if (joined.includes("post-double-entry-journal") && joined.includes("persist-ledger-journal")) {
    return REMEDIATION["post-double-entry-journal ↔ persist-ledger-journal"];
  }
  return null;
}

function main() {
  const { modules, stderr } = runDepcruise();
  const cycles = collectCircularViolations(modules);
  const grouped = groupByRoot(cycles);

  if (JSON_OUT) {
    const payload = {
      circularViolationCount: cycles.length,
      uniqueRoots: grouped.size,
      cycles: cycles.map((c) => ({
        root: c.cycle?.[0] ?? c.from,
        cycle: c.cycle,
        from: c.from,
        to: c.to,
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
    if (CHECK && cycles.length > 0) process.exit(1);
    return;
  }

  console.log("Circular dependency audit (dependency-cruiser no-circular-dependencies)\n");
  console.log(`Violations: ${cycles.length} (${grouped.size} unique root module(s))\n`);

  if (cycles.length === 0) {
    console.log("No circular dependencies reported.");
    if (CHECK) process.exit(0);
    return;
  }

  let index = 0;
  for (const [root, items] of grouped) {
    index += 1;
    const sample = items[0];
    const path = sample.cycle ?? [sample.from, sample.to];
    console.log(`${index}. ${root}`);
    console.log(`   cycle: ${path.join(" → ")}`);
    const hints = suggestRemediation(path);
    if (hints) {
      console.log("   remediation:");
      for (const line of hints) {
        console.log(`     - ${line}`);
      }
    }
    console.log("");
  }

  console.log("Documented patterns (see script header):");
  for (const [title, lines] of Object.entries(REMEDIATION)) {
    console.log(`  • ${title}`);
    for (const line of lines) {
      console.log(`      ${line}`);
    }
  }

  if (stderr?.trim()) {
    console.error("\n[depcruise stderr]\n", stderr.trim());
  }

  if (CHECK) {
    process.exit(1);
  }
}

main();
