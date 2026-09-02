/**
 * WALLET-P2D — wallet route registration certification.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { WALLET_HTTP_ROUTE_MANIFEST } from "@app-tour/wallet-http";
import { FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/finance-http";
import {
  WORKSPACE_HTTP_PARAM_ROUTES,
  WORKSPACE_HTTP_STATIC_ROUTES,
} from "../http/workspace-http-routes.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../../..");

describe("WALLET-P2D wallet HTTP route registration", () => {
  it("wallet-ws1 registers all WALLET_HTTP_ROUTE_MANIFEST routes", () => {
    const handlerKeys = new Set(
      [...WORKSPACE_HTTP_STATIC_ROUTES, ...WORKSPACE_HTTP_PARAM_ROUTES].map(
        (route) => route.handlerKey,
      ),
    );
    const expectedHandlers = [
      "handleWalletMemberBalance",
      "handleWalletMemberTransactions",
      "handleWalletOperatorAccounts",
      "handleWalletOperatorCredit",
      "handleWalletOperatorDebit",
      "handleWalletOperatorReversal",
    ] as const;
    for (const key of expectedHandlers) {
      assert.equal(handlerKeys.has(key), true, `missing handler ${key}`);
    }
    assert.equal(WALLET_HTTP_ROUTE_MANIFEST.length, expectedHandlers.length);
  });

  it("Denali manifest does not register wallet routes", () => {
    const denaliManifest = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/workspace.manifest.json"),
      "utf8",
    );
    assert.doesNotMatch(denaliManifest, /WALLET_HTTP_ROUTE_MANIFEST/);
    assert.doesNotMatch(denaliManifest, /handleWallet/);
  });

  it("finance route manifest unchanged (no wallet paths)", () => {
    for (const route of FINANCE_HTTP_ROUTE_MANIFEST) {
      assert.equal(route.path.startsWith("/wallet/"), false);
    }
  });

  it("wallet handler loaders reference @app-tour/wallet-http only", () => {
    const loaders = readFileSync(
      join(REPO_ROOT, "apps/api/src/http/workspace-http-handler-loaders.generated.ts"),
      "utf8",
    );
    assert.match(loaders, /handleWalletMemberBalance/);
    assert.match(loaders, /@app-tour\/wallet-http/);
    assert.doesNotMatch(loaders, /workspace-wallet-ws1\/http/);
  });
});
