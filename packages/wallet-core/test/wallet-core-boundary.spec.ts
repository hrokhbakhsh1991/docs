/**
 * Phase 2B — wallet-core boundary and portability proof.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(PKG, "src");

describe("WALLET-P2B wallet-core boundary", () => {
  it("layout has ports / domain / application services", () => {
    assert.equal(existsSync(join(SRC, "ports")), true);
    assert.equal(existsSync(join(SRC, "domain")), true);
    assert.equal(existsSync(join(SRC, "application/wallet.service.ts")), true);
  });

  it("source tree has no forbidden imports", () => {
    const files = readdirSync(SRC, { recursive: true }).filter((name) =>
      String(name).endsWith(".ts"),
    );
    for (const relative of files) {
      const src = readFileSync(join(SRC, String(relative)), "utf8");
      assert.doesNotMatch(src, /@app-tour\/finance-core|finance-core/);
      assert.doesNotMatch(src, /@prisma\/client|from ["']@prisma/);
      assert.doesNotMatch(src, /@apps\/api|apps\/api/);
      assert.doesNotMatch(src, /@app-tour\/workspace-|packages\/workspaces\//);
      assert.doesNotMatch(src, /apps\/portal|apps\/web|apps\/marketing/);
    }
  });

  it("package-local boundary guard passes", () => {
    const guard = spawnSync(process.execPath, [join(PKG, "scripts/guard-boundary.mjs")], {
      encoding: "utf8",
      cwd: PKG,
    });
    assert.equal(guard.status, 0, guard.stdout + guard.stderr);
    assert.match(guard.stdout, /PASS/);
  });

  it("package portability guard passes (zero runtime deps)", () => {
    const guard = spawnSync(
      process.execPath,
      [join(PKG, "scripts/guard-portability.mjs")],
      { encoding: "utf8", cwd: PKG },
    );
    assert.equal(guard.status, 0, guard.stdout + guard.stderr);
    assert.match(guard.stdout, /PASS/);
  });

  it("exports pure services from package root in plain Node", async () => {
    const mod = await import("../src/index.ts");
    assert.equal(typeof mod.createOperatorCredit, "function");
    assert.equal(typeof mod.calculateBalance, "function");
    assert.equal(typeof mod.createReversal, "function");
    assert.equal(typeof mod.resolveIdempotencyReplay, "function");
    assert.equal(Array.isArray(mod.WALLET_ERROR_CODES), true);
  });

  it("ports are interfaces only — no Prisma or persistence implementation", () => {
    const portFiles = readdirSync(join(SRC, "ports")).filter((f) => f.endsWith(".ts"));
    for (const file of portFiles) {
      const src = readFileSync(join(SRC, "ports", file), "utf8");
      assert.doesNotMatch(src, /class\s+\w+Repository/);
      assert.doesNotMatch(src, /@prisma|Prisma/);
    }
  });
});
