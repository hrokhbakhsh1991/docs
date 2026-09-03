/**
 * WALLET-P2D — cross-package wallet HTTP boundary proof.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../../..");
const WALLET_HTTP = join(REPO_ROOT, "packages/wallet-http/src");
const WALLET_HTTP_CONTRACTS = join(REPO_ROOT, "packages/wallet-http-contracts/src");
const FINANCE_CORE = join(REPO_ROOT, "packages/finance-core/src");

describe("WALLET-P2D HTTP architecture boundary", () => {
  it("wallet-http-contracts has no API/Prisma/workspace imports", () => {
    const files = readdirSync(WALLET_HTTP_CONTRACTS).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(WALLET_HTTP_CONTRACTS, file), "utf8");
      assert.doesNotMatch(src, /@prisma\/client|apps\/api/);
      assert.doesNotMatch(src, /packages\/workspaces\//);
    }
  });

  it("wallet-http has no Prisma or Denali imports", () => {
    const files = readdirSync(WALLET_HTTP).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(WALLET_HTTP, file), "utf8");
      assert.doesNotMatch(src, /@prisma\/client/);
      assert.doesNotMatch(src, /workspace-denali|@app-tour\/workspace-denali/);
    }
  });

  it("finance-core does not import wallet-http packages", () => {
    const files = readdirSync(FINANCE_CORE, { recursive: true }).filter((name) =>
      String(name).endsWith(".ts"),
    );
    for (const relative of files) {
      const src = readFileSync(join(FINANCE_CORE, String(relative)), "utf8");
      assert.doesNotMatch(src, /@app-tour\/wallet-http/);
    }
  });

  it("wallet handlers do not expose ledger mutation endpoints", () => {
    const routes = readFileSync(join(WALLET_HTTP, "routes-manifest.ts"), "utf8");
    assert.doesNotMatch(routes, /ledger-entries/);
    assert.doesNotMatch(routes, /ledger\/mutate/);
  });

  it("workspace-route-registrar dispatches wallet handlers separately from finance", () => {
    const registrar = readFileSync(
      join(REPO_ROOT, "apps/api/src/http/workspace-route-registrar.ts"),
      "utf8",
    );
    assert.match(registrar, /"wallet"/);
    assert.match(registrar, /"wallet-param"/);
    assert.match(registrar, /handleWalletOperatorCredit/);
  });
});
