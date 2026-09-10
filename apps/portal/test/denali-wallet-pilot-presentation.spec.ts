/**
 * Phase 2 — Denali Wallet pilot presentation (IRR + nav i18n).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isZeroDecimalWalletCurrency } from "@app-tour/workspace-sdk";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali-wallet-pilot-presentation.spec.ts", () => {
  it("IRR commerce currency uses zero-decimal wallet formatting policy", () => {
    assert.equal(isZeroDecimalWalletCurrency("IRR"), true);
  });

  it("portal nav includes wallet labels in en and fa", () => {
    const en = JSON.parse(readFileSync(join(portalRoot, "messages/en/portalMember.json"), "utf8"));
    const fa = JSON.parse(readFileSync(join(portalRoot, "messages/fa/portalMember.json"), "utf8"));
    assert.equal(en.nav.wallet, "Wallet");
    assert.equal(fa.nav.wallet, "کیف پول");
  });
});
