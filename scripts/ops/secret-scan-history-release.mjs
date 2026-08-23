#!/usr/bin/env node
/**
 * PROD-6 R6-14 — history-aware release-branch secret scan.
 * Scans first-parent history by default and never prints matched secret values.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const allowlistPath = join(root, "scripts/ops/secret-scan-tracked-allowlist.yaml");
const jsonMode = process.argv.includes("--json");
const allHistory = process.argv.includes("--all");

const FAMILIES = [
  { id: "private_key", pattern: "-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----" },
  { id: "aws_access_key", pattern: "\\bAKIA[0-9A-Z]{16}\\b" },
  { id: "github_pat", pattern: "\\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\\b" },
  { id: "slack_token", pattern: "\\bxox[baprs]-[A-Za-z0-9-]{20,}\\b" },
  { id: "stripe_live_key", pattern: "\\bsk_live_[A-Za-z0-9]{20,}\\b" },
];

function run(args, opts = {}) {
  const r = spawnSync(args[0], args.slice(1), {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...opts,
  });
  return r;
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
  const r = run(["python3", "-c", py, abs]);
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "yaml failed");
  return JSON.parse(r.stdout);
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function buildAllowMatchers(entries) {
  return (entries || []).map((e) => {
    if (e.path) {
      return { test: (p) => p === e.path, families: new Set(e.families || []), label: e.path };
    }
    if (e.path_glob) {
      const re = globToRegExp(e.path_glob);
      return { test: (p) => re.test(p), families: new Set(e.families || []), label: e.path_glob };
    }
    throw new Error("allowlist entry needs path or path_glob");
  });
}

function isAllowed(matchers, relPath, familyId) {
  for (const m of matchers) {
    if (!m.test(relPath)) continue;
    if (m.families.size === 0 || m.families.has(familyId)) return m;
  }
  return null;
}

function scanFamilyHistory(family) {
  const args = [
    "git",
    "log",
    "--format=COMMIT:%H",
    "--name-only",
    "-G",
    family.pattern,
  ];
  if (allHistory) args.push("--all");
  else args.push("--first-parent", "HEAD");
  args.push(
    "--",
    ":!node_modules",
    ":!apps/**/dist",
    ":!apps/**/.next",
  );
  const r = run(args);
  if (r.status !== 0) throw new Error(r.stderr || `git log failed for ${family.id}`);
  const hits = [];
  let commit = null;
  for (const raw of r.stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("COMMIT:")) {
      commit = line.slice("COMMIT:".length);
      continue;
    }
    if (commit) hits.push({ commit, family: family.id, path: line, line: null });
  }
  return hits;
}

function main() {
  const allow = loadYaml(allowlistPath);
  const matchers = buildAllowMatchers(allow.entries || []);
  const revCount = run(["git", "rev-list", allHistory ? "--all" : "--first-parent", allHistory ? undefined : "HEAD"].filter(Boolean));
  const commitsScanned = revCount.stdout.trim().split(/\n+/).filter(Boolean).length;
  const hits = [];
  for (const family of FAMILIES) {
    for (const hit of scanFamilyHistory(family)) {
      const allowHit = isAllowed(matchers, hit.path, hit.family);
      hits.push({
        ...hit,
        commit: hit.commit.slice(0, 12),
        allowlisted: Boolean(allowHit),
        allow_label: allowHit?.label || null,
      });
    }
  }
  const open = hits.filter((h) => !h.allowlisted);
  const allowed = hits.filter((h) => h.allowlisted);
  const report = {
    mode: allHistory ? "all_refs" : "first_parent_HEAD",
    commits_scanned: commitsScanned,
    families: FAMILIES.map((f) => f.id),
    hit_count: hits.length,
    open_count: open.length,
    allowlisted_count: allowed.length,
    open,
    allowlisted_sample: allowed.slice(0, 20),
    redaction: "matched secret values are never emitted",
  };
  if (jsonMode) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`secret-scan-history-release: mode=${report.mode} commits=${commitsScanned} open=${open.length} allowlisted=${allowed.length}`);
    for (const h of open) console.error(`  OPEN ${h.family} ${h.commit}:${h.path}:${h.line ?? "?"}`);
  }
  if (open.length > 0) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`secret-scan-history-release: ERROR — ${err.message || err}`);
  process.exit(2);
}
