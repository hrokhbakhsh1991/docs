import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { render } from "@testing-library/react";

import type { RenderFieldPlan } from "@app-tour/platform-core";

import {
  DEFERRED_WIZARD_FIELD_KINDS,
  SUPPORTED_WIZARD_FIELD_KINDS,
  WizardField,
} from "../src/wizard/wizard-field";

function fieldPlan(kind: RenderFieldPlan["kind"]): RenderFieldPlan {
  return {
    fieldId: `basics.${kind}`,
    kind,
    canonicalPath: `basics.${kind}`,
    required: false,
    hidden: false,
    stepId: "basics",
  };
}

describe("WizardField renderers", () => {
  it("exposes number and date as supported shell kinds (composite deferred)", () => {
    assert.ok(SUPPORTED_WIZARD_FIELD_KINDS.includes("number"));
    assert.ok(SUPPORTED_WIZARD_FIELD_KINDS.includes("date"));
    assert.deepEqual(DEFERRED_WIZARD_FIELD_KINDS, ["composite"]);
  });

  it("renders number input via ui-primitives Input", () => {
    const { container } = render(
      <WizardField field={fieldPlan("number")} value="42" onChange={() => {}} />
    );
    const input = container.querySelector('input[type="number"]');
    assert.ok(input);
    assert.equal((input as HTMLInputElement).value, "42");
  });

  it("renders date input via ui-primitives Input", () => {
    const { container } = render(
      <WizardField field={fieldPlan("date")} value="2026-06-06" onChange={() => {}} />
    );
    const input = container.querySelector('input[type="date"]');
    assert.ok(input);
    assert.equal((input as HTMLInputElement).value, "2026-06-06");
  });

  it("shows unsupported fallback for composite kind", () => {
    const { container } = render(
      <WizardField field={fieldPlan("composite")} value="" onChange={() => {}} />
    );
    const fallback = container.querySelector('[data-unsupported-kind="composite"]');
    assert.ok(fallback);
    assert.match(fallback?.textContent ?? "", /composite/);
  });
});
