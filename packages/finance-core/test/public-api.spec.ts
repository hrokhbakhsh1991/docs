/**
 * Phase 2.3.3 — finance-core frozen public API boundary.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_SRC = join(PKG, "src/index.ts");
const PKG_JSON = join(PKG, "package.json");
const DIST_INDEX = join(PKG, "dist/index.js");

const ALLOWED_EXPORT_KEYS = [".", "./ports", "./domain", "./application", "./package.json"];

const REQUIRED_RUNTIME = [
  "FinanceService",
  "createFinanceService",
  "hashFinanceHttpIdempotencyKey",
  "buildPrepaymentDomainEventIds",
  "buildPaymentScheduleItems",
  "compileRegistrationInvoice",
  "attachFinanceRegistrationContext",
  "filterRowsByRegistrationId",
  "FINANCE_METRIC",
  "FINANCE_LATENCY_BUDGET_MS",
] as const;

const FORBIDDEN_IN_INDEX =
  /Prisma|HostFinance|@apps\/api|apps\/api|workspace-denali|workspace-finance-ws|\.generated|InMemoryFinanceRepository|from ["']\.\.\/test/;

describe("FIN-P2.3.3 finance-core public API freeze", () => {
  it("root barrel is explicit (no export *)", () => {
    const src = readFileSync(INDEX_SRC, "utf8");
    assert.doesNotMatch(src, /export\s+\*\s+from/);
    assert.match(src, /createFinanceService/);
    assert.match(src, /FinanceService/);
    assert.match(src, /FinanceCapabilityPort/);
    assert.match(src, /FinanceRepositoryPort/);
    assert.doesNotMatch(src, FORBIDDEN_IN_INDEX);
  });

  it("package.json exports map is allowlisted only", () => {
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8"));
    assert.deepEqual(Object.keys(pkg.exports).sort(), [...ALLOWED_EXPORT_KEYS].sort());
    assert.equal(pkg.files.includes("dist"), true);
    assert.equal(pkg.main, "./dist/index.js");
    assert.equal(pkg.types, "./dist/index.d.ts");
  });

  it("dist runtime surface has required entry points and no host/prisma names", () => {
    if (!existsSync(DIST_INDEX)) {
      const build = spawnSync("pnpm", ["run", "build"], {
        cwd: PKG,
        encoding: "utf8",
        shell: false,
      });
      assert.equal(build.status, 0, build.stdout + build.stderr);
    }
    const require = createRequire(import.meta.url);
    const mod = require(DIST_INDEX) as Record<string, unknown>;
    for (const name of REQUIRED_RUNTIME) {
      assert.notEqual(mod[name], undefined, `missing runtime export ${name}`);
    }
    for (const name of Object.keys(mod)) {
      assert.doesNotMatch(name, /Prisma|HostFinance|Generated|InMemoryFinance/);
    }
  });

  it("package-local public-api guard passes", () => {
    if (!existsSync(DIST_INDEX)) {
      const build = spawnSync("pnpm", ["run", "build"], {
        cwd: PKG,
        encoding: "utf8",
        shell: false,
      });
      assert.equal(build.status, 0, build.stdout + build.stderr);
    }
    const guard = spawnSync(process.execPath, [join(PKG, "scripts/guard-public-api.mjs")], {
      encoding: "utf8",
      cwd: PKG,
    });
    assert.equal(guard.status, 0, guard.stdout + guard.stderr);
    assert.match(guard.stdout, /PASS/);
  });

  it("subpath barrels do not re-export workspace reaction or prisma", () => {
    for (const rel of ["src/ports/index.ts", "src/domain/index.ts", "src/application/index.ts"]) {
      const src = readFileSync(join(PKG, rel), "utf8");
      assert.doesNotMatch(src, /WorkspaceFinanceEventReactionPort/);
      assert.doesNotMatch(src, /@prisma\/client|PrismaFinance|HostFinance/);
      assert.doesNotMatch(src, /export\s+\*\s+from/);
    }
  });
});
