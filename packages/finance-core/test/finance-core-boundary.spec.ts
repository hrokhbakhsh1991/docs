/**
 * Phase 1.25 / Phase 2 — finance-core boundary + engine location.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(PKG, "src");
const SERVICE = join(SRC, "application/finance.service.ts");

describe("FIN-P2 finance-core engine boundary", () => {
  it("layout has ports / domain / application with FinanceService", () => {
    assert.equal(existsSync(join(SRC, "ports")), true);
    assert.equal(existsSync(join(SRC, "domain")), true);
    assert.equal(existsSync(SERVICE), true);
    assert.match(readFileSync(SERVICE, "utf8"), /export class FinanceService/);
  });

  it("FinanceService has zero Prisma / apps/api / workspace / env / fs imports", () => {
    const src = readFileSync(SERVICE, "utf8");
    assert.doesNotMatch(src, /@prisma\/client|from ["']fs["']|node:fs|process\.env/);
    assert.doesNotMatch(src, /apps\/api|@apps\/api|@app-tour\/workspace-/);
    assert.doesNotMatch(src, /withTenantRls|enqueueOutboxEvent|infrastructure\//);
  });

  it("source tree passes package-local finance-core boundary guard", () => {
    const guard = spawnSync(
      process.execPath,
      [join(PKG, "scripts/guard-boundary.mjs")],
      { encoding: "utf8", cwd: PKG }
    );
    assert.equal(guard.status, 0, guard.stdout + guard.stderr);
    assert.match(guard.stdout, /PASS/);
  });

  it("package passes portability guard (standalone tsconfig + allowlisted deps)", () => {
    const guard = spawnSync(
      process.execPath,
      [join(PKG, "scripts/guard-portability.mjs")],
      { encoding: "utf8", cwd: PKG }
    );
    assert.equal(guard.status, 0, guard.stdout + guard.stderr);
    assert.match(guard.stdout, /PASS/);
  });

  it("package passes public-api freeze guard", () => {
    const dist = join(PKG, "dist/index.js");
    if (!existsSync(dist)) {
      const build = spawnSync("pnpm", ["run", "build"], {
        cwd: PKG,
        encoding: "utf8",
        shell: false,
      });
      assert.equal(build.status, 0, build.stdout + build.stderr);
    }
    const guard = spawnSync(
      process.execPath,
      [join(PKG, "scripts/guard-public-api.mjs")],
      { encoding: "utf8", cwd: PKG }
    );
    assert.equal(guard.status, 0, guard.stdout + guard.stderr);
    assert.match(guard.stdout, /PASS/);
  });

  it("no outbox writer/reader ports in finance-core (host-owned)", () => {
    const portFiles = readdirSync(join(SRC, "ports"));
    assert.equal(portFiles.includes("finance-outbox-writer.port.ts"), false);
    assert.equal(portFiles.includes("finance-workspace-outbox-reader.port.ts"), false);
  });

  it("exports createFinanceService from package root", async () => {
    const mod = await import("../src/index.ts");
    assert.equal(typeof mod.createFinanceService, "function");
    assert.equal(typeof mod.FinanceService, "function");
    assert.equal(typeof mod.buildPaymentScheduleItems, "function");
  });
});
