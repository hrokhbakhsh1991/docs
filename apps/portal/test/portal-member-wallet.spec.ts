/**
 * WALLET-P3A — member portal wallet module tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearWorkspaceMemberPortalRenderersForTests,
  getWorkspaceMemberPortalRenderer,
} from "@app-tour/workspace-sdk";

import {
  buildMemberWalletBffPayload,
  buildMemberWalletHistoryView,
} from "../src/me/wallet/member-wallet-bff.server";
import {
  classifyMemberWalletBffFailure,
  readMemberWalletBffErrorCode,
} from "../src/me/wallet/classify-member-wallet-bff-error";
import { formatMemberWalletMinorAmount } from "../src/me/wallet/member-wallet-format";
import { ensureMemberWalletRendererRegistered } from "../src/me/wallet/register-member-wallet-renderer.server";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const portalRoot = join(repoRoot, "apps/portal");

function readPortal(relativePath: string): string {
  return readFileSync(join(portalRoot, relativePath), "utf8");
}

describe("portal-member-wallet — WALLET-P3A", () => {
  it("MEM-WALLET-02 dispatcher still gates entitlement before renderer", () => {
    const page = readPortal("app/me/[...modulePath]/page.tsx");
    assert.match(page, /isMemberModuleEntitled/);
    assert.match(page, /getWorkspaceMemberPortalRenderer/);
    assert.doesNotMatch(page, /pluginId\s*===\s*["']denali["']/);
  });

  it("MEM-WALLET-03 layout registers platform wallet renderer", () => {
    const layout = readPortal("app/layout.tsx");
    assert.match(layout, /ensureMemberWalletRendererRegistered/);
  });

  it("MEM-WALLET-04 wallet BFF route never accepts browser authority fields", () => {
    const route = readPortal("app/api/me/wallet/route.ts");
    const resolver = readPortal("src/me/wallet/resolve-member-wallet-bff.server.ts");
    assert.match(resolver, /buildMemberApiHeaders/);
    assert.match(resolver, /\/wallet\/me\/balance/);
    assert.match(resolver, /\/wallet\/me\/transactions/);
    assert.match(route, /resolveMemberWalletFetchResult/);
    assert.doesNotMatch(resolver, /searchParams\.get\(["']userId["']\)/);
    assert.doesNotMatch(resolver, /searchParams\.get\(["']tenantId["']\)/);
    assert.doesNotMatch(resolver, /searchParams\.get\(["']workspaceId["']\)/);
  });

  it("MEM-WALLET-05 upstream fetch uses session headers only", () => {
    const upstream = readPortal("src/me/wallet/fetch-wallet-upstream.server.ts");
    assert.match(upstream, /buildMemberApiHeaders/);
    assert.doesNotMatch(upstream, /x-user-id/);
  });

  it("MEM-WALLET-06 renderer registration exposes wallet module", () => {
    clearWorkspaceMemberPortalRenderersForTests();
    ensureMemberWalletRendererRegistered("wallet-ws1");
    const renderer = getWorkspaceMemberPortalRenderer("wallet-ws1", "wallet");
    assert.equal(typeof renderer, "function");
    clearWorkspaceMemberPortalRenderersForTests();
  });

  it("MEM-WALLET-07 no Denali or Finance imports in wallet module tree", () => {
    const sources = [
      readPortal("src/me/wallet/member-wallet-page-content.tsx"),
      readPortal("src/me/wallet/member-wallet-bff.server.ts"),
      readPortal("src/me/wallet/render-member-wallet-portal-module.tsx"),
      readPortal("app/api/me/wallet/route.ts"),
    ].join("\n");
    assert.doesNotMatch(sources, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(sources, /packages\/workspaces\/denali/);
    assert.doesNotMatch(sources, /@app-tour\/finance-core/);
    assert.doesNotMatch(sources, /pluginId\s*===\s*["']denali["']/);
  });

  it("MEM-WALLET-08 balance BFF success shape preserves string minor units", () => {
    const payload = buildMemberWalletBffPayload({
      summary: {
        accountId: "00000000-0000-4000-8000-000000000010",
        currency: "USD",
        balanceMinor: "2500",
        availableBalanceMinor: "2500",
      },
      history: {
        accountId: "00000000-0000-4000-8000-000000000010",
        currency: "USD",
        items: [
          {
            id: "tx-1",
            accountId: "00000000-0000-4000-8000-000000000010",
            kind: "operator_credit",
            status: "posted",
            amountMinor: "2500",
            currency: "USD",
            reference: null,
            reversesTransactionId: null,
            postedAt: "2026-09-02T10:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
      locale: "en",
      presentation: { defaultCurrency: "USD", zeroDecimalCurrency: false },
    });
    assert.equal(payload.balance.balanceMinor, "2500");
    assert.equal(payload.history.items[0]?.amountMinor, "2500");
    assert.match(payload.balance.balanceLabel, /\$/);
  });

  it("MEM-WALLET-09 empty history maps to zero items", () => {
    const history = buildMemberWalletHistoryView(
      {
        accountId: "",
        currency: "USD",
        items: [],
        nextCursor: null,
        hasMore: false,
      },
      "en",
      { defaultCurrency: "USD", zeroDecimalCurrency: false },
    );
    assert.equal(history.items.length, 0);
    assert.equal(history.hasMore, false);
  });

  it("MEM-WALLET-10 stable wallet error mapping", () => {
    assert.equal(
      classifyMemberWalletBffFailure(403, "WALLET_WORKSPACE_UNSUPPORTED"),
      "workspace_disabled",
    );
    assert.equal(
      classifyMemberWalletBffFailure(403, "FORBIDDEN_MEMBER_MODULE_WALLET"),
      "entitlement_denied",
    );
    assert.equal(readMemberWalletBffErrorCode({ code: "WALLET_FETCH_FAILED" }), "WALLET_FETCH_FAILED");
  });

  it("MEM-WALLET-11 pagination route preserves cursor query only", () => {
    const route = readPortal("app/api/me/wallet/transactions/route.ts");
    assert.match(route, /cursor/);
    assert.match(route, /limit/);
    assert.doesNotMatch(route, /userId/);
  });

  it("MEM-WALLET-12 transactions panel exposes accessibility hooks", () => {
    const panel = readPortal("src/me/wallet/member-wallet-transactions-panel.tsx");
    assert.match(panel, /aria-labelledby/);
    assert.match(panel, /data-portal-member-wallet-load-more/);
    assert.match(panel, /aria-busy/);
    assert.match(panel, /role="alert"/);
  });

  it("MEM-WALLET-13 RTL layout uses portal dir (no local override)", () => {
    const layout = readPortal("app/layout.tsx");
    assert.match(layout, /resolveTextDirection/);
    const walletPage = readPortal("src/me/wallet/member-wallet-page-content.tsx");
    assert.doesNotMatch(walletPage, /dir\s*=/);
  });

  it("MEM-WALLET-14 responsive wallet styles exist in starter portal theme", () => {
    const css = readFileSync(
      join(repoRoot, "packages/workspaces/starter/theme/starter-portal.css"),
      "utf8",
    );
    assert.match(css, /data-portal-member-wallet/);
    assert.match(css, /@media \(min-width: 48rem\)/);
  });

  it("MEM-WALLET-15 IRR formatting uses zero-decimal presentation", () => {
    const formatted = formatMemberWalletMinorAmount("150000", "IRR", "fa", {
      defaultCurrency: "IRR",
      zeroDecimalCurrency: true,
    });
    assert.match(formatted, /150|۱۵۰/);
  });
});

describe("portal-visual-wave3 wallet hook — WALLET-P3A", () => {
  it("MEM-WALLET-01 wallet module uses renderer instead of stub lede", () => {
    const stub = readPortal("src/me/member-module-stub.tsx");
    assert.doesNotMatch(stub, /walletLede/);
    const layout = readPortal("app/layout.tsx");
    assert.match(layout, /ensureMemberWalletRendererRegistered/);
    const navIcon = readPortal("src/shell/portal-nav-icon.tsx");
    assert.match(navIcon, /case "wallet"/);
    assert.match(navIcon, /Wallet/);
  });
});
