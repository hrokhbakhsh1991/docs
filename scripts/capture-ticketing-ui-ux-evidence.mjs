#!/usr/bin/env node
/**
 * FDA-001 — Deterministic ticketing UI/UX before/after evidence capture.
 *
 * Root cause (F-001): TICKETING_UI_UX_PHASE only changed the output directory while
 * Playwright always ran against HEAD. Both phases were captured after remediation.
 *
 * Fix: for BEFORE, temporarily check out merge-base UI files on the locked branch,
 * restart smoke servers, capture, then restore HEAD before AFTER capture.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BEFORE_REF = process.env.TICKETING_UI_UX_BEFORE_REF?.trim() || "b29244f2";
const OUT_ROOT = process.env.TICKETING_UI_UX_OUT_ROOT?.trim() || "/opt/cursor/artifacts/screenshots/ticketing-ui-ux";
const HASH_MANIFEST = join(OUT_ROOT, "hash-manifest.json");

const UX_PATH_SCOPES = [
  "apps/portal",
  "apps/web/src/features/tickets",
  "apps/web/messages",
  "packages/workspaces/denali/theme/portal/member-pages.css",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

function assertCleanTree() {
  const status = gitOutput(["status", "--porcelain"]);
  if (status.length > 0) {
    console.error("capture-ticketing-ui-ux-evidence: working tree must be clean before capture.");
    console.error(status);
    process.exit(1);
  }
}

function resolveRef(ref) {
  return gitOutput(["rev-parse", ref]);
}

function listUxPaths() {
  const args = ["diff", "--name-only", BEFORE_REF, "HEAD", "--", ...UX_PATH_SCOPES];
  return gitOutput(args)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function pathExistsAtRef(ref, path) {
  const result = spawnSync("git", ["cat-file", "-e", `${ref}:${path}`], {
    cwd: ROOT,
    stdio: "ignore",
  });
  return result.status === 0;
}

function checkoutUxSnapshot(ref) {
  const paths = listUxPaths().filter((path) => pathExistsAtRef(ref, path));
  if (paths.length === 0) {
    console.log(`checkoutUxSnapshot: no UX paths present at ${ref}`);
    return;
  }
  console.log(`checkoutUxSnapshot: ${ref} (${paths.length} path(s))`);
  run("git", ["checkout", ref, "--", ...paths]);
}

function restoreHeadUx() {
  const paths = listUxPaths();
  if (paths.length === 0) {
    return;
  }
  run("git", ["checkout", "HEAD", "--", ...paths]);
}

function stopSmokePorts() {
  spawnSync(
    "bash",
    [
      "-lc",
      `for port in 3000 3001 3003; do
  if command -v netstat >/dev/null 2>&1; then
    netstat -tlnp 2>/dev/null | awk -v port=":" port " " '$4 ~ port { gsub(/.*\\/|\\).*/, "", $7); if ($7 ~ /^[0-9]+$/) print $7 }' | sort -u | xargs -r kill -9
  fi
  lsof -ti :$port | xargs -r kill -9
done
sleep 2`,
    ],
    { cwd: ROOT, stdio: "ignore" },
  );
}

function runPlaywrightPhase({ appRelativeDir, phase }) {
  run(
    "pnpm",
    ["--dir", join(ROOT, appRelativeDir), "exec", "playwright", "test", "-c", "playwright.ticketing-ui-ux.config.ts"],
    {
      cwd: ROOT,
      env: {
        TICKETING_UI_UX_PHASE: phase,
        PW_NO_REUSE_SERVER: "1",
      },
    },
  );
}

function capturePhase(phase) {
  console.log(`\n=== capture phase: ${phase} ===\n`);
  runPlaywrightPhase({ appRelativeDir: "apps/portal", phase });
  runPlaywrightPhase({ appRelativeDir: "apps/web", phase });
}

function sha256File(path) {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

function listPngFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  const results = [];
  for (const viewportDir of readdirSync(dir, { withFileTypes: true })) {
    if (!viewportDir.isDirectory()) continue;
    const viewportPath = join(dir, viewportDir.name);
    for (const file of readdirSync(viewportPath, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith(".png")) continue;
      const fullPath = join(viewportPath, file.name);
      results.push({
        phase: basename(dir),
        viewport: viewportDir.name,
        filename: file.name,
        path: fullPath,
        size: statSync(fullPath).size,
        hash: sha256File(fullPath),
      });
    }
  }
  return results;
}

function compareManifest(beforeFiles, afterFiles) {
  const afterByKey = new Map(afterFiles.map((entry) => [`${entry.viewport}/${entry.filename}`, entry]));
  const rows = [];
  for (const before of beforeFiles) {
    const key = `${before.viewport}/${before.filename}`;
    const after = afterByKey.get(key);
    if (!after) {
      rows.push({
        viewport: before.viewport,
        filename: before.filename,
        beforeSize: before.size,
        afterSize: null,
        beforeHash: before.hash,
        afterHash: null,
        identical: false,
        note: "missing after",
      });
      continue;
    }
    rows.push({
      viewport: before.viewport,
      filename: before.filename,
      beforeSize: before.size,
      afterSize: after.size,
      beforeHash: before.hash,
      afterHash: after.hash,
      identical: before.hash === after.hash,
      note: before.hash === after.hash ? "byte-identical" : "differs",
    });
  }
  return rows;
}

function main() {
  const lockedBranch = gitOutput(["branch", "--show-current"]);
  const headSha = resolveRef("HEAD");
  const beforeSha = resolveRef(BEFORE_REF);

  console.log("capture-ticketing-ui-ux-evidence");
  console.log(`  branch: ${lockedBranch}`);
  console.log(`  HEAD: ${headSha}`);
  console.log(`  BEFORE_REF: ${BEFORE_REF} (${beforeSha})`);
  console.log(`  OUT_ROOT: ${OUT_ROOT}`);

  assertCleanTree();

  rmSync(join(OUT_ROOT, "before"), { recursive: true, force: true });
  rmSync(join(OUT_ROOT, "after"), { recursive: true, force: true });
  mkdirSync(OUT_ROOT, { recursive: true });

  try {
    stopSmokePorts();
    checkoutUxSnapshot(BEFORE_REF);
    capturePhase("before");

    restoreHeadUx();
    stopSmokePorts();
    capturePhase("after");
  } finally {
    restoreHeadUx();
  }

  const beforeFiles = listPngFiles(join(OUT_ROOT, "before"));
  const afterFiles = listPngFiles(join(OUT_ROOT, "after"));
  const comparison = compareManifest(beforeFiles, afterFiles);

  const manifest = {
    capturedAt: new Date().toISOString(),
    branch: lockedBranch,
    headSha,
    beforeRef: BEFORE_REF,
    beforeSha,
    outRoot: OUT_ROOT,
    method: "git-checkout-ui-snapshot-on-locked-branch",
    before: beforeFiles,
    after: afterFiles,
    comparison,
  };

  writeFileSync(HASH_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log("\n=== screenshot hash comparison ===\n");
  for (const row of comparison) {
    console.log(
      `${row.viewport}/${row.filename}: before=${row.beforeHash?.slice(0, 12)}… (${row.beforeSize}b) | after=${row.afterHash?.slice(0, 12)}… (${row.afterSize}b) | ${row.note}`,
    );
  }

  const identicalCount = comparison.filter((row) => row.identical).length;
  if (identicalCount > 0) {
    console.error(`\nWARNING: ${identicalCount} before/after pair(s) are byte-identical.`);
    process.exit(2);
  }

  console.log("\ncapture-ticketing-ui-ux-evidence: PASS — all comparable pairs differ.");
}

main();
