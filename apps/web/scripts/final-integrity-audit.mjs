#!/usr/bin/env node
/**
 * Final Integrity Audit runner (Denali architecture).
 * Usage: node apps/web/scripts/final-integrity-audit.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..");

const findings = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function checkImports() {
  const targets = [
    {
      name: "DenaliTourEditForm",
      path: join(WEB_ROOT, "src/components/tours/DenaliTourEditForm.tsx"),
    },
    {
      name: "DenaliCreateTourWizard",
      path: join(WEB_ROOT, "src/components/tours/wizard/DenaliCreateTourWizard.tsx"),
    },
  ];
  const stepsPattern = /wizard\/denali\/steps\//;
  for (const t of targets) {
    const src = read(t.path);
    const directSteps = stepsPattern.test(src);
    if (directSteps) {
      findings.push({
        gate: "1-import-audit",
        status: "FAIL",
        detail: `${t.name} has direct import from wizard/denali/steps/*`,
      });
    } else {
      findings.push({
        gate: "1-import-audit",
        status: "PASS",
        detail: `${t.name}: zero direct wizard/denali/steps/* imports`,
      });
    }
    if (t.name === "DenaliCreateTourWizard" && /DenaliBasicInfoStep|DenaliProgramNatureStep/.test(src)) {
      findings.push({
        gate: "1-import-audit-transitive",
        status: "WARN",
        detail:
          `${t.name} still imports step components via @/features/tours/wizard/denali barrel (re-exports steps/)`,
      });
    }
    if (t.name === "DenaliTourEditForm" && /DenaliSection/.test(src)) {
      const sectionDir = join(WEB_ROOT, "src/features/tours/denali/sections");
      let transitive = false;
      for (const file of readdirSync(sectionDir)) {
        if (!file.endsWith(".tsx")) continue;
        if (stepsPattern.test(read(join(sectionDir, file)))) {
          transitive = true;
          break;
        }
      }
      if (transitive) {
        findings.push({
          gate: "1-import-audit-transitive",
          status: "WARN",
          detail:
            "DenaliTourEditForm → DenaliSection → denali/sections/* still imports wizard/denali/steps/* sub-widgets",
        });
      }
    }
  }
}

function checkRegistryParity() {
  const audit = spawnSync("pnpm", ["--filter", "web", "audit:denali-registry"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (audit.status !== 0) {
    findings.push({
      gate: "2-registry-parity",
      status: "FAIL",
      detail: `audit:denali-registry exited ${audit.status}`,
    });
    return;
  }
  findings.push({
    gate: "2-registry-parity",
    status: "PASS",
    detail: "pnpm --filter web audit:denali-registry succeeded",
  });
}

function checkPlugin() {
  const plugin = read(
    join(WEB_ROOT, "src/features/tours/wizard/denali/plugins/DenaliTemplateSelectorPlugin.tsx"),
  );
  const wizard = read(join(WEB_ROOT, "src/components/tours/wizard/DenaliCreateTourWizard.tsx"));
  if (!/activeStepId === "denali_basic"/.test(plugin)) {
    findings.push({
      gate: "5-plugin",
      status: "FAIL",
      detail: "DenaliTemplateSelectorPlugin missing denali_basic guard",
    });
  } else {
    findings.push({
      gate: "5-plugin-shouldRender",
      status: "PASS",
      detail: "Plugin gated to denali_basic",
    });
  }
  if (
    !/onCanonicalSync:\s*\(\)\s*=>\s*setCanonicalSyncToken/.test(wizard) ||
    !/denaliTemplateSelectorPlugin/.test(wizard)
  ) {
    findings.push({
      gate: "5-plugin-sync",
      status: "FAIL",
      detail: "Create wizard missing template plugin or canonicalSyncToken bump wiring",
    });
  } else {
    findings.push({
      gate: "5-plugin-sync",
      status: "PASS",
      detail: "onCanonicalSync bumps canonicalSyncToken in DenaliCreateTourWizard",
    });
  }
  const edit = read(join(WEB_ROOT, "src/components/tours/DenaliTourEditForm.tsx"));
  if (/DenaliWizardHeaderPlugins|CREATE_PLUGINS/.test(edit)) {
    findings.push({
      gate: "5-plugin-edit",
      status: "FAIL",
      detail: "DenaliTourEditForm registers header plugins (should be empty/none)",
    });
  } else {
    findings.push({
      gate: "5-plugin-edit",
      status: "PASS",
      detail: "DenaliTourEditForm does not register plugins",
    });
  }
}

async function main() {
  checkImports();
  checkRegistryParity();
  checkPlugin();

  const draftResult = spawnSync("pnpm", ["exec", "tsx", "scripts/denali-draft-navigation-stability.ts"], {
    cwd: WEB_ROOT,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (draftResult.stdout) process.stdout.write(draftResult.stdout);
  if (draftResult.stderr) process.stderr.write(draftResult.stderr);
  if (draftResult.status === 0) {
    findings.push({ gate: "4-draft-memory", status: "PASS", detail: draftResult.stdout.trim().split("\n").pop() });
  } else {
    findings.push({ gate: "4-draft-memory", status: "FAIL", detail: "draft navigation stability script failed" });
  }

  const benchResult = spawnSync("pnpm", ["exec", "tsx", "src/features/tours/denali/__benchmarks__/denali-section-mount.bench.ts"], {
    cwd: WEB_ROOT,
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env, TOUR_UI_SKIP_STYLES: "1" },
  });
  if (benchResult.stdout) process.stdout.write(benchResult.stdout);
  if (benchResult.stderr) process.stderr.write(benchResult.stderr);
  if (benchResult.status === 0) {
    findings.push({ gate: "3-section-perf", status: "PASS", detail: benchResult.stdout.trim().split("\n").find((l) => l.includes("meanMs")) ?? "ok" });
  } else {
    findings.push({ gate: "3-section-perf", status: "FAIL", detail: "DenaliSection mount bench failed or exceeded 100ms" });
  }

  const failed = findings.filter((f) => f.status === "FAIL");
  console.log("\n=== Final Integrity Audit ===\n");
  for (const f of findings) {
    console.log(`[${f.status}] ${f.gate}: ${f.detail}`);
  }
  console.log(`\nTotal: ${findings.length} checks, ${failed.length} failures, ${findings.filter((f) => f.status === "WARN").length} warnings`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
