/**
 * Phase 2.3 — external consumer fixture (second-repository simulation).
 * Proves finance-core is consumable via package public surface (dist), not src paths.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(FIXTURE_DIR, "../..");
const DIST_INDEX = join(PKG, "dist/index.js");
const CONTRACTS_DIST = resolve(PKG, "../finance-http-contracts/dist/index.js");

function ensureBuilt(): void {
  if (!existsSync(CONTRACTS_DIST)) {
    const r = spawnSync("pnpm", ["run", "build"], {
      cwd: resolve(PKG, "../finance-http-contracts"),
      encoding: "utf8",
      shell: false,
    });
    assert.equal(r.status, 0, `finance-http-contracts build failed:\n${r.stdout}\n${r.stderr}`);
  }
  if (!existsSync(DIST_INDEX)) {
    const r = spawnSync("pnpm", ["run", "build"], {
      cwd: PKG,
      encoding: "utf8",
      shell: false,
    });
    assert.equal(r.status, 0, `finance-core build failed:\n${r.stdout}\n${r.stderr}`);
  }
}

function fixtureSources(): string[] {
  return readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".spec.ts"))
    .map((name) => join(FIXTURE_DIR, name));
}

describe("FIN-EXTERNAL-CONSUMER second-repo simulation", () => {
  it("fixture sources import only @app-tour/finance-core (no src / apps/api / prisma)", () => {
    for (const abs of fixtureSources()) {
      const src = readFileSync(abs, "utf8");
      assert.doesNotMatch(src, /from ["']\.\.\/\.\.\/src/);
      assert.doesNotMatch(src, /from ["'][^"']*\/src\//);
      assert.doesNotMatch(src, /from ["'][^"']*apps\/api/);
      assert.doesNotMatch(src, /from ["']@apps\/api/);
      assert.doesNotMatch(src, /from ["']@prisma\/client["']/);
      assert.doesNotMatch(src, /from ["']@app-tour\/workspace-/);
      assert.doesNotMatch(src, /process\.env/);
      assert.match(src, /from ["']@app-tour\/finance-core["']/);
    }
  });

  it("second-repo-package.json declares semver deps (publish-shaped consumer)", () => {
    const manifest = JSON.parse(
      readFileSync(join(FIXTURE_DIR, "second-repo-package.json"), "utf8")
    );
    assert.equal(manifest.dependencies["@app-tour/finance-core"], "0.1.0");
    assert.equal(manifest.dependencies["@app-tour/finance-http-contracts"], "0.1.0");
    assert.equal(manifest.private, true);
  });

  it("package dist exports createFinanceService for external composition", async () => {
    ensureBuilt();
    assert.equal(existsSync(DIST_INDEX), true);
    const mod = await import("@app-tour/finance-core");
    assert.equal(typeof mod.createFinanceService, "function");
    assert.equal(typeof mod.FinanceService, "function");
  });

  it("second app composes finance-core and creates a manual payment", async () => {
    ensureBuilt();
    const { createExternalAppFinanceService } = await import("./second-app-composition.ts");
    const finance = createExternalAppFinanceService();
    const auth = {
      userId: "00000000-0000-4000-8000-0000000000aa",
      tenantId: "00000000-0000-4000-8000-0000000000bb",
      role: "admin" as const,
      status: "ACTIVE" as const,
      workspaceId: "external-ws",
    };
    const payment = await finance.createManualPayment(
      auth,
      {
        registrationId: "00000000-0000-4000-8000-0000000000cc",
        amount: "2500000",
        currency: "IRR",
      },
      "external-consumer-idem-1"
    );
    assert.equal(payment.status, "Pending");
    assert.equal(payment.method, "Manual");
    assert.equal(payment.amount, "2500000");
    assert.equal(typeof payment.id, "string");
    assert.ok(payment.id.length > 0);
  });
});
