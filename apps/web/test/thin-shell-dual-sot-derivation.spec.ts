/**
 * Thin Shell Phase 4bu — Dual-SOT derivation spike consistency locks.
 * @see docs/dev/thin-shell-dual-sot-derivation.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getAcmePlugin } from "@app-tour/workspace-acme";
import { getWorkspacePlugin as getBookingWs2Plugin } from "@app-tour/workspace-booking-ws2";
import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { getWorkspacePlugin as getFinanceWs5Plugin } from "@app-tour/workspace-finance-ws5";
import { getWorkspacePlugin as getUrbanPlugin } from "@app-tour/workspace-urban";
import {
  resolveBookingOpsCapability,
  resolveFinanceNavCapability,
  resolveFinanceOpsCapability,
  resolveOperatorShellNavCapability,
  resolveWizardCreateCapability,
} from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");

type JsonObject = Record<string, unknown>;

function readManifest(workspaceId: string): JsonObject {
  const raw = readFileSync(
    resolve(REPO_ROOT, `packages/workspaces/${workspaceId}/workspace.manifest.json`),
    "utf8"
  );
  return JSON.parse(raw) as JsonObject;
}

function asObject(value: unknown): JsonObject | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function expectsWizardExtendedChrome(manifest: JsonObject): boolean {
  return asObject(manifest.wizardCreate)?.extendedChrome === true;
}

function expectsFinanceNav(manifest: JsonObject): boolean {
  return asObject(manifest.workspaceFinance)?.supported === true;
}

function expectsFinanceOps(manifest: JsonObject): boolean {
  const finance = asObject(manifest.workspaceFinance);
  if (finance == null) return false;
  if (finance.opsManifest != null) return true;
  return asObject(finance.capabilities)?.ops === true;
}

function expectsBookingOps(manifest: JsonObject): boolean {
  const booking = asObject(manifest.workspaceBooking);
  if (booking == null) return false;
  return booking.opsManifest != null;
}

function expectsOperatorShellNav(manifest: JsonObject): boolean {
  const shell = asObject(manifest.operatorShell);
  const links = shell?.phase3NavLinks;
  return Array.isArray(links) && links.length > 0;
}

describe("thin-shell-dual-sot-derivation — Phase 4bu", () => {
  it("TS-4BU-01 derivation inventory doc exists and lists dual-SOT pairs", () => {
    const doc = readFileSync(
      resolve(REPO_ROOT, "docs/dev/thin-shell-dual-sot-derivation.mdoc"),
      "utf8"
    );
    assert.match(doc, /wizardCreate\.extendedChrome/);
    assert.match(doc, /workspaceFinance\.supported/);
    assert.match(doc, /financeOps/);
    assert.match(doc, /bookingOps/);
    assert.match(doc, /operatorShell\.phase3NavLinks/);
    assert.match(doc, /without emitting capability codegen/);
    assert.match(doc, /Full codegen of capability stubs/);
  });

  it("TS-4BU-02 denali manifest signals match published capabilities", () => {
    const manifest = readManifest("denali");
    const plugin = getDenaliPlugin();

    assert.equal(expectsWizardExtendedChrome(manifest), true);
    assert.equal(resolveWizardCreateCapability(plugin)?.extendedChrome, true);

    assert.equal(expectsFinanceNav(manifest), true);
    assert.equal(resolveFinanceNavCapability(plugin)?.supported, true);

    assert.equal(expectsFinanceOps(manifest), true);
    assert.equal(typeof resolveFinanceOpsCapability(plugin)?.resolveManifest, "function");

    assert.equal(expectsBookingOps(manifest), true);
    assert.equal(typeof resolveBookingOpsCapability(plugin)?.resolveManifest, "function");

    assert.equal(expectsOperatorShellNav(manifest), false);
    assert.equal(resolveOperatorShellNavCapability(plugin) == null, true);
  });

  it("TS-4BU-03 finance-ws5 / booking-ws2 / urban dual-SOT pairs align", () => {
    const financeManifest = readManifest("finance-ws5");
    const financePlugin = getFinanceWs5Plugin();
    assert.equal(expectsFinanceNav(financeManifest), true);
    assert.equal(resolveFinanceNavCapability(financePlugin)?.supported, true);
    assert.equal(expectsFinanceOps(financeManifest), true);
    assert.equal(typeof resolveFinanceOpsCapability(financePlugin)?.resolveManifest, "function");
    assert.equal(expectsWizardExtendedChrome(financeManifest), false);
    assert.equal(resolveWizardCreateCapability(financePlugin) == null, true);

    const bookingManifest = readManifest("booking-ws2");
    const bookingPlugin = getBookingWs2Plugin();
    assert.equal(expectsBookingOps(bookingManifest), true);
    assert.equal(typeof resolveBookingOpsCapability(bookingPlugin)?.resolveManifest, "function");
    assert.equal(expectsFinanceNav(bookingManifest), false);
    assert.equal(resolveFinanceNavCapability(bookingPlugin) == null, true);

    const urbanManifest = readManifest("urban");
    const urbanPlugin = getUrbanPlugin();
    assert.equal(expectsOperatorShellNav(urbanManifest), true);
    const nav = resolveOperatorShellNavCapability(urbanPlugin);
    assert.ok(nav);
    const expectedLinks = asObject(urbanManifest.operatorShell)?.phase3NavLinks;
    assert.ok(Array.isArray(expectedLinks));
    assert.equal(nav.links.length, expectedLinks.length);
    assert.deepEqual(
      nav.links.map((l) => ({ href: l.href, labelKey: l.labelKey })),
      expectedLinks.map((l) => {
        const row = l as { href: string; labelKey: string };
        return { href: row.href, labelKey: row.labelKey };
      })
    );
  });

  it("TS-4BU-04 negatives: acme has no dual-SOT packaging gates / matching caps", () => {
    const manifest = readManifest("acme");
    const plugin = getAcmePlugin();
    assert.equal(expectsWizardExtendedChrome(manifest), false);
    assert.equal(expectsFinanceNav(manifest), false);
    assert.equal(expectsFinanceOps(manifest), false);
    assert.equal(expectsBookingOps(manifest), false);
    assert.equal(expectsOperatorShellNav(manifest), false);

    assert.equal(resolveWizardCreateCapability(plugin) == null, true);
    assert.equal(resolveFinanceNavCapability(plugin) == null, true);
    assert.equal(resolveFinanceOpsCapability(plugin) == null, true);
    assert.equal(resolveBookingOpsCapability(plugin) == null, true);
    assert.equal(resolveOperatorShellNavCapability(plugin) == null, true);
  });

  it("TS-4BU-05 covenant still forbids codegen-only enablement (doc lock)", () => {
    const remediation = readFileSync(
      resolve(REPO_ROOT, "docs/dev/saas-platform-remediation.mdoc"),
      "utf8"
    );
    assert.match(remediation, /Dual-SOT covenant/);
    assert.match(remediation, /thin-shell-dual-sot-derivation\.mdoc/);
    assert.match(remediation, /Phase \*\*4bu\*\*/);
  });
});
