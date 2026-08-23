#!/usr/bin/env node
/**
 * Finance golden architecture suite — fail-build forever invariants (G1–G7).
 *
 * @see docs/phase-20/p7/appendices/FINANCE_GOLDEN_ARCHITECTURE_TESTS.md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

/** @type {{ id: string, ok: boolean, detail: string }[]} */
const results = [];

/**
 * @param {string} id
 * @param {boolean} ok
 * @param {string} detail
 */
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${id}: ${detail}`);
}

/**
 * @param {string} rel
 */
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * @param {string} rel
 */
function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

/**
 * @param {string} dir
 * @param {(rel: string, text: string) => void} visit
 */
function walkTs(dir, visit) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, ent.name);
    const rel = path.relative(REPO_ROOT, p).split(path.sep).join("/");
    if (ent.isDirectory()) {
      walkTs(rel, visit);
      continue;
    }
    if (!/\.ts$/.test(ent.name) || ent.name.endsWith(".spec.ts")) continue;
    visit(rel, fs.readFileSync(p, "utf8"));
  }
}

// ── G1–G3: finance-core boundary + depcruise ───────────────────────────────

function runG1G2G3() {
  const boundary = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, "packages/finance-core/scripts/guard-boundary.mjs")],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  const boundaryOk = boundary.status === 0;
  record(
    "G1+G2+G3-boundary",
    boundaryOk,
    boundaryOk
      ? "guard-boundary.mjs PASS (no apps/api, workspace, Prisma, HostIo, …)"
      : (boundary.stderr || boundary.stdout || "guard-boundary failed").trim().slice(0, 500)
  );

  const cruiseScript = path.join(REPO_ROOT, "packages/finance-core/test/cruise-finance-core.mjs");
  const coreSrc = path.join(REPO_ROOT, "packages/finance-core/src");
  const cruise = spawnSync(process.execPath, [cruiseScript, coreSrc], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  let cruiseOk = cruise.status === 0;
  let cruiseDetail = "depcruise finance-core-* rules PASS on packages/finance-core/src";
  if (!cruiseOk) {
    cruiseDetail = (cruise.stdout || cruise.stderr || "depcruise failed").trim().slice(0, 800);
  }
  record("G1+G2+G3-depcruise", cruiseOk, cruiseDetail);

  const pkg = JSON.parse(read("packages/finance-core/package.json"));
  const deps = Object.keys(pkg.dependencies ?? {});
  const onlyContracts = deps.length === 1 && deps[0] === "@app-tour/finance-http-contracts";
  record(
    "G1+G2+G3-package-deps",
    onlyContracts,
    onlyContracts
      ? "finance-core dependencies allowlist: finance-http-contracts only"
      : `unexpected dependencies: ${deps.join(", ") || "(none)"}`
  );
}

// ── G4: Repository boundary ────────────────────────────────────────────────

function runG4() {
  const service = read("packages/finance-core/src/application/finance.service.ts");
  const usesPort =
    /import\s+type\s+\{\s*FinanceRepositoryPort\s*\}\s+from\s+["']\.\.\/ports\/finance-repository\.port["']/.test(
      service
    ) || /FinanceRepositoryPort/.test(service);
  const noPrismaImpl =
    !/PrismaFinanceRepository/.test(service) &&
    !/@prisma\//.test(service) &&
    !/from\s+["']@apps\/api/.test(service);

  let coreLeak = false;
  let leakFile = "";
  walkTs("packages/finance-core/src", (rel, text) => {
    if (/PrismaFinanceRepository/.test(text) || /from\s+["']@prisma\//.test(text)) {
      coreLeak = true;
      leakFile = rel;
    }
    if (/from\s+["'][^"']*prisma-finance\.repository/.test(text)) {
      coreLeak = true;
      leakFile = rel;
    }
  });

  const hostRepo = exists("apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts");
  const ok = usesPort && noPrismaImpl && !coreLeak && hostRepo;
  record(
    "G4-repository-boundary",
    ok,
    ok
      ? "FinanceService → FinanceRepositoryPort; Prisma repo stays in apps/api"
      : `FAIL usesPort=${usesPort} noPrismaImpl=${noPrismaImpl} coreLeak=${coreLeak}${leakFile ? ` @${leakFile}` : ""} hostRepo=${hostRepo}`
  );
}

// ── G5: Capability registration ────────────────────────────────────────────

function runG5() {
  const depReg = "apps/api/src/workspace-finance/finance-dependency-registry.ts";
  const reactReg = "apps/api/src/workspace-finance/finance-event-reaction-registry.ts";
  const depGen =
    "apps/api/src/workspace-finance/workspace-finance-dependency-bindings.generated.ts";
  const reactGen =
    "apps/api/src/workspace-finance/workspace-finance-event-reaction-bindings.generated.ts";

  if (!exists(depReg) || !exists(reactReg) || !exists(depGen) || !exists(reactGen)) {
    record("G5-capability-registration", false, "missing registry or generated binding file");
    return;
  }

  const dep = read(depReg);
  const react = read(reactReg);
  const depG = read(depGen);
  const reactG = read(reactGen);

  const usesGenerated =
    /workspace-finance-dependency-bindings\.generated/.test(dep) &&
    /workspace-finance-event-reaction-bindings\.generated/.test(react);
  const noHandAdapters =
    !/DenaliFinanceLedgerPolicyAdapter|FinanceWs2LedgerPolicyAdapter/.test(dep) &&
    !/from\s+["']@app-tour\/workspace-denali["']/.test(dep) &&
    !/DenaliTourCreatedFinanceReactionAdapter/.test(react) &&
    !/new Map\(\[\[/.test(react);
  const genHasTypes =
    /\bdenali\b\s*:|["']denali["']/.test(depG) &&
    /"finance-ws2"/.test(depG) &&
    /\bdenali\b\s*:|["']denali["']/.test(reactG);

  const ok = usesGenerated && noHandAdapters && genHasTypes;
  record(
    "G5-capability-registration",
    ok,
    ok
      ? "registries resolve via generated bindings; no hand adapter Maps"
      : `FAIL usesGenerated=${usesGenerated} noHandAdapters=${noHandAdapters} genHasTypes=${genHasTypes}`
  );
}

// ── G6: Tenant isolation (static) ──────────────────────────────────────────

function runG6() {
  const rel = "apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts";
  if (!exists(rel)) {
    record("G6-tenant-isolation", false, "prisma-finance.repository.ts missing");
    return;
  }
  const src = read(rel);
  const importsRls = /from\s+["'][^"']*with-tenant-rls["']/.test(src) || /withTenantRls/.test(src);
  const withTenantCalls = (src.match(/\bwithTenantRls\s*\(/g) ?? []).length;
  // Public async methods that take tenantId (heuristic)
  const asyncTenantMethods = (src.match(/async\s+\w+\s*\([^)]*tenantId/g) ?? []).length;
  const enoughRls = withTenantCalls >= Math.min(asyncTenantMethods, 10) && withTenantCalls >= 8;

  // Forbid bare findMany without tenantId nearby on payment (coarse)
  const paymentFindManyOk = !/tx\.payment\.findMany\(\s*\{\s*where:\s*\{\s*status:/.test(src);

  const service = read("packages/finance-core/src/application/finance.service.ts");
  const serviceNoPrisma = !/@prisma\//.test(service) && !/\bprisma\./.test(service);

  const ok = importsRls && enoughRls && paymentFindManyOk && serviceNoPrisma;
  record(
    "G6-tenant-isolation",
    ok,
    ok
      ? `PrismaFinanceRepository uses withTenantRls (${withTenantCalls} calls); FinanceService has no Prisma`
      : `FAIL importsRls=${importsRls} withTenantCalls=${withTenantCalls} asyncTenantMethods=${asyncTenantMethods} paymentFindManyOk=${paymentFindManyOk} serviceNoPrisma=${serviceNoPrisma}`
  );
}

// ── G7: Event neutrality ───────────────────────────────────────────────────

function runG7() {
  const runtimeFiles = [
    "apps/api/src/workspace-finance/process-workspace-finance-outbox.ts",
    "apps/api/src/workspace-finance/prisma-workspace-outbox-reader.ts",
    "apps/api/src/workspace/workspace-tour-created-dispatcher.ts",
    "apps/api/src/workspace-finance/finance-event-reaction-registry.ts",
    "apps/api/src/workspace-finance/infrastructure/prisma-workspace-outbox-writer.ts",
    "apps/api/src/workspace-finance/workspace-finance-processed-log.ts",
    "apps/api/src/workspace-finance/enqueue-finance-ledger-capture.ts",
  ];

  /** @type {string[]} */
  const hits = [];
  for (const rel of runtimeFiles) {
    if (!exists(rel)) {
      hits.push(`missing:${rel}`);
      continue;
    }
    const src = read(rel);
    if (/from\s+["']@app-tour\/workspace-denali/.test(src)) {
      hits.push(`${rel}: workspace-denali import`);
    }
    if (/from\s+["']@app-tour\/workspace-finance-ws/.test(src)) {
      hits.push(`${rel}: workspace-finance-ws* import`);
    }
    if (/runTourCreatedFinanceSideEffect/.test(src)) {
      hits.push(`${rel}: runTourCreatedFinanceSideEffect`);
    }
    if (/consumeDenaliTourCreatedFinanceOutbox/.test(src)) {
      hits.push(`${rel}: consumeDenaliTourCreatedFinanceOutbox`);
    }
  }

  // Require core neutrality files present
  const required = [
    "apps/api/src/workspace-finance/process-workspace-finance-outbox.ts",
    "apps/api/src/workspace-finance/finance-event-reaction-registry.ts",
    "apps/api/src/workspace-finance/enqueue-finance-ledger-capture.ts",
  ];
  const missing = required.filter((r) => !exists(r));

  const ok = hits.length === 0 && missing.length === 0;
  record(
    "G7-event-neutrality",
    ok,
    ok
      ? "generic finance event runtime has zero workspace package imports (FIN-EVENT-NEUTRAL-01)"
      : `FAIL ${[...missing.map((m) => `missing:${m}`), ...hits].join("; ")}`
  );
}

// ── main ───────────────────────────────────────────────────────────────────

console.log("guard-finance-golden-architecture: start\n");
runG1G2G3();
runG4();
runG5();
runG6();
runG7();

const failed = results.filter((r) => !r.ok);
console.log("");
if (failed.length > 0) {
  console.error(`guard-finance-golden-architecture: FAIL (${failed.length} invariant(s))`);
  for (const f of failed) {
    console.error(`  - ${f.id}`);
  }
  process.exit(1);
}

console.log(`guard-finance-golden-architecture: PASS (${results.length} checks)`);
process.exit(0);
