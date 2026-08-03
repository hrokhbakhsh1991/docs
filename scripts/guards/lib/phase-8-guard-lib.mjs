#!/usr/bin/env node
/**
 * Phase 8 guard — reusable evaluators (MAP §12 R2).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

const FAIL_TOKEN = "FAIL";

export function readUtf8(relFromRoot) {
  return fs.readFileSync(path.join(REPO_ROOT, relFromRoot), "utf8");
}

export function exists(relFromRoot) {
  return fs.existsSync(path.join(REPO_ROOT, relFromRoot));
}

/**
 * @param {string} checkId
 * @param {string} detail
 * @returns {string}
 */
export function failToken(checkId, detail) {
  return `${FAIL_TOKEN} P8-GUARD-${checkId}: ${detail}`;
}

/**
 * Minimal BOOT-MANIFEST.yaml structural validation (no external YAML dep).
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluateP8BootManifest() {
  const rel = "docs/phase-8/appendices/BOOT-MANIFEST.yaml";
  if (!exists(rel)) {
    return { ok: false, detail: failToken("p8_boot_manifest", `missing ${rel}`) };
  }

  const raw = readUtf8(rel);
  const failures = [];

  if (raw.includes("\t")) {
    failures.push("BOOT-MANIFEST must not contain tab characters");
  }
  if (!/^manifest_version:\s/m.test(raw)) {
    failures.push("missing manifest_version");
  }
  if (!/^phase_id:\s*"8"/m.test(raw)) {
    failures.push('phase_id must be "8"');
  }
  if (!/^subphases:/m.test(raw)) {
    failures.push("missing subphases block");
  }
  for (const id of ["8.0", "8.1", "8.2", "8.3", "8.4", "8.5"]) {
    if (!new RegExp(`"${id.replace(".", "\\.")}":`).test(raw)) {
      failures.push(`subphases missing key "${id}"`);
    }
  }
  if (!/detect_current_subphase:/m.test(raw)) {
    failures.push("missing detect_current_subphase");
  }
  if (!/gate_chain:/m.test(raw)) {
    failures.push("missing gate_chain");
  }
  if (!/phase-8:guard:/m.test(raw)) {
    failures.push("gate_chain must declare phase-8:guard");
  }
  if (!/INV-P8-001|FORB-P8-002/m.test(raw)) {
    failures.push("missing platform-core forbidden invariant reference");
  }

  if (!/READY_FOR_IMPLEMENTATION/.test(raw)) {
    failures.push("repo_status_enum must include READY_FOR_IMPLEMENTATION");
  }
  if (!/doc_ready_subphase:/m.test(raw)) {
    failures.push("detect_current_subphase must document doc_ready_subphase");
  }

  // Unclosed double-quotes (heuristic syntax check)
  const quotes = (raw.match(/"/g) ?? []).length;
  if (quotes % 2 !== 0) {
    failures.push("unbalanced double-quotes in YAML");
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
  };
}

/**
 * @param {string} truthMd
 * @returns {Map<string, string>}
 */
export function parseSubphaseStatuses(truthMd) {
  /** @type {Map<string, string>} */
  const statuses = new Map();
  const rowRe =
    /\|\s*\*\*8\.(\d)\*\*[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*\*\*([A-Z_]+)\*\*/g;
  let m;
  while ((m = rowRe.exec(truthMd)) !== null) {
    statuses.set(`8.${m[1]}`, m[2]);
  }
  return statuses;
}

/**
 * BOOT-MANIFEST detect_current_subphase (simplified).
 * @param {Map<string, string>} statuses
 * @returns {string}
 */
export function detectCurrentSubphase(statuses) {
  const isVerified = (id) => {
    const s = statuses.get(id);
    return s === "VERIFIED_BEHAVIORAL" || s === "VERIFIED_ENTRY";
  };

  if (!isVerified("8.0")) return "8.0";
  if (statuses.get("8.1") !== "VERIFIED_BEHAVIORAL") return "8.1";
  if (statuses.get("8.2") !== "VERIFIED_BEHAVIORAL") return "8.2";

  const parallel = ["8.3", "8.4"].filter(
    (id) => statuses.get(id) !== "VERIFIED_BEHAVIORAL",
  );
  if (parallel.length > 0) {
    return parallel.sort()[0];
  }
  return "8.5";
}

/**
 * @param {string} truthMd
 * @returns {string | null}
 */
export function parseDocReadySubphase(truthMd) {
  const m = truthMd.match(/doc_ready_subphase:\s*"?(\d\.\d)"?/);
  return m?.[1] ?? null;
}

/**
 * @param {string} id
 * @returns {number}
 */
function subphaseNumeric(id) {
  return parseFloat(id);
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluateP8TruthHonesty() {
  const rel = "docs/phase-8/audits/IMPLEMENTATION-TRUTH.md";
  if (!exists(rel)) {
    return { ok: false, detail: failToken("p8_truth_honesty", `missing ${rel}`) };
  }

  const truth = readUtf8(rel);
  const failures = [];

  if (/BL-P8-03/.test(truth)) {
    failures.push(
      "stale blocker BL-P8-03 still present — subphase specs 8.0–8.5 are authored; remove blocker row",
    );
  }

  if (/lazy-urban-plugin\.ts[^|]*\|\s*\*\*ABSENT\*\*[^|]*\|\s*8\.1\b/m.test(truth)) {
    failures.push(
      "lazy-urban-plugin.ts must be subphase 8.2 (not 8.1) per URBAN-ROUTE-MATRIX / phase-8-agent-router",
    );
  }
  if (/lazy-urban-plugin[^|]{0,80}\|\s*8\.1\s*$/m.test(truth)) {
    failures.push("lazy-urban-plugin subphase column must be 8.2");
  }

  if (/packages\/workspaces\/urban`[^|]*\|\s*\*\*PACKAGE_SHELL\*\*[^|]*\|\s*8\.1\b/.test(truth)) {
    failures.push(
      "packages/workspaces/urban shell is Phase 7.1 — subphase column must be 7.1 not 8.1",
    );
  }

  for (const id of ["8.0", "8.1", "8.2", "8.3", "8.4", "8.5"]) {
    const specPath = `docs/phase-8/subphases/${id}-`;
    const dir = path.join(REPO_ROOT, "docs/phase-8/subphases");
    const found = fs.readdirSync(dir).some((f) => f.startsWith(`${id}-`) && f.endsWith(".md"));
    if (!found) {
      failures.push(`missing subphase spec for ${id}`);
    }
  }

  const statuses = parseSubphaseStatuses(truth);
  if (statuses.size < 6) {
    failures.push(`subphase ledger incomplete — parsed ${statuses.size}/6 rows`);
  }

  const verified = [...statuses.values()].filter((s) => s === "VERIFIED_BEHAVIORAL").length;
  const docPack = /doc_pack:\s*VERIFIED_SCAFFOLD/.test(truth);
  if (verified > 0 && docPack && /behavioral:\s*SPEC_ONLY/.test(truth)) {
    failures.push(
      "contradiction: subphase VERIFIED_BEHAVIORAL while top-level behavioral: SPEC_ONLY",
    );
  }

  if (!/URBAN-ROUTE-MATRIX\.md/.test(truth)) {
    failures.push("truth ledger must reference URBAN-ROUTE-MATRIX.md for 8.1");
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
  };
}

/**
 * Extract YAML front-matter from COP markdown.
 * @param {string} content
 * @returns {Record<string, unknown> | null}
 */
export function parseCopFrontMatter(content) {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("---")) {
    const end = trimmed.indexOf("\n---", 3);
    if (end === -1) return null;
    const block = trimmed.slice(3, end).trim();
    return parseSimpleYaml(block);
  }
  const fence = /^```ya?ml\s*\n([\s\S]*?)\n```/m.exec(trimmed);
  if (fence) {
    return parseSimpleYaml(fence[1]);
  }
  return null;
}

/**
 * Tiny YAML subset parser for COP front-matter (no dependencies).
 * @param {string} block
 * @returns {Record<string, unknown>}
 */
function parseSimpleYaml(block) {
  /** @type {Record<string, unknown>} */
  const out = {};
  /** @type {string | null} */
  let listKey = null;

  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listItem = /^-\s+(.*)$/.exec(trimmed);
    if (listItem && listKey) {
      const arr = /** @type {unknown[]} */ (out[listKey]);
      arr.push(stripQuotes(listItem[1]));
      continue;
    }

    const kv = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (!kv) continue;

    const key = kv[1];
    const value = kv[2].trim();
    listKey = null;

    if (value === "") {
      out[key] = [];
      listKey = key;
    } else if (value.startsWith("[") && value.endsWith("]")) {
      out[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
    } else {
      out[key] = stripQuotes(value);
    }
  }
  return out;
}

function stripQuotes(s) {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * @returns {{ ok: boolean, detail: string | null, currentSubphase?: string }}
 */
export function evaluateP8EripCopPresent() {
  const truthRel = "docs/phase-8/audits/IMPLEMENTATION-TRUTH.md";
  const eripDir = path.join(REPO_ROOT, "docs/phase-8/appendices/erip");

  const truth = readUtf8(truthRel);
  const statuses = parseSubphaseStatuses(truth);
  const behavioral = detectCurrentSubphase(statuses);
  const docReady = parseDocReadySubphase(truth) ?? behavioral;

  const ERIP_MANDATORY = new Set(["8.1", "8.2", "8.3"]);
  let eripSubphase = behavioral;
  if (
    docReady &&
    subphaseNumeric(docReady) >= 8.1 &&
    subphaseNumeric(docReady) <= 8.3
  ) {
    eripSubphase = docReady;
  }

  if (!ERIP_MANDATORY.has(eripSubphase)) {
    return {
      ok: true,
      detail: `ERIP exempt at eripSubphase ${eripSubphase} (mandatory at 8.1–8.3; behavioral ${behavioral})`,
      currentSubphase: behavioral,
    };
  }

  if (!fs.existsSync(eripDir)) {
    return {
      ok: false,
      detail: failToken(
        "p8_erip_cop_present",
        `missing docs/phase-8/appendices/erip/ — COP required for doc_ready/behavioral subphase ${eripSubphase}`,
      ),
      currentSubphase: behavioral,
    };
  }

  const files = fs
    .readdirSync(eripDir)
    .filter((f) => f.endsWith(".md") && f.includes("cop"));

  const prefix = `${eripSubphase.replace(".", "-")}-cop`;
  const match = files.find(
    (f) => f.startsWith(prefix) || f.includes(`${eripSubphase}-cop`),
  );

  if (!match) {
    return {
      ok: false,
      detail: failToken(
        "p8_erip_cop_present",
        `no COP file for subphase ${eripSubphase} in appendices/erip/ (expected pattern ${prefix}-*.md)`,
      ),
      currentSubphase: behavioral,
    };
  }

  const content = fs.readFileSync(path.join(eripDir, match), "utf8");
  const fm = parseCopFrontMatter(content);
  if (!fm) {
    return {
      ok: false,
      detail: failToken(
        "p8_erip_cop_present",
        `${match} missing YAML front-matter (--- block or \`\`\`yaml fence)`,
      ),
      currentSubphase: behavioral,
    };
  }

  const missing = [];
  if (!fm.subphase || String(fm.subphase) !== eripSubphase) {
    missing.push(`subphase must be "${eripSubphase}"`);
  }
  if (!fm.approval_date || String(fm.approval_date).trim() === "") {
    missing.push("approval_date required");
  }
  const urls = fm.vetted_2026_enterprise_source_urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    missing.push("vetted_2026_enterprise_source_urls must be a non-empty list");
  } else {
    for (const u of urls) {
      if (typeof u !== "string" || !/^https?:\/\//.test(u)) {
        missing.push(`invalid URL in vetted_2026_enterprise_source_urls: ${String(u)}`);
      }
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      detail: failToken("p8_erip_cop_present", `${match}: ${missing.join("; ")}`),
      currentSubphase: current,
    };
  }

  return {
    ok: true,
    detail: `COP valid: ${match} for eripSubphase ${eripSubphase} (behavioral ${behavioral})`,
    currentSubphase: behavioral,
  };
}

const PLATFORM_CORE_SKIP_DIRS = new Set(["node_modules", "dist", "coverage"]);

/**
 * REQ-P7-007 / Phase 8 digest lock — sha256 over sorted `relPath\\tfileSha256` lines.
 * @param {string} absDir
 * @returns {Record<string, string>}
 */
function fingerprintPlatformCoreTree(absDir) {
  /** @type {Record<string, string>} */
  const files = {};
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (PLATFORM_CORE_SKIP_DIRS.has(ent.name)) continue;
        walk(abs);
        continue;
      }
      if (ent.name.endsWith(".md")) continue;
      const rel = path.relative(absDir, abs).split(path.sep).join("/");
      files[rel] = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
    }
  };
  walk(absDir);
  return files;
}

/**
 * @param {Record<string, string>} files
 * @returns {string}
 */
function digestPlatformCoreTree(files) {
  const lines = Object.keys(files)
    .sort()
    .map((relPath) => `${relPath}\t${files[relPath]}`);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

/**
 * @param {string} baselineSha
 * @returns {boolean}
 */
function baselineRefExists(baselineSha) {
  const result = spawnSync("git", ["rev-parse", "--verify", `${baselineSha}^{commit}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return result.status === 0;
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
function assertPlatformCoreWorkingTreeClean() {
  const worktree = spawnSync("git", ["diff", "--stat", "--", "packages/platform-core"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (worktree.stdout.trim().length > 0) {
    return {
      ok: false,
      detail: failToken(
        "p8_platform_core_zero_diff",
        `uncommitted platform-core changes: ${worktree.stdout.trim().split("\n").pop()}`,
      ),
    };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {{ ok: boolean, detail: string | null, baselineSha?: string }}
 */
export function evaluateP8PlatformCoreZeroDiff() {
  const baselineCandidates = [
    "reports/phase-8-genericity-baseline.yaml",
    "reports/phase-7-genericity-baseline.yaml",
  ];

  let baselineSha = null;
  let baselineRel = null;
  let baselineRaw = null;
  for (const rel of baselineCandidates) {
    if (!exists(rel)) continue;
    const raw = readUtf8(rel);
    const m = /baseline_sha:\s*(\S+)/.exec(raw);
    if (m) {
      baselineSha = m[1];
      baselineRel = rel;
      baselineRaw = raw;
      break;
    }
  }

  if (!baselineSha || !baselineRel || !baselineRaw) {
    return {
      ok: false,
      detail: failToken(
        "p8_platform_core_zero_diff",
        "no baseline_sha in reports/phase-8-genericity-baseline.yaml or phase-7-genericity-baseline.yaml",
      ),
    };
  }

  const shaResolvable = baselineRefExists(baselineSha);
  if (shaResolvable) {
    const diff = spawnSync(
      "git",
      ["diff", "--stat", baselineSha, "--", "packages/platform-core"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );

    if (diff.status !== 0) {
      return {
        ok: false,
        detail: failToken(
          "p8_platform_core_zero_diff",
          `git diff failed: ${diff.stderr?.trim() || "unknown error"}`,
        ),
        baselineSha,
      };
    }

    const statOut = diff.stdout.trim();
    if (statOut.length > 0) {
      return {
        ok: false,
        detail: failToken(
          "p8_platform_core_zero_diff",
          `INV-P8-001 violated — platform-core diff since ${baselineSha}: ${statOut.split("\n").pop()}`,
        ),
        baselineSha,
      };
    }
  } else {
    const digestMatch = /platform_core_tree_digest:\s*([0-9a-f]{64})/i.exec(baselineRaw);
    if (!digestMatch?.[1]) {
      return {
        ok: false,
        detail: failToken(
          "p8_platform_core_zero_diff",
          `baseline ${baselineSha} not in git and ${baselineRel} missing platform_core_tree_digest`,
        ),
        baselineSha,
      };
    }
    const expectedDigest = digestMatch[1];
    const platformCoreAbs = path.join(REPO_ROOT, "packages/platform-core");
    const currentDigest = digestPlatformCoreTree(fingerprintPlatformCoreTree(platformCoreAbs));
    if (currentDigest !== expectedDigest) {
      return {
        ok: false,
        detail: failToken(
          "p8_platform_core_zero_diff",
          `INV-P8-001 violated — platform-core tree digest drift vs ${baselineRel} (expected ${expectedDigest}, got ${currentDigest})`,
        ),
        baselineSha,
      };
    }
  }

  const worktree = assertPlatformCoreWorkingTreeClean();
  if (!worktree.ok) {
    return { ...worktree, baselineSha };
  }

  const mode = shaResolvable ? `git:${baselineSha}` : `digest:${baselineRel}`;
  return {
    ok: true,
    detail: `platform-core clean via ${mode} and working tree`,
    baselineSha,
  };
}
