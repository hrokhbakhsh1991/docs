import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { readWizardStepRailOverflowEdges } from "../src/wizard/wizard-step-rail-scroll";

function mockScrollElement(input: {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly scrollLeft: number;
  readonly direction?: "ltr" | "rtl";
}): HTMLElement {
  return {
    scrollWidth: input.scrollWidth,
    clientWidth: input.clientWidth,
    scrollLeft: input.scrollLeft,
  } as unknown as HTMLElement;
}

describe("wizard-step-rail-scroll.spec.ts", () => {
  const originalGetComputedStyle = globalThis.getComputedStyle;

  beforeEach(() => {
    globalThis.getComputedStyle = (() =>
      ({ direction: "ltr" }) as CSSStyleDeclaration) as typeof getComputedStyle;
  });

  afterEach(() => {
    globalThis.getComputedStyle = originalGetComputedStyle;
  });

  it("WEB-WIZ-RAIL-01 reports no overflow when content fits", () => {
    const element = mockScrollElement({
      scrollWidth: 400,
      clientWidth: 400,
      scrollLeft: 0,
    });
    const edges = readWizardStepRailOverflowEdges(element);
    assert.equal(edges.start, false);
    assert.equal(edges.end, false);
  });

  it("WEB-WIZ-RAIL-02 reports end overflow at scroll origin in LTR", () => {
    const element = mockScrollElement({
      scrollWidth: 800,
      clientWidth: 400,
      scrollLeft: 0,
    });
    const edges = readWizardStepRailOverflowEdges(element);
    assert.equal(edges.start, false);
    assert.equal(edges.end, true);
  });

  it("WEB-WIZ-RAIL-03 reports start overflow when scrolled in LTR", () => {
    const element = mockScrollElement({
      scrollWidth: 800,
      clientWidth: 400,
      scrollLeft: 120,
    });
    const edges = readWizardStepRailOverflowEdges(element);
    assert.equal(edges.start, true);
    assert.equal(edges.end, true);
  });
});
