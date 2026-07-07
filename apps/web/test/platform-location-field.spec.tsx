import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { render } from "@testing-library/react";
import React from "react";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { PlatformLocationField } from "../src/wizard/platform/composites/platform-location-field";
import { resolvePlatformCompositeRenderer } from "../src/wizard/platform/platform-composite-renderers";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const locationFieldSource = readFileSync(
  join(webRoot, "src/wizard/platform/composites/platform-location-field.tsx"),
  "utf8"
);

describe("platform.location composite (P3-B-N-006)", () => {
  it("LO-01 registry resolves platform.location", () => {
    const renderer = resolvePlatformCompositeRenderer("platform.location");
    assert.equal(typeof renderer, "function");
  });

  it("LO-02 field module exports data-platform-location-field marker", () => {
    assert.match(locationFieldSource, /data-platform-location-field/);
    const { container } = render(
      <PlatformLocationField
        draft={emptyTourWizardDraft()}
        onDraftChange={() => undefined}
        canonicalPath="location"
      />
    );
    assert.ok(container.querySelector("[data-platform-location-field]"));
  });
});
