#!/usr/bin/env node
/**
 * PSR-0a — worktree inventory (ops only; not a public root command).
 *
 * Reads `git status --porcelain`, hashes path contents, applies classification
 * heuristics (+ optional overrides), writes YAML snapshot.
 *
 * Usage:
 *   node scripts/ops/psr-0a-inventory.mjs
 *   node scripts/ops/psr-0a-inventory.mjs --out docs/audits/snapshots/2026-07-31/psr-0a-worktree-inventory.yaml
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const CLASSES = new Set([
  "product-change",
  "generated",
  "canonical-doc",
  "evidence",
  "archive",
  "scratch",
  "rebuildable-artifact",
  "secret-review",
]);

const TRAINS = new Set([
  "denali-gravity-harbor",
  "sdk-generated-registry",
  "api-platform-behavior",
  "root-command-analysis",
  "documentation-cleanup",
  "local-scratch-artifact",
  "unclassified",
]);

const ACTIONS = new Set([
  "commit-with-train",
  "regenerate-then-commit",
  "keep-untracked-until-psr1",
  "secret-review-first",
  "defer",
]);

/** Manual overrides for border / multi-train paths. Keys are repo-relative. */
const OVERRIDES = {
  "package.json": {
    class: "product-change",
    change_train: "sdk-generated-registry",
    owner: "platform-architecture",
    psr0b_action: "commit-with-train",
    notes: "Root scripts/deps may span trains; inventory with SDK/registry refresh unless Harbor-only.",
  },
  "pnpm-lock.yaml": {
    class: "product-change",
    change_train: "sdk-generated-registry",
    owner: "platform-architecture",
    psr0b_action: "commit-with-train",
    notes: "Lockfile follows package membership; keep with generate/registry train.",
  },
  "apps/portal/app/login/page.tsx": {
    class: "product-change",
    change_train: "denali-gravity-harbor",
    owner: "guest-surfaces",
    psr0b_action: "commit-with-train",
    notes: "Member login catalog wiring; Gravity/Harbor guest surface train.",
  },
  "apps/portal/src/auth/build-session-cookie.ts": {
    class: "product-change",
    change_train: "api-platform-behavior",
    owner: "portal",
    psr0b_action: "commit-with-train",
    notes: "Session cookie behavior — platform/portal auth, not product branding.",
  },
  "apps/portal/src/shell/portal-providers.tsx": {
    class: "product-change",
    change_train: "denali-gravity-harbor",
    owner: "guest-surfaces",
    psr0b_action: "commit-with-train",
    notes: "Provider shell may register Harbor guest runtime.",
  },
  "apps/portal/src/catalog/public-catalog-registration-flow.tsx": {
    class: "product-change",
    change_train: "denali-gravity-harbor",
    owner: "guest-surfaces",
    psr0b_action: "commit-with-train",
    notes: "Public catalog registration flow shared across guest products.",
  },
  "apps/portal/next.config.ts": {
    class: "product-change",
    change_train: "denali-gravity-harbor",
    owner: "portal",
    psr0b_action: "commit-with-train",
    notes: "Transpile/package membership for guest workspaces.",
  },
  "apps/portal/package.json": {
    class: "product-change",
    change_train: "denali-gravity-harbor",
    owner: "portal",
    psr0b_action: "commit-with-train",
    notes: "Portal package deps for Harbor/guest smoke.",
  },
  "apps/web/package.json": {
    class: "product-change",
    change_train: "denali-gravity-harbor",
    owner: "admin-web",
    psr0b_action: "commit-with-train",
    notes: "Admin web package membership / workspace transpile.",
  },
  "apps/web/app/(app)/finance/page.tsx": {
    class: "product-change",
    change_train: "api-platform-behavior",
    owner: "finance",
    psr0b_action: "commit-with-train",
    notes: "Finance nav/access surface — platform finance, not Harbor G1.",
  },
  "apps/web/src/finance/finance-nav-access.ts": {
    class: "product-change",
    change_train: "api-platform-behavior",
    owner: "finance",
    psr0b_action: "commit-with-train",
    notes: "Finance nav access helper.",
  },
  "apps/web/app/(app)/settings/me/profile-settings-client.tsx": {
    class: "product-change",
    change_train: "api-platform-behavior",
    owner: "admin-web",
    psr0b_action: "commit-with-train",
    notes: "Profile settings client — platform operator UX.",
  },
  "apps/marketing/package.json": {
    class: "product-change",
    change_train: "denali-gravity-harbor",
    owner: "marketing",
    psr0b_action: "commit-with-train",
    notes: "Marketing Harbor smoke scripts/deps.",
  },
  "apps/api/package.json": {
    class: "product-change",
    change_train: "sdk-generated-registry",
    owner: "api",
    psr0b_action: "commit-with-train",
    notes: "API workspace membership should track manifest generate; inventory with registry train.",
  },
  "dependency-cruiser.config.js": {
    class: "product-change",
    change_train: "sdk-generated-registry",
    owner: "platform-architecture",
    psr0b_action: "commit-with-train",
    notes: "Import-boundary allowlists often follow registry/workspace adds.",
  },
  ".github/workflows/phase-0-gate.yml": {
    class: "product-change",
    change_train: "root-command-analysis",
    owner: "ci",
    psr0b_action: "defer",
    notes: "CI gate tweak — defer to PSR-3 unless required for current product train green.",
  },
  ".gitignore": {
    class: "product-change",
    change_train: "local-scratch-artifact",
    owner: "platform-architecture",
    psr0b_action: "defer",
    notes: "Ignore policy belongs with PSR-1 hygiene; do not mix into product commits.",
  },
  "scripts/pre-commit-fast.sh": {
    class: "product-change",
    change_train: "root-command-analysis",
    owner: "platform-architecture",
    psr0b_action: "commit-with-train",
    notes: "Fast-path hook — root-command / DX train.",
  },
  "scripts/test-changed.sh": {
    class: "product-change",
    change_train: "root-command-analysis",
    owner: "platform-architecture",
    psr0b_action: "commit-with-train",
    notes: "Changed-test runner — root-command / DX train.",
  },
  "scripts/workspace-create.mjs": {
    class: "product-change",
    change_train: "sdk-generated-registry",
    owner: "platform-architecture",
    psr0b_action: "commit-with-train",
    notes: "Workspace scaffold entry — registry/create path.",
  },
  "docs/MIGRATION-MAP.md": {
    class: "canonical-doc",
    change_train: "documentation-cleanup",
    owner: "docs",
    psr0b_action: "defer",
    notes: "Roadmap drift — PSR-2 docs authority; do not bury in product train.",
  },
  "bootstrap-server.sh": {
    class: "scratch",
    change_train: "local-scratch-artifact",
    owner: "ops",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Tracked delete candidate for PSR-1b after consumer proof.",
  },
  "remote-deploy.sh": {
    class: "scratch",
    change_train: "local-scratch-artifact",
    owner: "ops",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Tracked delete candidate for PSR-1b after consumer proof.",
  },
  "fix-route.js": {
    class: "scratch",
    change_train: "local-scratch-artifact",
    owner: "scratch",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "One-off helper; PSR-1 delete after zero consumer.",
  },
  "make-jpeg.js": {
    class: "scratch",
    change_train: "local-scratch-artifact",
    owner: "scratch",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Manual fixture helper; PSR-1 delete candidate.",
  },
  "test.jpg": {
    class: "scratch",
    change_train: "local-scratch-artifact",
    owner: "scratch",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Manual fixture blob; PSR-1 delete candidate.",
  },
  "test-proxy.js": {
    class: "scratch",
    change_train: "local-scratch-artifact",
    owner: "scratch",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Debug proxy; PSR-1 delete after formal substitute.",
  },
  "tmp-restart-denali-api.mjs": {
    class: "scratch",
    change_train: "local-scratch-artifact",
    owner: "scratch",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Ad-hoc restart helper; untracked; PSR-1 delete candidate.",
  },
  "tmp-restart-memory-api.mjs": {
    class: "scratch",
    change_train: "local-scratch-artifact",
    owner: "scratch",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Ad-hoc restart helper; untracked; PSR-1 delete candidate.",
  },
  ".cursor/skills/ui-ux-pro-max/scripts/__pycache__/core.cpython-312.pyc": {
    class: "rebuildable-artifact",
    change_train: "local-scratch-artifact",
    owner: "scratch",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Bytecode artifact; should be ignore-policy, not product history.",
  },
  ".cursor/skills/ui-ux-pro-max/scripts/__pycache__/design_system.cpython-312.pyc": {
    class: "rebuildable-artifact",
    change_train: "local-scratch-artifact",
    owner: "scratch",
    psr0b_action: "keep-untracked-until-psr1",
    notes: "Bytecode artifact; should be ignore-policy, not product history.",
  },
};

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256File(absPath) {
  return sha256Buffer(readFileSync(absPath));
}

function headBlobSha(path) {
  try {
    const buf = execFileSync("git", ["show", `HEAD:${path}`], {
      cwd: REPO_ROOT,
      maxBuffer: 64 * 1024 * 1024,
    });
    return sha256Buffer(buf);
  } catch {
    return null;
  }
}

function parsePorcelain(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    // XY PATH or XY ORIG -> PATH for renames
    const xy = line.slice(0, 2);
    const rest = line.slice(3);
    let path = rest;
    let orig_path = null;
    if (rest.includes(" -> ")) {
      const [from, to] = rest.split(" -> ");
      orig_path = from;
      path = to;
    }
    // Prefer working-tree status (second char) when present; else index.
    const wt = xy[1] === " " ? xy[0] : xy[1];
    let git_status = xy.trim();
    if (xy === "??") git_status = "??";
    else if (xy[0] === "D" || xy[1] === "D") git_status = "D";
    else if (xy[0] === "A" || xy[1] === "A") git_status = "A";
    else if (xy.includes("M")) git_status = "M";
    else git_status = xy.trim() || wt;
    rows.push({ path, orig_path, git_status, xy });
  }
  return rows;
}

function isGeneratedPath(path) {
  return (
    path.includes(".generated.") ||
    /(?:^|\/)generated\//.test(path) ||
    /\/generated\/[^/]+\.generated\./.test(path)
  );
}

function classify(path, git_status) {
  if (OVERRIDES[path]) {
    return { ...OVERRIDES[path], classification_source: "override" };
  }

  // secret-ish
  if (
    /(^|\/)\.env(\.|$)/.test(path) ||
    /\.(pem|key|p12|pfx)$/i.test(path) ||
    /credentials/i.test(path)
  ) {
    return {
      class: "secret-review",
      change_train: "local-scratch-artifact",
      owner: "security",
      psr0b_action: "secret-review-first",
      notes: "Credential-shaped path; do not commit without review.",
      classification_source: "heuristic",
    };
  }

  if (isGeneratedPath(path)) {
    return {
      class: "generated",
      change_train: "sdk-generated-registry",
      owner: "codegen",
      psr0b_action: "regenerate-then-commit",
      notes: "Owned by workspace-registry / manifest codegen; regenerate in PSR-0b.",
      classification_source: "heuristic",
    };
  }

  // Root ad-hoc / deleted helpers
  if (
    /^(tmp-|fix-route\.js$|make-jpeg\.js$|test-proxy\.js$|test\.jpg$|bootstrap-server\.sh$|remote-deploy\.sh$)/.test(
      path,
    )
  ) {
    return {
      class: "scratch",
      change_train: "local-scratch-artifact",
      owner: "scratch",
      psr0b_action: "keep-untracked-until-psr1",
      notes: "Root ad-hoc / delete candidate; PSR-1 after consumer proof.",
      classification_source: "heuristic",
    };
  }

  if (path.includes("__pycache__") || /\.(pyc|tsbuildinfo)$/.test(path)) {
    return {
      class: "rebuildable-artifact",
      change_train: "local-scratch-artifact",
      owner: "scratch",
      psr0b_action: "keep-untracked-until-psr1",
      notes: "Rebuildable local artifact.",
      classification_source: "heuristic",
    };
  }

  // Root-command analysis pack
  if (/^docs\/platform\/ROOT_COMMAND_/.test(path)) {
    return {
      class: "evidence",
      change_train: "root-command-analysis",
      owner: "platform-architecture",
      psr0b_action: "commit-with-train",
      notes: "Root-command classification evidence; consolidate in PSR-2/3.",
      classification_source: "heuristic",
    };
  }

  // Architecture / remediation docs
  if (
    /^docs\/architecture\//.test(path) ||
    /^docs\/audits\//.test(path) ||
    /^docs\/workspaces\/harbor\//.test(path)
  ) {
    const isRemediation =
      /remediation|simplification|gravity|certification/i.test(path);
    return {
      class: isRemediation ? "canonical-doc" : "evidence",
      change_train: "documentation-cleanup",
      owner: "docs",
      psr0b_action: "commit-with-train",
      notes: "Architecture/audit documentation for PSR / Gravity / Harbor.",
      classification_source: "heuristic",
    };
  }

  if (/^docs\//.test(path)) {
    return {
      class: "canonical-doc",
      change_train: "documentation-cleanup",
      owner: "docs",
      psr0b_action: "defer",
      notes: "Docs change — prefer PSR-2 unless required by a product train.",
      classification_source: "heuristic",
    };
  }

  // Gravity guards / clone tests
  if (
    /guard-denali-gravity|denali-gravity|fast-path-contract|benchmark-pre-commit|resolve-web-test-specs/.test(
      path,
    )
  ) {
    return {
      class: "product-change",
      change_train: "denali-gravity-harbor",
      owner: "platform-architecture",
      psr0b_action: "commit-with-train",
      notes: "Denali Gravity guard / DX contract.",
      classification_source: "heuristic",
    };
  }

  // Harbor / workspace products / guest runtime
  if (
    /^packages\/workspaces\//.test(path) ||
    /^packages\/guest-workspace-runtime\//.test(path) ||
    /^packages\/guest-surface-host\//.test(path) ||
    /harbor/i.test(path) ||
    /marketing-harbor|smoke-marketing-harbor|register-harbor|ensure-registration-flow/.test(
      path,
    )
  ) {
    return {
      class: "product-change",
      change_train: "denali-gravity-harbor",
      owner: path.includes("/harbor") ? "workspace-harbor" : "workspace-denali",
      psr0b_action: "commit-with-train",
      notes: "Workspace / guest-surface product change.",
      classification_source: "heuristic",
    };
  }

  // SDK (non-generated)
  if (
    /^packages\/workspace-sdk\//.test(path) ||
    /^packages\/workspace-plugin-host\//.test(path) ||
    /^packages\/platform-core\//.test(path) ||
    /^scripts\/codegen\//.test(path)
  ) {
    return {
      class: "product-change",
      change_train: "sdk-generated-registry",
      owner: path.includes("platform-core") ? "platform-core" : "workspace-sdk",
      psr0b_action: "commit-with-train",
      notes: "SDK / plugin-host / codegen source (non-generated or generator).",
      classification_source: "heuristic",
    };
  }

  // API
  if (/^apps\/api\//.test(path)) {
    return {
      class: "product-change",
      change_train: "api-platform-behavior",
      owner: "api",
      psr0b_action: "commit-with-train",
      notes: "API host behavior / bindings.",
      classification_source: "heuristic",
    };
  }

  // Portal / marketing / web guest messages often gravity-related
  if (/^apps\/(portal|marketing|web)\//.test(path)) {
    if (/finance|profile-settings|i18n-routing|denali-composite/.test(path)) {
      return {
        class: "product-change",
        change_train: /finance|profile-settings/.test(path)
          ? "api-platform-behavior"
          : "denali-gravity-harbor",
        owner: path.startsWith("apps/web") ? "admin-web" : "guest-surfaces",
        psr0b_action: "commit-with-train",
        notes: "App surface change classified by feature keyword.",
        classification_source: "heuristic",
      };
    }
    return {
      class: "product-change",
      change_train: "denali-gravity-harbor",
      owner: path.startsWith("apps/marketing")
        ? "marketing"
        : path.startsWith("apps/portal")
          ? "portal"
          : "admin-web",
      psr0b_action: "commit-with-train",
      notes: "Guest/admin app surface; default Gravity/Harbor train.",
      classification_source: "heuristic",
    };
  }

  if (/^scripts\//.test(path)) {
    return {
      class: "product-change",
      change_train: "root-command-analysis",
      owner: "platform-architecture",
      psr0b_action: "commit-with-train",
      notes: "Script / guard change under scripts/.",
      classification_source: "heuristic",
    };
  }

  if (/^\.github\//.test(path)) {
    return {
      class: "product-change",
      change_train: "root-command-analysis",
      owner: "ci",
      psr0b_action: "defer",
      notes: "CI workflow — defer into PSR-3 unless blocking.",
      classification_source: "heuristic",
    };
  }

  return {
    class: "product-change",
    change_train: "unclassified",
    owner: "platform-architecture",
    psr0b_action: "defer",
    notes: "Heuristic miss — must be assigned before PSR-0a exit gate.",
    classification_source: "heuristic",
  };
}

function yamlEscape(s) {
  if (s == null) return "null";
  const str = String(s);
  if (/^[\w./@+-]+$/.test(str) && !["true", "false", "null"].includes(str)) {
    return str;
  }
  return JSON.stringify(str);
}

function emitYaml(doc) {
  const lines = [];
  lines.push(`# Generated by scripts/ops/psr-0a-inventory.mjs — do not hand-edit bulk rows.`);
  lines.push(`# Overrides live in the script OVERRIDES map; re-run after porcelain changes.`);
  lines.push(`schema_version: ${doc.schema_version}`);
  lines.push(`program_id: ${doc.program_id}`);
  lines.push(`wave: ${doc.wave}`);
  lines.push(`captured_at: ${yamlEscape(doc.captured_at)}`);
  lines.push(`branch: ${yamlEscape(doc.branch)}`);
  lines.push(`head_sha: ${doc.head_sha}`);
  lines.push(`staged_count: ${doc.staged_count}`);
  lines.push(`totals:`);
  for (const [k, v] of Object.entries(doc.totals)) {
    lines.push(`  ${k}: ${v}`);
  }
  lines.push(`by_change_train:`);
  for (const [k, v] of Object.entries(doc.by_change_train).sort()) {
    lines.push(`  ${k}: ${v}`);
  }
  lines.push(`by_class:`);
  for (const [k, v] of Object.entries(doc.by_class).sort()) {
    lines.push(`  ${k}: ${v}`);
  }
  lines.push(`generated_paths:`);
  for (const p of doc.generated_paths) {
    lines.push(`  - ${yamlEscape(p)}`);
  }
  lines.push(`unclassified_paths:`);
  if (doc.unclassified_paths.length === 0) {
    lines.push(`  []`);
  } else {
    for (const p of doc.unclassified_paths) {
      lines.push(`  - ${yamlEscape(p)}`);
    }
  }
  lines.push(`ignored_scratch_summary:`);
  for (const [k, v] of Object.entries(doc.ignored_scratch_summary)) {
    if (typeof v === "number") {
      lines.push(`  ${k}: ${v}`);
    } else if (typeof v === "boolean") {
      lines.push(`  ${k}: ${v ? "true" : "false"}`);
    } else {
      lines.push(`  ${k}: ${yamlEscape(v)}`);
    }
  }
  lines.push(`entries:`);
  for (const e of doc.entries) {
    lines.push(`  - path: ${yamlEscape(e.path)}`);
    lines.push(`    git_status: ${yamlEscape(e.git_status)}`);
    lines.push(`    content_sha256: ${e.content_sha256 == null ? "null" : e.content_sha256}`);
    lines.push(`    head_sha256: ${e.head_sha256 == null ? "null" : e.head_sha256}`);
    lines.push(`    class: ${e.class}`);
    lines.push(`    change_train: ${e.change_train}`);
    lines.push(`    owner: ${yamlEscape(e.owner)}`);
    lines.push(`    psr0b_action: ${e.psr0b_action}`);
    lines.push(`    classification_source: ${e.classification_source}`);
    lines.push(`    notes: ${yamlEscape(e.notes)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function countTree(relDir) {
  const abs = join(REPO_ROOT, relDir);
  if (!existsSync(abs)) return { present: false, file_count: 0 };
  let count = 0;
  const stack = [abs];
  while (stack.length) {
    const cur = stack.pop();
    let st;
    try {
      st = statSync(cur);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      let names;
      try {
        names = readdirSync(cur);
      } catch {
        continue;
      }
      for (const name of names) {
        if (name === "node_modules" || name === ".git" || name === "dist") continue;
        stack.push(join(cur, name));
      }
    } else if (st.isFile()) {
      count += 1;
    }
  }
  return { present: true, file_count: count };
}

function main() {
  const outArgIdx = process.argv.indexOf("--out");
  const outRel =
    outArgIdx >= 0
      ? process.argv[outArgIdx + 1]
      : "docs/audits/snapshots/2026-07-31/psr-0a-worktree-inventory.yaml";
  const outAbs = resolve(REPO_ROOT, outRel);

  const head_sha = git(["rev-parse", "HEAD"]).trim();
  const branch = git(["branch", "--show-current"]).trim();
  const captured_at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  // -uall expands untracked directories so Harbor package files are inventoried.
  const porcelain = git(["status", "--porcelain", "-uall"]);
  const staged = git(["diff", "--cached", "--name-only"])
    .split("\n")
    .filter(Boolean);

  const rows = parsePorcelain(porcelain);
  const entries = [];

  for (const row of rows) {
    const abs = join(REPO_ROOT, row.path);
    const cls = classify(row.path, row.git_status);
    if (!CLASSES.has(cls.class)) {
      throw new Error(`invalid class for ${row.path}: ${cls.class}`);
    }
    if (!TRAINS.has(cls.change_train)) {
      throw new Error(`invalid train for ${row.path}: ${cls.change_train}`);
    }
    if (!ACTIONS.has(cls.psr0b_action)) {
      throw new Error(`invalid action for ${row.path}: ${cls.psr0b_action}`);
    }

    let content_sha256 = null;
    if (row.git_status !== "D" && existsSync(abs)) {
      try {
        const st = statSync(abs);
        if (st.isFile()) content_sha256 = sha256File(abs);
        else content_sha256 = null; // directory untracked — note in notes
      } catch {
        content_sha256 = null;
      }
    }
    const head_sha256 = row.git_status === "??" ? null : headBlobSha(row.path);

    let notes = cls.notes;
    if (row.git_status === "??" && existsSync(abs) && statSync(abs).isDirectory()) {
      notes = `${notes} Untracked directory; hash null (enumerate children via status if expanded).`;
    }

    entries.push({
      path: row.path,
      git_status: row.git_status,
      content_sha256,
      head_sha256,
      class: cls.class,
      change_train: cls.change_train,
      owner: cls.owner,
      psr0b_action: cls.psr0b_action,
      classification_source: cls.classification_source,
      notes,
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));

  const totals = {
    porcelain_records: entries.length,
    modified: entries.filter((e) => e.git_status === "M").length,
    deleted: entries.filter((e) => e.git_status === "D").length,
    untracked: entries.filter((e) => e.git_status === "??").length,
    generated: entries.filter((e) => e.class === "generated").length,
    missing_owner: entries.filter((e) => !e.owner).length,
    missing_class: entries.filter((e) => !e.class).length,
    unclassified_train: entries.filter((e) => e.change_train === "unclassified")
      .length,
  };

  const by_change_train = {};
  const by_class = {};
  for (const e of entries) {
    by_change_train[e.change_train] = (by_change_train[e.change_train] || 0) + 1;
    by_class[e.class] = (by_class[e.class] || 0) + 1;
  }

  const generated_paths = entries
    .filter((e) => e.class === "generated")
    .map((e) => e.path);
  const unclassified_paths = entries
    .filter((e) => e.change_train === "unclassified")
    .map((e) => e.path);

  const temp = countTree("TEMP");
  const tempLower = countTree("temp");
  const docsTemp = countTree("docs/temp");
  const tmp = countTree("tmp");

  const doc = {
    schema_version: 1,
    program_id: "PSR-001",
    wave: "PSR-0a",
    captured_at,
    branch,
    head_sha,
    staged_count: staged.length,
    totals,
    by_change_train,
    by_class,
    generated_paths,
    unclassified_paths,
    ignored_scratch_summary: {
      note: "Ignored trees are not porcelain; counts are on-disk file totals excluding node_modules/dist.",
      TEMP_present: temp.present,
      TEMP_file_count: temp.file_count,
      temp_present: tempLower.present,
      temp_file_count: tempLower.file_count,
      docs_temp_present: docsTemp.present,
      docs_temp_file_count: docsTemp.file_count,
      tmp_present: tmp.present,
      tmp_file_count: tmp.file_count,
    },
    entries,
  };

  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, emitYaml(doc), "utf8");

  const relOut = relative(REPO_ROOT, outAbs);
  console.log(`Wrote ${relOut}`);
  console.log(JSON.stringify(totals, null, 2));
  if (unclassified_paths.length) {
    console.error("UNCLASSIFIED PATHS:");
    for (const p of unclassified_paths) console.error(`  - ${p}`);
    process.exitCode = 2;
  }
  if (totals.missing_owner || totals.missing_class) {
    console.error("Missing owner/class rows present.");
    process.exitCode = 2;
  }
}

main();
