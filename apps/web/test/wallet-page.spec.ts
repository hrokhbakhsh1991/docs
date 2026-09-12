/**
 * WALLET-P3B — operator wallet page surface tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("wallet-page.spec.ts — WALLET-P3B", () => {
  it("WEB-WALLET-PAGE-01 wallet route is protected and dynamic", () => {
    const page = readFileSync(resolve(WEB_ROOT, "app/(app)/wallet/page.tsx"), "utf8");
    assert.match(page, /ensureWalletRouteAllowed/);
    assert.match(page, /notFound\(\)/);
    assert.match(page, /force-dynamic/);
    assert.match(page, /readOperatorSessionFromCookies/);
  });

  it("WEB-WALLET-PAGE-02 wallet ops panel exposes RTL-friendly structure", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/wallet/wallet-ops-panel.tsx"), "utf8");
    assert.match(panel, /role="alert"/);
    assert.match(panel, /aria-live="polite"/);
    assert.match(panel, /dir="ltr"/);
    assert.match(panel, /useTranslations\("wallet\.ops"\)/);
  });

  it("WEB-WALLET-PAGE-03 wallet messages loaded for fa and en", () => {
    const loader = readFileSync(resolve(WEB_ROOT, "src/i18n/load-messages.ts"), "utf8");
    assert.match(loader, /messages\/en\/wallet\.json/);
    assert.match(loader, /messages\/fa\/wallet\.json/);
    const en = readFileSync(resolve(WEB_ROOT, "messages/en/wallet.json"), "utf8");
    const fa = readFileSync(resolve(WEB_ROOT, "messages/fa/wallet.json"), "utf8");
    assert.match(en, /confirmCreditTitle/);
    assert.match(fa, /confirmCreditTitle/);
  });

  it("WEB-WALLET-PAGE-04 operator nav uses distinct wallet icon", () => {
    const nav = readFileSync(resolve(WEB_ROOT, "src/admin/shell/operator-nav.tsx"), "utf8");
    assert.match(nav, /wallet:\s*Coins/);
    assert.match(nav, /finance:\s*Wallet/);
  });
});
