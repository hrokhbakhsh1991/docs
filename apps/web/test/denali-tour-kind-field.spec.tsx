/**
 * Denali tour kind field — always-visible picker + selection banner render contract.
 */
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { loadAppMessages } from "../src/i18n/load-messages";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { applyDenaliDefaultTourKind } from "../src/wizard/denali/denali-default-tour-kind";
import { DenaliTourKindField } from "../src/wizard/denali/denali-tour-kind-field";
import { DENALI_TOUR_KIND_TEST_IDS } from "../src/wizard/denali/denali-tour-kind-test-ids";

let testMessages: AbstractIntlMessages;

before(async () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  testMessages = await loadAppMessages("en");
});

afterEach(() => {
  cleanup();
});

function renderTourKindField(
  draft: ReturnType<typeof emptyTourWizardDraft>,
  onDraftChange?: (next: ReturnType<typeof emptyTourWizardDraft>) => void
) {
  let current = draft;
  const handleChange = onDraftChange ?? ((next: typeof draft) => {
    current = next;
  });
  const view = render(
    <NextIntlClientProvider locale="en" messages={testMessages}>
      <DenaliTourKindField draft={current} onDraftChange={handleChange} />
    </NextIntlClientProvider>
  );
  return { view, getDraft: () => current };
}

describe("denali-tour-kind-field.spec.tsx", () => {
  it("DWC-TK-UI-01 default draft shows banner + visible active category/duration buttons", () => {
    const { view } = renderTourKindField(applyDenaliDefaultTourKind(emptyTourWizardDraft()));

    const summary = view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.summary);
    assert.match(summary.textContent ?? "", /Mountain/);
    assert.match(summary.textContent ?? "", /Single day/);

    const mountain = view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.category("mountain"));
    const singleDay = view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.duration("single_day"));
    assert.equal(mountain.className.includes("denali-tour-kind__choice--active"), true);
    assert.equal(singleDay.className.includes("denali-tour-kind__choice--active"), true);
    assert.ok(view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.picker));
  });

  it("DWC-TK-UI-02 empty draft shows placeholder and all choice buttons", () => {
    const { view } = renderTourKindField(emptyTourWizardDraft());

    assert.match(view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.summary).textContent ?? "", /Select tour type/);
    assert.equal(
      view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.category("mountain")).className.includes("--active"),
      false
    );
    assert.ok(view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.duration("multi_day")));
  });

  it("DWC-TK-UI-03 clicking category updates slug while picker stays visible", () => {
    let current = applyDenaliDefaultTourKind(emptyTourWizardDraft());
    const { view } = renderTourKindField(current, (next) => {
      current = next;
    });

    fireEvent.click(view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.category("nature")));
    assert.equal(getCanonicalStringValue(current, "category"), "nature_day");
    assert.ok(view.getByTestId(DENALI_TOUR_KIND_TEST_IDS.picker));
  });
});
