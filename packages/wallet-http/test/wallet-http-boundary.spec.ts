/**
 * WALLET-P2D — wallet-http package boundary proof.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("wallet-http boundary", () => {
  it("has no Prisma, Denali, or workspace implementation imports", () => {
    const files = readdirSync(SRC).filter((name) => name.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(SRC, file), "utf8");
      assert.doesNotMatch(src, /@prisma\/client|from ["']@prisma/);
      assert.doesNotMatch(src, /workspace-denali|@app-tour\/workspace-denali/);
      assert.doesNotMatch(src, /packages\/workspaces\//);
      assert.doesNotMatch(src, /next\/server|from ["']next\//);
    }
  });

  it("depends on wallet-core ports via wallet-http service port only", () => {
    const routes = readFileSync(join(SRC, "wallet.routes.ts"), "utf8");
    assert.doesNotMatch(routes, /walletLedgerEntry|PrismaWallet/);
    assert.match(routes, /@app-tour\/wallet-http-contracts/);
  });
});
