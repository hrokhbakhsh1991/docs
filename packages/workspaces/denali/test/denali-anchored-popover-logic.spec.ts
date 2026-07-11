import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_WIZARD_MOBILE_MAX_WIDTH_PX,
  resolveDenaliAnchoredPopoverPlacement,
  shouldUseDenaliWizardCustomSelectPanel,
} from "../src/ui/logic/denali-anchored-popover-logic";

describe("resolveDenaliAnchoredPopoverPlacement", () => {
  it("opens below the trigger when space allows", () => {
    const placement = resolveDenaliAnchoredPopoverPlacement({
      triggerRect: { top: 100, bottom: 140, left: 16, width: 280 },
      viewportWidth: 390,
      viewportHeight: 844,
    });
    assert.equal(placement.top, 148);
    assert.equal(placement.left, 16);
    assert.equal(placement.width, 280);
    assert.ok(placement.maxHeight >= 120);
  });

  it("flips above the trigger when below space is tight", () => {
    const placement = resolveDenaliAnchoredPopoverPlacement({
      triggerRect: { top: 700, bottom: 740, left: 16, width: 280 },
      viewportWidth: 390,
      viewportHeight: 800,
      minPanelHeight: 160,
    });
    assert.ok(placement.top < 700);
  });
});

describe("shouldUseDenaliWizardCustomSelectPanel", () => {
  it("uses custom panel on mobile even for short lists", () => {
    assert.equal(
      shouldUseDenaliWizardCustomSelectPanel(3, 8, DENALI_WIZARD_MOBILE_MAX_WIDTH_PX),
      true
    );
  });

  it("keeps native select on wide viewports for short lists", () => {
    assert.equal(shouldUseDenaliWizardCustomSelectPanel(3, 8, 1024), false);
  });
});
