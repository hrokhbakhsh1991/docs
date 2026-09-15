/**
 * WALLET-P2C — wallet persistence architecture boundary proof.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const API_WALLET = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = resolve(API_WALLET, "../../../..");
const WALLET_CORE = join(REPO_ROOT, "packages/wallet-core/src");
const FINANCE_CORE = join(REPO_ROOT, "packages/finance-core/src");

describe("WALLET-P2C persistence architecture boundary", () => {
  it("wallet-core source has no Prisma or apps/api imports", () => {
    const files = readdirSync(WALLET_CORE, { recursive: true }).filter((name) =>
      String(name).endsWith(".ts"),
    );
    for (const relative of files) {
      const src = readFileSync(join(WALLET_CORE, String(relative)), "utf8");
      assert.doesNotMatch(src, /@prisma\/client|from ["']@prisma/);
      assert.doesNotMatch(src, /@apps\/api|apps\/api/);
    }
  });

  it("finance-core does not import wallet-core", () => {
    const files = readdirSync(FINANCE_CORE, { recursive: true }).filter((name) =>
      String(name).endsWith(".ts"),
    );
    for (const relative of files) {
      const src = readFileSync(join(FINANCE_CORE, String(relative)), "utf8");
      assert.doesNotMatch(src, /@app-tour\/wallet-core|wallet-core/);
    }
  });

  it("workspace-wallet persistence has no Denali workspace imports", () => {
    const infra = join(API_WALLET, "infrastructure");
    const files = readdirSync(infra).filter((name) => name.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(infra, file), "utf8");
      assert.doesNotMatch(src, /workspace-denali|@app-tour\/workspace-denali/);
      assert.doesNotMatch(src, /packages\/workspaces\/denali/);
    }
  });

  it("PrismaWalletRepository uses wallet-core domain services", () => {
    const src = readFileSync(
      join(API_WALLET, "infrastructure/prisma-wallet.repository.ts"),
      "utf8",
    );
    assert.match(src, /createOperatorCredit/);
    assert.match(src, /createOperatorDebit/);
    assert.match(src, /createReversal/);
    assert.doesNotMatch(src, /walletLedgerEntry\.update\(/);
    assert.doesNotMatch(src, /walletLedgerEntry\.delete\(/);
  });

  it("API adapter may depend on wallet-core and Prisma", () => {
    const src = readFileSync(
      join(API_WALLET, "infrastructure/prisma-wallet.repository.ts"),
      "utf8",
    );
    assert.match(src, /@app-tour\/wallet-core/);
    assert.match(src, /@prisma\/client/);
  });
});
