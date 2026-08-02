#!/usr/bin/env node
/**
 * PSR-9 — Collect closure scorecard metrics (measure-only; never claims closed).
 *
 * Usage:
 *   node scripts/ops/psr-9-closure-scorecard-collect.mjs [--scorecard path] [--json]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_SCORECARD = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-9b-closure-scorecard.yaml",
);

function parseArgs(argv) {
  let scorecard = DEFAULT_SCORECARD;
  let json = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--json") json = true;
    else if (argv[i] === "--scorecard" && argv[i + 1]) {
      scorecard = argv[++i];
      if (!scorecard.startsWith("/")) scorecard = join(root, scorecard);
    }
  }
  return { scorecard, json };
}

function loadYaml(abs) {
  const py = `
import json, sys, yaml
from datetime import date, datetime
def default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))
with open(sys.argv[1], encoding="utf-8") as f:
    json.dump(yaml.safe_load(f), sys.stdout, default=default)
`;
  const r = spawnSync("python3", ["-c", py, abs], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "yaml failed");
  return JSON.parse(r.stdout);
}

function countFiles(dir, exts) {
  let n = 0;
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (exts.some((ext) => e.name.endsWith(ext))) n += 1;
    }
  };
  walk(dir);
  return n;
}

function legacySizeMb() {
  const r = spawnSync("du", ["-sm", join(root, "legacy")], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const n = Number((r.stdout || "").trim().split(/\s+/)[0]);
  return Number.isFinite(n) ? n : null;
}

function dirtyWorktreeCount() {
  const r = spawnSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  const lines = (r.stdout || "").split(/\n/).filter((l) => l.length > 0);
  return lines.length;
}

function absoluteDocPathHits() {
  const r = spawnSync(
    "rg",
    ["-n", String.raw`/home/[A-Za-z]|/Users/[A-Za-z]`, "docs", "-g", "*.md", "-g", "*.mdoc"],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  // rg: 0=matches, 1=none, other=error
  if (r.status !== 0 && r.status !== 1) return null;
  const lines = (r.stdout || "").split(/\n/).filter((l) => l.length > 0);
  return lines.length;
}

function denaliExportsCount() {
  const p = join(root, "packages/workspaces/denali/package.json");
  const pkg = JSON.parse(readFileSync(p, "utf8"));
  const exp = pkg.exports;
  if (!exp || typeof exp !== "object") return 0;
  return Object.keys(exp).length;
}

function governanceFileCount() {
  let n = 0;
  if (existsSync(join(root, "LICENSE")) || existsSync(join(root, "LICENSE.md"))) n += 1;
  if (existsSync(join(root, "SECURITY.md"))) n += 1;
  if (existsSync(join(root, "CONTRIBUTING.md"))) n += 1;
  return n;
}

function meetsTarget(comparison, measured, target) {
  if (typeof measured !== "number" || typeof target !== "number") return false;
  if (comparison === "gte") return measured >= target;
  return measured <= target; // default lte
}

function collect(scorecardPath) {
  const sc = loadYaml(scorecardPath);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const harbor = JSON.parse(
    readFileSync(
      join(root, "packages/workspaces/harbor/workspace.manifest.json"),
      "utf8",
    ),
  );
  const workflowsDir = join(root, ".github/workflows");
  const workflowCount = existsSync(workflowsDir)
    ? readdirSync(workflowsDir).filter((f) => /\.ya?ml$/i.test(f)).length
    : 0;
  const rootMd = readdirSync(root).filter((f) => /\.md(oc)?$/i.test(f)).length;
  const tier = harbor?.guestConformance?.productionTier;

  const values = {
    count_package_scripts: Object.keys(pkg.scripts || {}).length,
    count_workflows: workflowCount,
    count_docs_md_mdoc: countFiles(join(root, "docs"), [".md", ".mdoc"]),
    count_root_markdown: rootMd,
    legacy_size_mb: legacySizeMb(),
    license_present:
      existsSync(join(root, "LICENSE")) || existsSync(join(root, "LICENSE.md"))
        ? 1
        : 0,
    harbor_certified: tier === "certified" ? 1 : 0,
    secret_scan_tooling: existsSync(
      join(root, "scripts/ops/secret-scan-tracked-baseline.mjs"),
    )
      ? 1
      : 0,
    sbom_tooling: existsSync(join(root, "scripts/ops/sbom-from-pnpm-lock.mjs"))
      ? 1
      : 0,
    dirty_worktree_count: dirtyWorktreeCount(),
    absolute_doc_path_hits: absoluteDocPathHits(),
    denali_exports_count: denaliExportsCount(),
    governance_file_count: governanceFileCount(),
    harbor_stub_honest: tier === "stub" ? 1 : 0,
  };

  const rows = [];
  for (const m of sc.metrics || []) {
    const measured = values[m.collector];
    const comparison = m.comparison || (m.id.includes("present") || m.id.includes("tooling") || m.id.includes("certified") ? "gte" : "lte");
    rows.push({
      id: m.id,
      label: m.label,
      baseline_sot: m.baseline_sot,
      target: m.target,
      measured,
      comparison,
      meets_target: meetsTarget(comparison, measured, m.target),
    });
  }

  const report = {
    wave: sc.wave || "PSR-9-closure-scorecard",
    scorecard: scorecardPath.startsWith(root)
      ? scorecardPath.slice(root.length + 1)
      : scorecardPath,
    collected_at: new Date().toISOString(),
    program_closed: false,
    psr9_closed: false,
    meets_all_targets: rows.every((r) => r.meets_target === true),
    rows,
  };

  const outDir = join(root, "reports/psr");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "closure-scorecard-latest.json");
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    `psr-9-closure-scorecard-collect: OK — metrics=${rows.length} meets_all=${report.meets_all_targets} out=reports/psr/closure-scorecard-latest.json`,
  );
  return report;
}

try {
  const { scorecard, json } = parseArgs(process.argv);
  if (!existsSync(scorecard)) throw new Error(`scorecard missing: ${scorecard}`);
  const report = collect(scorecard);
  if (json) console.log(JSON.stringify(report));
} catch (err) {
  console.error(`psr-9-closure-scorecard-collect: ERROR — ${err.message || err}`);
  process.exit(2);
}
