import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDenaliWizardDraftPhotoReadKeyAllowed } from "@app-tour/workspace-denali";

import {
  resolveWizardMediaBinding,
  workspaceSupportsWizardMedia,
} from "../src/tours/workspace-wizard-media-dispatch";

describe("workspace-wizard-media-dispatch (P13-1)", () => {
  it("P13-1-01 denali resolves wizard media binding", () => {
    const binding = resolveWizardMediaBinding("denali");
    assert.ok(binding);
    assert.equal(binding.workspaceType, "denali");
    assert.equal(typeof binding.putDraftPhoto, "function");
    assert.equal(typeof binding.getSignedReadUrl, "function");
    assert.equal(binding.maxUploadBytes > 0, true);
  });

  it("P13-1-02 starter and urban have no wizard media binding", () => {
    assert.equal(workspaceSupportsWizardMedia("starter"), false);
    assert.equal(workspaceSupportsWizardMedia("urban"), false);
    assert.equal(resolveWizardMediaBinding("starter"), undefined);
    assert.equal(resolveWizardMediaBinding("urban"), undefined);
  });

  it("P13-1-03 isDraftReadKeyAllowed delegates to denali scope helper", () => {
    const binding = resolveWizardMediaBinding("denali");
    assert.ok(binding);
    const tenantId = "tenant-abc";
    const allowedKey = `${tenantId}/wizard-drafts/session/photos/photo`;
    assert.equal(binding.isDraftReadKeyAllowed(tenantId, allowedKey), true);
    assert.equal(
      binding.isDraftReadKeyAllowed(tenantId, allowedKey),
      isDenaliWizardDraftPhotoReadKeyAllowed(tenantId, allowedKey)
    );
    assert.equal(binding.isDraftReadKeyAllowed(tenantId, `${tenantId}/tours/t1/photos/p1`), false);
  });
});
