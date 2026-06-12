import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import { render, waitFor } from "@testing-library/react";

import type { RenderFieldPlan } from "@app-tour/platform-core";

import { loadAppMessages } from "../src/i18n/load-messages";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import {
  DEFERRED_WIZARD_FIELD_KINDS,
  SUPPORTED_WIZARD_FIELD_KINDS,
  WizardField,
} from "../src/wizard/wizard-field";
import { DENALI_COMPOSITE_TEST_IDS } from "../src/wizard/denali/denali-location-types";

let testMessages: AbstractIntlMessages;

before(async () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  testMessages = await loadAppMessages("en");
});

function renderWizardField(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={testMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

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
    const { container } = renderWizardField(
      <WizardField field={fieldPlan("number")} value="42" onChange={() => {}} />
    );
    const input = container.querySelector('input[inputmode="decimal"]');
    assert.ok(input);
    assert.equal((input as HTMLInputElement).type, "text");
  });

  it("renders date field via localized date picker", () => {
    const { container } = renderWizardField(
      <WizardField field={fieldPlan("date")} value="2026-06-06" onChange={() => {}} />
    );
    const trigger = container.querySelector("button");
    assert.ok(trigger);
    assert.match(trigger?.textContent ?? "", /Jun/);
  });

  it("shows unsupported fallback for composite kind with human label", () => {
    const { container } = renderWizardField(
      <WizardField field={fieldPlan("composite")} value="" onChange={() => {}} />
    );
    const fallback = container.querySelector('[data-unsupported-kind="composite"]');
    assert.ok(fallback);
    assert.match(fallback?.textContent ?? "", /Composite/);
    assert.match(fallback?.textContent ?? "", /specialized editor/);
  });

  it("renders denali location zones composite when draft binding is provided", async () => {
    const field: RenderFieldPlan = {
      fieldId: "denali.location-zones",
      kind: "composite",
      canonicalPath: "startPoint",
      required: false,
      hidden: false,
      stepId: "denali_logistics",
      uiHints: { compositeId: "denali.location-zones" },
    };
    const { container } = renderWizardField(
      <WizardField
        field={field}
        value=""
        onChange={() => {}}
        pluginId="denali"
        compositeSurfaceId="denali"
        draft={emptyTourWizardDraft()}
        onDraftChange={() => {}}
      />
    );
    await waitFor(() => {
      assert.ok(
        container.querySelector(`[data-testid="${DENALI_COMPOSITE_TEST_IDS.locationZones}"]`)
      );
    });
  });
});
