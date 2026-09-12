/**
 * WALLET-P3B — walletNav capability + operator shell wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWalletWs1WorkspacePlugin as getWalletWs1Plugin } from "@app-tour/workspace-wallet-ws1";
import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveWalletNavCapability } from "@app-tour/workspace-sdk";

import { resolveOperatorNav } from "../src/admin/shell/resolve-operator-nav";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ownerSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000010",
  role: "owner" as const,
  workspaceType: "wallet-ws1",
  pluginId: "wallet-ws1",
};

const viewerSession = {
  ...ownerSession,
  role: "viewer" as const,
};

describe("thin-shell-wallet-nav-capability — WALLET-P3B", () => {
  it("TS-WALLET-P3B-01 wallet-capable workspaces publish capabilities.walletNav", () => {
    assert.equal(resolveWalletNavCapability(getWalletWs1Plugin())?.supported, true);
    assert.equal(resolveWalletNavCapability(getDenaliPlugin())?.supported, true);
  });

  it("TS-WALLET-P3B-01b denali walletNav capability does not bypass tenant module gate", async () => {
    const { ensureWalletNavSupported } = await import("../src/wallet/wallet-nav-enablement");
    assert.equal(await ensureWalletNavSupported("denali", {}), false);
  });

  it("TS-WALLET-P3B-02 layout warms wallet nav; operator nav includes wallet for owner", async () => {
    const layout = readFileSync(resolve(WEB_ROOT, "app/(app)/layout.tsx"), "utf8");
    const navResolver = readFileSync(
      resolve(WEB_ROOT, "src/admin/shell/resolve-operator-nav.ts"),
      "utf8",
    );
    assert.match(layout, /ensureWalletNavSupported/);
    assert.match(navResolver, /shouldShowWalletNav/);

    const { ensureWalletNavSupported } = await import("../src/wallet/wallet-nav-enablement");
    await ensureWalletNavSupported("wallet-ws1", {});
    const items = resolveOperatorNav({ session: ownerSession, pluginId: "wallet-ws1" });
    assert.ok(items.some((item) => item.href === "/wallet"));
  });

  it("TS-WALLET-P3B-03 non-operator role does not receive wallet nav", async () => {
    const { ensureWalletNavSupported } = await import("../src/wallet/wallet-nav-enablement");
    await ensureWalletNavSupported("wallet-ws1", {});
    const items = resolveOperatorNav({ session: viewerSession, pluginId: "wallet-ws1" });
    assert.equal(items.some((item) => item.href === "/wallet"), false);
  });

  it("TS-WALLET-P3B-04 wallet page fail-closed via ensureWalletRouteAllowed", () => {
    const page = readFileSync(resolve(WEB_ROOT, "app/(app)/wallet/page.tsx"), "utf8");
    assert.match(page, /ensureWalletRouteAllowed/);
    assert.match(page, /notFound\(\)/);
  });
});
