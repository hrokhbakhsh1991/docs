/**
 * PR18-A — Command Bridge UX architecture proofs (no mutation UI).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_COMMAND_BRIDGE_UX_ACTION_LIFECYCLE,
  FINANCE_COMMAND_BRIDGE_UX_FAILURE_CLASSES,
  FINANCE_COMMAND_BRIDGE_UX_MAY_DISPLAY,
  FINANCE_COMMAND_BRIDGE_UX_MUST_NEVER,
  FINANCE_COMMAND_BRIDGE_UX_READINESS,
  commandCapabilityGrantsPermission,
  commandDiscoveryMayExecute,
  isCommandTokenDiscovered,
  projectCommandBridgeUxDiscovery,
} from "../src/finance/finance-command-bridge-ux-architecture";
import type { CaseCommandCapabilityContract } from "@/finance/finance-case-encounter-ui";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const FINANCE_SRC = join(WEB_ROOT, "src/finance");
const BRIDGE_DOC = join(
  REPO_ROOT,
  "docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md"
);
const OP_DOC = join(
  REPO_ROOT,
  "docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_EXPERIENCE.md"
);
const BOUNDARY = join(
  REPO_ROOT,
  "docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md"
);
const FINANCE_CORE = join(REPO_ROOT, "packages/finance-core/src");
const COMMAND_BRIDGE = join(
  REPO_ROOT,
  "apps/api/src/workspace-finance/case/command-bridge"
);
const ENCOUNTER_UI = join(REPO_ROOT, "packages/finance-case-encounter-ui/src");

function walkTs(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkTs(full, files);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

describe("PR18-A command bridge UX architecture", () => {
  it("1 — discovery separates from permission; capability never grants execute", () => {
    const capability: CaseCommandCapabilityContract = {
      supportedCommands: ["reviewReceipt"],
      reviewReceipt: {
        availableTokens: ["approve_evidence"],
        endpoint: "/finance/case/commands/review-receipt",
      },
    };
    const discovery = projectCommandBridgeUxDiscovery(capability);
    assert.equal(discovery.layer, "discovery");
    assert.equal(discovery.grantsPermission, false);
    assert.equal(discovery.mayExecute, false);
    assert.ok(discovery.availableTokens.includes("approve_evidence"));
    assert.equal(isCommandTokenDiscovered(discovery, "approve_evidence"), true);
    assert.equal(isCommandTokenDiscovered(discovery, "reject_evidence"), false);
    assert.equal(commandCapabilityGrantsPermission(capability), false);
    assert.equal(commandDiscoveryMayExecute(discovery), false);

    const empty = projectCommandBridgeUxDiscovery(null);
    assert.deepEqual(empty.availableTokens, []);
    assert.equal(empty.mayExecute, false);
  });

  it("2 — action lifecycle + failure classes + display locks are documented in module", () => {
    assert.deepEqual([...FINANCE_COMMAND_BRIDGE_UX_ACTION_LIFECYCLE], [
      "discover",
      "select",
      "confirm",
      "submit",
      "resolve",
      "refresh",
    ]);
    assert.ok(FINANCE_COMMAND_BRIDGE_UX_FAILURE_CLASSES.includes("stale"));
    assert.ok(FINANCE_COMMAND_BRIDGE_UX_FAILURE_CLASSES.includes("sot_rejected"));
    assert.ok(FINANCE_COMMAND_BRIDGE_UX_MAY_DISPLAY.includes("command_capability_metadata"));
    assert.ok(FINANCE_COMMAND_BRIDGE_UX_MUST_NEVER.includes("capability_as_permission"));
    assert.ok(FINANCE_COMMAND_BRIDGE_UX_MUST_NEVER.includes("direct_finance_service_call"));
    assert.equal(FINANCE_COMMAND_BRIDGE_UX_READINESS, "READY_FOR_UI_IMPLEMENTATION");
  });

  it("3 — Meaning / Command Center UI cannot mutate directly; no bridge runner imports", () => {
    const shell = readFileSync(
      join(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.doesNotMatch(shell, /approveReceipt|rejectReceipt|reviewReceipt\(/);
    assert.doesNotMatch(shell, /runReviewReceiptCommandBridge|FinanceService/);
    assert.match(shell, /FinanceCommercialMeaningEmbed/);

    const meaningFiles = readdirSync(FINANCE_SRC).filter(
      (n) => n.includes("commercial-meaning") || n.includes("command-bridge-ux")
    );
    for (const name of meaningFiles) {
      const src = readFileSync(join(FINANCE_SRC, name), "utf8");
      assert.doesNotMatch(
        src,
        /from\s+["'].*command-bridge|runReviewReceiptCommandBridge|createManualPayment/
      );
      assert.doesNotMatch(
        src,
        /from\s+["']@app-tour\/finance-core|import\s+["']@app-tour\/finance-core/
      );
      assert.doesNotMatch(
        src,
        /import\s+(?:type\s+)?\{[^}]*\b(CaseOutput|FactSnapshot)\b[^}]*\}\s+from/
      );
      assert.doesNotMatch(src, /from\s+["']stripe|paypal|braintree/i);
    }

    const capabilityUi = readFileSync(
      join(ENCOUNTER_UI, "sections/command-capability.tsx"),
      "utf8"
    );
    assert.match(capabilityUi, /Read-only|no approve\/reject|display only/i);
    assert.doesNotMatch(capabilityUi, /<button[^>]*(approve|reject)/i);
  });

  it("4 — Host command bridge remains isolated; finance-core case kernel has no bridge UX", () => {
    const bridgeIndex = readFileSync(join(COMMAND_BRIDGE, "index.ts"), "utf8");
    assert.match(bridgeIndex, /runReviewReceiptCommandBridge|CaseCommandIntent/);
    assert.doesNotMatch(bridgeIndex, /finance-command-bridge-ux|apps\/web/);

    const intent = readFileSync(join(COMMAND_BRIDGE, "case-command-intent.ts"), "utf8");
    assert.match(intent, /FORBIDDEN_CASE_COMMAND_MUTATIONS/);
    assert.match(intent, /Does not authorize/);

    const caseRoot = join(FINANCE_CORE, "case");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /command-bridge-ux|runReviewReceiptCommandBridge|apps\/web/i);
      assert.doesNotMatch(
        src,
        /from\s+["'][^"']*workspace-finance\/case\/command-bridge/
      );
    }

    const uxArch = readFileSync(
      join(FINANCE_SRC, "finance-command-bridge-ux-architecture.ts"),
      "utf8"
    );
    assert.doesNotMatch(
      uxArch,
      /from\s+["']@app-tour\/finance-core|import\s+["']@app-tour\/finance-core/
    );
    assert.match(uxArch, /grantsPermission: false/);
    assert.match(uxArch, /mayExecute: false/);
  });

  it("5 — docs lock PR18-A architecture + READY_FOR_UI_IMPLEMENTATION", () => {
    const bridgeDoc = readFileSync(BRIDGE_DOC, "utf8");
    assert.match(bridgeDoc, /PR18-A/);
    assert.match(bridgeDoc, /Capability discovery/);
    assert.match(bridgeDoc, /grantsPermission|never a grant/i);
    assert.match(bridgeDoc, /READY_FOR_UI_IMPLEMENTATION/);
    assert.match(bridgeDoc, /Does not ship:.*UI buttons|no buttons/i);

    const op = readFileSync(OP_DOC, "utf8");
    assert.match(op, /PR18-A/);
    assert.match(op, /commandCapability.*permission|capability_grants_permission/i);

    const boundary = readFileSync(BOUNDARY, "utf8");
    assert.match(boundary, /v46|v47|PR18-A/);
    assert.match(boundary, /Command Bridge UX Architecture/);
  });
});
