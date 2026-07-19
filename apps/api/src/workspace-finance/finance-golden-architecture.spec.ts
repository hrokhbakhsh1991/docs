/**
 * Golden architecture tests — mirror of `pnpm run guard:finance-golden` (G4–G7 host side).
 * G1–G3 are enforced by finance-core boundary + depcruise inside the guard script.
 *
 * @see docs/phase-20/p7/appendices/FINANCE_GOLDEN_ARCHITECTURE_TESTS.md
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("finance golden architecture (G4–G7)", () => {
  it("G4: FinanceService depends on FinanceRepositoryPort; no Prisma in core service", () => {
    const service = read("packages/finance-core/src/application/finance.service.ts");
    assert.match(service, /FinanceRepositoryPort/);
    assert.doesNotMatch(service, /PrismaFinanceRepository/);
    assert.doesNotMatch(service, /@prisma\//);
    assert.ok(
      existsSync(
        resolve(REPO_ROOT, "apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts")
      )
    );
  });

  it("G5: capability registries use generated bindings only", () => {
    const dep = read("apps/api/src/workspace-finance/finance-dependency-registry.ts");
    const react = read("apps/api/src/workspace-finance/finance-event-reaction-registry.ts");
    assert.match(dep, /workspace-finance-dependency-bindings\.generated/);
    assert.match(react, /workspace-finance-event-reaction-bindings\.generated/);
    assert.doesNotMatch(dep, /from ["']@app-tour\/workspace-denali["']/);
    assert.doesNotMatch(react, /DenaliTourCreatedFinanceReactionAdapter/);
    assert.doesNotMatch(react, /new Map\(\[\[/);
  });

  it("G6: PrismaFinanceRepository uses withTenantRls", () => {
    const src = read(
      "apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts"
    );
    assert.match(src, /withTenantRls/);
    const calls = (src.match(/\bwithTenantRls\s*\(/g) ?? []).length;
    assert.ok(calls >= 8, `expected >=8 withTenantRls calls, got ${calls}`);
  });

  it("G7: FIN-EVENT-NEUTRAL-01 generic runtime has zero workspace imports", () => {
    const runtimeFiles = [
      "apps/api/src/workspace-finance/process-workspace-finance-outbox.ts",
      "apps/api/src/workspace-finance/prisma-workspace-outbox-reader.ts",
      "apps/api/src/workspace/workspace-tour-created-dispatcher.ts",
      "apps/api/src/workspace-finance/finance-event-reaction-registry.ts",
      "apps/api/src/workspace-finance/infrastructure/prisma-workspace-outbox-writer.ts",
      "apps/api/src/workspace-finance/workspace-finance-processed-log.ts",
      "apps/api/src/workspace-finance/enqueue-finance-ledger-capture.ts",
    ];
    for (const rel of runtimeFiles) {
      const src = read(rel);
      assert.doesNotMatch(src, /from ["']@app-tour\/workspace-denali/, rel);
      assert.doesNotMatch(src, /from ["']@app-tour\/workspace-finance-ws/, rel);
      assert.doesNotMatch(src, /runTourCreatedFinanceSideEffect/, rel);
      assert.doesNotMatch(src, /consumeDenaliTourCreatedFinanceOutbox/, rel);
    }
  });
});
