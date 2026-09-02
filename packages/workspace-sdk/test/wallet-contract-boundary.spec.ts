/**
 * WALLET-P1 — workspace-agnostic contract boundary (no finance-core / Denali imports).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SDK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WALLET_SRC = join(SDK_ROOT, "src/wallet");

describe("WALLET-P1 workspace-sdk wallet contract boundary", () => {
  it("wallet source tree has no finance-core or Denali imports", () => {
    const files = readdirSync(WALLET_SRC, { recursive: true }).filter((name) =>
      String(name).endsWith(".ts"),
    );
    for (const relative of files) {
      const src = readFileSync(join(WALLET_SRC, String(relative)), "utf8");
      assert.doesNotMatch(src, /@app-tour\/finance-core|finance-core/);
      assert.doesNotMatch(src, /workspace-denali|packages\/workspaces\/denali/);
      assert.doesNotMatch(src, /apps\/portal|apps\/web/);
    }
  });

  it("wallet capability port declares assertEnabled only (no persistence)", async () => {
    const mod = await import("../src/wallet/ports/wallet-capability.port.js");
    const src = readFileSync(
      join(WALLET_SRC, "ports/wallet-capability.port.ts"),
      "utf8",
    );
    assert.equal(typeof mod.WalletCapabilityPort, "undefined");
    assert.match(src, /assertEnabled\(tenantId: string\)/);
    assert.doesNotMatch(src, /@prisma|Prisma|finance-core/);
  });

  it("generated wallet capabilities include wallet-ws1 certification fixture only", async () => {
    const mod = await import("../src/catalog/workspace-wallet-capabilities.generated.js");
    assert.deepEqual(mod.listWalletCapableWorkspaceTypes(), ["wallet-ws1"]);
    assert.equal(mod.getWorkspaceWalletCapabilities("denali"), null);
    assert.equal(mod.getWorkspaceWalletCapabilities("wallet-ws1")?.memberAccounts, true);
    assert.equal(mod.walletWorkspaceHasCapability("urban", "memberAccounts"), false);
  });
});
