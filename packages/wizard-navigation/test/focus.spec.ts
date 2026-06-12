import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDefaultFieldFocusRegistry,
  focusWizardField,
  mapValidationResultToIssues,
  scrollToFirstIssue,
  waitForWizardFieldMarker,
} from "../src/index";

type MockFocusable = {
  focused: boolean;
  focus: (options?: FocusOptions) => void;
  scrollIntoView: (options?: ScrollIntoViewOptions) => void;
  hasAttribute: (name: string) => boolean;
  getAttribute: (name: string) => string | null;
};

type MockRoot = ParentNode & {
  activeElement: MockFocusable | null;
  querySelector: (selector: string) => Element | null;
};

function createMockFocusable(root: MockRoot): MockFocusable {
  return {
    focused: false,
    focus() {
      this.focused = true;
      root.activeElement = this;
    },
    scrollIntoView() {},
    hasAttribute: () => false,
    getAttribute: () => null,
  };
}

function createMockFieldRoot(path: string): { root: MockRoot; input: MockFocusable } {
  const root = {
    activeElement: null as MockFocusable | null,
    querySelector(selector: string) {
      if (selector.includes(path)) {
        return wrapper;
      }
      return null;
    },
  } as MockRoot;

  const input = createMockFocusable(root);
  const wrapper = {
    querySelector: () => input,
    hasAttribute: () => false,
    getAttribute: () => null,
  } as unknown as Element;

  return { root, input };
}

describe("wizard-navigation focus.spec.ts — Phase 11.4", () => {
  it("PKG-P11-4-01 focusWizardField focuses input by data-field-path", () => {
    const { root, input } = createMockFieldRoot("basics.title");
    const registry = createDefaultFieldFocusRegistry();
    const focused = focusWizardField("basics.title", registry, { root, scroll: false });
    assert.equal(focused, true);
    assert.equal(root.activeElement, input);
    assert.equal(input.focused, true);
  });

  it("PKG-P11-4-02 scrollToFirstIssue calls goToStep then focuses", async () => {
    const { root, input } = createMockFieldRoot("details.summary");
    const steps: string[] = [];
    const registry = createDefaultFieldFocusRegistry();
    const focused = await scrollToFirstIssue(
      [{ path: "details.summary", message: "Required", stepId: "step-b" }],
      registry,
      async (stepId) => {
        steps.push(stepId);
      },
      { root, scroll: false }
    );
    assert.deepEqual(steps, ["step-b"]);
    assert.equal(focused, true);
    assert.equal(root.activeElement, input);
  });

  it("PKG-P11-4-03 mapValidationResultToIssues maps fieldId to path", () => {
    const issues = mapValidationResultToIssues(
      {
        ok: false,
        violations: [
          { code: "REQUIRED_FIELD_EMPTY", fieldId: "basics.title", message: "Title required" },
        ],
      },
      { resolveStepId: (fieldId) => (fieldId === "basics.title" ? "basics" : undefined) }
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.path, "basics.title");
    assert.equal(issues[0]?.stepId, "basics");
    assert.equal(issues[0]?.message, "Title required");
  });

  it("PKG-P11-4-04 waitForWizardFieldMarker polls until field mounts", async () => {
    let mounted = false;
    const root = {
      activeElement: null as MockFocusable | null,
      querySelector(selector: string) {
        if (!mounted || !selector.includes("delayed.field")) {
          return null;
        }
        return wrapper;
      },
    } as MockRoot;

    const input = createMockFocusable(root);
    const wrapper = {
      querySelector: () => input,
      hasAttribute: () => false,
      getAttribute: () => null,
    } as unknown as Element;

    const registry = createDefaultFieldFocusRegistry();
    const pending = waitForWizardFieldMarker("delayed.field", registry, {
      root,
      timeoutMs: 500,
      intervalMs: 25,
    });
    setTimeout(() => {
      mounted = true;
    }, 80);
    const match = await pending;
    assert.notEqual(match, null);
  });

  it("PKG-P11-4-05 scrollToFirstIssue waits for field after goToStep", async () => {
    let mounted = false;
    const root = {
      activeElement: null as MockFocusable | null,
      querySelector(selector: string) {
        if (!mounted || !selector.includes("details.summary")) {
          return null;
        }
        return wrapper;
      },
    } as MockRoot;

    const input = createMockFocusable(root);
    const wrapper = {
      querySelector: () => input,
      hasAttribute: () => false,
      getAttribute: () => null,
    } as unknown as Element;

    const steps: string[] = [];
    const registry = createDefaultFieldFocusRegistry();
    const focusedPromise = scrollToFirstIssue(
      [{ path: "details.summary", message: "Required", stepId: "step-b" }],
      registry,
      async (stepId) => {
        steps.push(stepId);
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            mounted = true;
            resolve();
          }, 60);
        });
      },
      { root, scroll: false }
    );
    const focused = await focusedPromise;
    assert.deepEqual(steps, ["step-b"]);
    assert.equal(focused, true);
    assert.equal(root.activeElement, input);
  });
});
