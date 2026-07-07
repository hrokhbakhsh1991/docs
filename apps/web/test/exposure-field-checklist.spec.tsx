import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, before, describe, it } from "node:test";
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";

import {
  EXPOSURE_FIELD_CHECKLIST_TEST_IDS,
  ExposureFieldChecklist,
} from "../src/exposure/ExposureFieldChecklist";

const WEB_ROOT = join(import.meta.dirname, "..");

function readWebSource(path: string): string {
  return readFileSync(join(WEB_ROOT, path), "utf8");
}

const FIELDS = [
  { id: "title", canonicalPath: "title", adminLabel: "Title", group: "Basics" },
  { id: "denali.destination", canonicalPath: "denali.destination", adminLabel: "Destination", group: "Basics" },
];

before(() => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
});

afterEach(() => {
  cleanup();
});

describe("ExposureFieldChecklist ownership boundary", () => {
  it("keeps the reusable checklist outside integration ownership", () => {
    const source = readWebSource("src/exposure/ExposureFieldChecklist.tsx");
    assert.match(source, /export function ExposureFieldChecklist/);
    assert.doesNotMatch(source, /@\/integrations/);
    assert.doesNotMatch(source, /patchIntegration/);
  });

  it("pure selection logic has no React or integration dependency", () => {
    const source = readWebSource("src/exposure/exposure-field-selection.ts");
    assert.doesNotMatch(source, /from\s+["']react["']/);
    assert.doesNotMatch(source, /@\/integrations/);
  });

  it("embeds the generic checklist with a provider-derived surface (no hardcoded telegram)", () => {
    const source = readWebSource(
      "app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx",
    );
    assert.match(source, /ExposureFieldChecklist/);
    assert.match(source, /resolveExposureIntentContextFromPersisted/);
    assert.match(source, /exposureCandidateFields/);
    assert.match(source, /customizeFieldsLabel/);
    assert.match(source, /settings\.exposure\.fieldChecklist/);
    assert.match(source, /resolveExposureFieldSelectionFromPersisted/);
    assert.match(source, /toExposureChecklistFields/);
    assert.doesNotMatch(source, /IntegrationDeliveryCandidateFieldMeta/);
  });
});

describe("ExposureFieldChecklist rendering", () => {
  it("exposes context dimensions as data attributes", () => {
    const { getByTestId } = render(
      <ExposureFieldChecklist
        context={{ surface: "telegram", audience: "external_channel", trigger: "TourCreated" }}
        fields={FIELDS}
        selectedFieldIds={["title"]}
        emptyLabel="empty"
        selectedSummary="1 selected"
        onFieldToggle={() => {}}
      />,
    );
    const root = getByTestId(EXPOSURE_FIELD_CHECKLIST_TEST_IDS.root);
    assert.equal(root.getAttribute("data-surface"), "telegram");
    assert.equal(root.getAttribute("data-audience"), "external_channel");
    assert.equal(root.getAttribute("data-trigger"), "TourCreated");
  });

  it("renders the empty state when no fields are provided", () => {
    const { getByTestId } = render(
      <ExposureFieldChecklist
        context={{ surface: "telegram", audience: "external_channel", trigger: "TourCreated" }}
        fields={[]}
        selectedFieldIds={[]}
        emptyLabel="no fields here"
        selectedSummary="0 selected"
        onFieldToggle={() => {}}
      />,
    );
    assert.equal(getByTestId(EXPOSURE_FIELD_CHECKLIST_TEST_IDS.empty).textContent, "no fields here");
  });

  it("renders one control per field and the selected summary", () => {
    const { container, getByText } = render(
      <ExposureFieldChecklist
        context={{ surface: "telegram", audience: "external_channel", trigger: "TourCreated" }}
        fields={FIELDS}
        selectedFieldIds={["title"]}
        emptyLabel="empty"
        selectedSummary="1 field selected"
        onFieldToggle={() => {}}
      />,
    );
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    assert.equal(checkboxes.length, 2);
    assert.ok(getByText("Title"));
    assert.ok(getByText("Destination"));
    assert.ok(getByText("1 field selected"));
  });

  it("reports toggles through props without owning state", () => {
    const toggles: Array<{ id: string; checked: boolean }> = [];
    const { container } = render(
      <ExposureFieldChecklist
        context={{ surface: "telegram", audience: "external_channel", trigger: "TourCreated" }}
        fields={FIELDS}
        selectedFieldIds={["title"]}
        emptyLabel="empty"
        selectedSummary="1 selected"
        onFieldToggle={(id, checked) => toggles.push({ id, checked })}
      />,
    );
    const labels = Array.from(container.querySelectorAll("label"));
    const destinationLabel = labels.find((label) => label.textContent?.includes("Destination"));
    const destinationCheckbox = destinationLabel?.querySelector('input[type="checkbox"]');
    assert.ok(destinationCheckbox);
    fireEvent.click(destinationCheckbox as HTMLInputElement);
    assert.deepEqual(toggles, [{ id: "denali.destination", checked: true }]);
  });

  it("filters fields with search when enterprise labels are provided", () => {
    const { getByTestId, queryByText } = render(
      <ExposureFieldChecklist
        context={{ surface: "public_list", audience: "public", trigger: "always" }}
        fields={FIELDS}
        selectedFieldIds={[]}
        emptyLabel="empty"
        selectedSummary="0 selected"
        labels={{
          searchPlaceholder: "Search fields",
          selectAllInGroup: "Select all",
          clearGroup: "Clear group",
          selectedOfTotal: "{selected} of {total} selected",
        }}
        onFieldToggle={() => {}}
      />,
    );

    fireEvent.change(getByTestId(EXPOSURE_FIELD_CHECKLIST_TEST_IDS.search), {
      target: { value: "destination" },
    });
    assert.ok(queryByText("Destination"));
    assert.equal(queryByText("Title"), null);
  });

  it("selects all fields in a group from the group action", () => {
    const toggles: Array<{ id: string; checked: boolean }> = [];
    const { getAllByTestId } = render(
      <ExposureFieldChecklist
        context={{ surface: "public_list", audience: "public", trigger: "always" }}
        fields={FIELDS}
        selectedFieldIds={[]}
        emptyLabel="empty"
        selectedSummary="0 selected"
        labels={{
          searchPlaceholder: "Search fields",
          selectAllInGroup: "Select all",
          clearGroup: "Clear group",
          selectedOfTotal: "{selected} of {total} selected",
        }}
        onFieldToggle={(id, checked) => toggles.push({ id, checked })}
      />,
    );

    fireEvent.click(getAllByTestId(EXPOSURE_FIELD_CHECKLIST_TEST_IDS.groupSelectAll)[0] as HTMLButtonElement);
    assert.equal(toggles.length, 2);
    assert.ok(toggles.some((toggle) => toggle.id === "title" && toggle.checked));
    assert.ok(toggles.some((toggle) => toggle.id === "denali.destination" && toggle.checked));
  });
});
