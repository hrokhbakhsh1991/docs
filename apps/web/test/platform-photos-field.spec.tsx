import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { render } from "@testing-library/react";
import React from "react";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { PlatformPhotosField } from "../src/wizard/platform/composites/platform-photos-field";
import { resolvePlatformCompositeRenderer } from "../src/wizard/platform/platform-composite-renderers";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const photosFieldSource = readFileSync(
  join(webRoot, "src/wizard/platform/composites/platform-photos-field.tsx"),
  "utf8"
);

describe("platform.photos composite (P3-B-N-004)", () => {
  it("PH-01 resolvePlatformCompositeRenderer(platform.photos) is function", () => {
    const renderer = resolvePlatformCompositeRenderer("platform.photos");
    assert.equal(typeof renderer, "function");
  });

  it("PH-02 photos field source exposes data-platform-photos-field marker", () => {
    assert.match(photosFieldSource, /data-platform-photos-field/);
  });

  it("PH-03 without session sets upload disabled marker", () => {
    const { container } = render(
      <PlatformPhotosField
        draft={emptyTourWizardDraft()}
        onDraftChange={() => undefined}
        canonicalPath="photos"
      />
    );
    const root = container.querySelector("[data-platform-photos-field]");
    assert.ok(root);
    assert.equal(root.getAttribute("data-photos-upload-disabled"), "true");
  });
});
