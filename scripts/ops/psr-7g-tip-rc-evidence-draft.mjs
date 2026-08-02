#!/usr/bin/env node
/**
 * PSR-7g — Assemble tip RC evidence draft (all program_gates false).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outPath = join(root, "reports/psr/rc-evidence-draft.json");

function runNode(scriptArgs) {
  const r = spawnSync(process.execPath, scriptArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`${scriptArgs.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout || "";
}

/** Parse JSON from mixed log+json stdout (object spanning lines or last `{...}` line). */
function parseJsonFromStdout(stdout) {
  const text = (stdout || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith("{") && lines[i].endsWith("}")) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        /* continue */
      }
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new Error("no JSON object in collector stdout");
}

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error("git rev-parse failed");
  return (r.stdout || "").trim();
}

async function main() {
  const sha = gitSha();

  const scoreOut = runNode([
    join(root, "scripts/ops/psr-9-closure-scorecard-collect.mjs"),
    "--scorecard",
    "docs/audits/snapshots/2026-07-31/psr-9b-closure-scorecard.yaml",
    "--json",
  ]);
  const score = parseJsonFromStdout(scoreOut);

  const secOut = runNode([
    join(root, "scripts/ops/secret-scan-tracked-baseline.mjs"),
    "--json",
  ]);
  const sec = parseJsonFromStdout(secOut);

  mkdirSync(join(root, "reports/psr"), { recursive: true });
  const sbomOut = join(root, "reports/psr/app-tour.cdx.json");
  runNode([join(root, "scripts/ops/sbom-from-pnpm-lock.mjs"), "--out", sbomOut]);
  const sbom = JSON.parse(readFileSync(sbomOut, "utf8"));
  const lockSha = (sbom.metadata?.properties || []).find(
    (p) => p.name === "psr.lockfile_sha256",
  )?.value;

  const checksMod = await import(
    pathToFileURL(join(root, "scripts/ops/main-branch-required-checks.mjs")).href,
  );

  const harbor = JSON.parse(
    readFileSync(
      join(root, "packages/workspaces/harbor/workspace.manifest.json"),
      "utf8",
    ),
  );

  const pack = {
    schema_version: "psr-7e.1",
    program_id: "PSR-001",
    git_sha: sha.slice(0, 40),
    collected_at: new Date().toISOString(),
    program_gates: {
      psr5_item7_same_sha_live: false,
      psr6_harbor_certified: false,
      psr7_release_ready: false,
      psr8_publication_ready: false,
      psr9_closure: false,
    },
    artifacts: {
      scorecard: {
        path: "reports/psr/closure-scorecard-latest.json",
        meets_all_targets: Boolean(score.meets_all_targets),
      },
      secret_scan: {
        tracked_open_count: sec.open_count ?? 0,
        allowlisted_count: sec.allowlisted_count ?? 0,
        history_complete: false,
      },
      sbom: {
        generator: "scripts/ops/sbom-from-pnpm-lock.mjs",
        bom_format: sbom.bomFormat,
        spec_version: sbom.specVersion,
        lockfile_sha256: lockSha || "",
        component_count: Array.isArray(sbom.components) ? sbom.components.length : 0,
        provenance_included: false,
      },
      branch_protection: {
        print_only_complete: true,
        live_verify_complete: false,
        required_checks: checksMod.MAIN_BRANCH_REQUIRED_CHECKS,
      },
      staging: {
        live_pack_complete: false,
        four_process_smoke: false,
        restore_drill: false,
        harbor_durable_e2e: false,
      },
      harbor: {
        production_tier: harbor?.guestConformance?.productionTier || "unknown",
        live_durable_pack_complete: false,
        seed_e2e_only: true,
      },
      ops_identity: {
        model: "shared_env_bearer",
        design_wave: "PSR-7d-ops-identity-design",
      },
    },
    notes:
      "PSR-7g tip draft — program_gates all false; not a release candidate.",
  };

  writeFileSync(outPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  console.log(
    `psr-7g-tip-rc-evidence-draft: OK — sha=${pack.git_sha.slice(0, 8)} out=reports/psr/rc-evidence-draft.json gates=all_false`,
  );
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(pack));
  }
  return pack;
}

try {
  await main();
} catch (err) {
  console.error(`psr-7g-tip-rc-evidence-draft: ERROR — ${err.message || err}`);
  process.exit(2);
}
