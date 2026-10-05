/**
 * DP-5 — operator web contract (BFF routes + test ids).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const webRoot = join(import.meta.dirname, "..");

describe("DP-5 web contract", () => {
  it("transport BFF routes exist", () => {
    const alloc = readFileSync(
      join(webRoot, "app/api/tours/[id]/transport-allocations/route.ts"),
      "utf8"
    );
    assert.match(alloc, /transport-allocations/);
    const freeze = readFileSync(join(webRoot, "app/api/tours/[id]/roster/freeze/route.ts"), "utf8");
    assert.match(freeze, /roster\/freeze/);
    const settlements = readFileSync(
      join(webRoot, "app/api/tours/[id]/driver-settlements/route.ts"),
      "utf8"
    );
    assert.match(settlements, /driver-settlements/);
  });

  it("settlement panel exposes test ids", () => {
    const panel = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/transport/driver-settlement-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.settlementPanel/);
    assert.match(panel, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.freezeButton/);
    assert.match(panel, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.approvePayableButton/);
    assert.match(panel, /if \(!res\.ok\) throw new Error\(`FREEZE_HTTP_\$\{res\.status\}`\)/);
    assert.match(panel, /if \(!confirmResponse\.ok\) throw new Error\("PAYABLE_FAILED"\)/);
    assert.match(panel, /allocationFailed/);
    assert.match(panel, /rosterFrozenLoadFailed/);
    assert.match(panel, /const loaded = await loadSettlements\(\)/);
    assert.match(panel, /normalizeDriverCompensationPerSeat\(unitMinor\)/);
    assert.match(panel, /unitAmountInvalid/);
    assert.match(panel, /inputMode="numeric"/);
    assert.doesNotMatch(panel, /Per-seat \(minor\)|Finalize roster|No settlement yet/);
    assert.match(panel, /formatMinorAmount\(primary\.totalMinor, primary\.currency, locale\)/);
    assert.match(panel, /settlement\.status\.draft/);
    assert.match(panel, /settlementLoadError/);
    assert.match(panel, /settlement\.loadFailed/);
    assert.match(panel, /setSettlements\(\[\]\)/);
    const logic = readFileSync(
      join(webRoot, "src/features/tours/tour-workspace-transport-logic.ts"),
      "utf8"
    );
    assert.match(logic, /operator-tour-workspace-driver-settlement/);
  });
});
