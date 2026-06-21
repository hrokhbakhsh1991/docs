import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { render } from "@testing-library/react";
import React from "react";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { resolveWizardCompositeSurface } from "../src/wizard/wizard-composite-surface-registry";
import { PlatformCompositeField } from "../src/wizard/platform/platform-composite-field";
import { resolvePlatformCompositeRenderer } from "../src/wizard/platform/platform-composite-renderers";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bindingsSource = readFileSync(
  join(webRoot, "src/bootstrap/wizard-surface-bindings.generated.ts"),
  "utf8"
);
const starterPluginSource = readFileSync(
  join(webRoot, "../../packages/workspaces/starter/src/starter.plugin.ts"),
  "utf8"
);

describe("platform composite registry (P3-B-N-010)", () => {
  it("RG-01 resolveWizardCompositeSurface(platform) not null", () => {
    assert.notEqual(resolveWizardCompositeSurface("platform"), null);
  });

  it("RG-02 resolveWizardCompositeSurface(denali) still not null", () => {
    assert.notEqual(resolveWizardCompositeSurface("denali"), null);
  });

  it("RG-03 unknown id platform.nope renders fallback marker", () => {
    const renderer = resolvePlatformCompositeRenderer("platform.nope");
    const node = renderer({
      compositeId: "platform.nope",
      field: {
        fieldId: "test",
        canonicalPath: "test.path",
        kind: "text",
        required: false,
        hidden: false,
        uiHints: { compositeId: "platform.nope" },
      },
      draft: emptyTourWizardDraft(),
      onDraftChange: () => undefined,
    });
    const { container } = render(<>{node}</>);
    assert.ok(container.querySelector("[data-composite-fallback]"));
  });

  it("RG-04 generated bindings contain platform key", () => {
    assert.match(bindingsSource, /"platform": composite_platform\(\)/);
  });

  it("RG-05 starter plugin sets compositeSurfaceId platform", () => {
    assert.match(starterPluginSource, /compositeSurfaceId: "platform"/);
    assert.match(starterPluginSource, /reviewSurfaceId: "platform"/);
  });
});

describe("PlatformCompositeField fallback wiring", () => {
  it("renders fallback for unknown composite via field shell", () => {
    const { container } = render(
      <PlatformCompositeField
        compositeId="platform.nope"
        field={{
          fieldId: "test",
          canonicalPath: "test.path",
          kind: "text",
          required: false,
          hidden: false,
          uiHints: { compositeId: "platform.nope" },
        }}
        draft={emptyTourWizardDraft()}
        onDraftChange={() => undefined}
      />
    );
    assert.ok(container.querySelector('[data-composite-id="platform.nope"]'));
  });
});
