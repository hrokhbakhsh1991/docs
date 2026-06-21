import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isKnownWizardMediaRouteKey,
  resolveWizardMediaBackendPaths,
} from "../src/wizard/resolve-wizard-media-backend-path";
import {
  resolveWizardMediaBffPath,
  resolveWizardMediaNeutralBffPath,
} from "../src/wizard/resolve-wizard-media-bff-path";

describe("resolve-wizard-media-bff-path.spec.ts (P13-2)", () => {
  it("P13-2-01 denali mediaRouteKey resolves to legacy BFF path", () => {
    assert.equal(resolveWizardMediaBffPath("wizard-photos"), "/api/tours/wizard-photos");
  });

  it("P13-2-02 unknown mediaRouteKey uses neutral BFF path", () => {
    assert.equal(
      resolveWizardMediaBffPath("future-workspace-media"),
      "/api/wizard-media/future-workspace-media"
    );
    assert.equal(resolveWizardMediaBffPath(""), "/api/tours/wizard-photos");
  });

  it("P13-2-03 neutral BFF path is workspace-plugin keyed", () => {
    assert.equal(
      resolveWizardMediaNeutralBffPath("wizard-photos"),
      "/api/wizard-media/wizard-photos"
    );
    assert.throws(() => resolveWizardMediaNeutralBffPath(""), /WORKSPACE_MEDIA_ROUTE_KEY_REQUIRED/);
  });

  it("P13-2-04 backend paths map wizard-photos to API tour routes", () => {
    assert.equal(isKnownWizardMediaRouteKey("wizard-photos"), true);
    assert.equal(isKnownWizardMediaRouteKey("unknown"), false);
    const paths = resolveWizardMediaBackendPaths("wizard-photos");
    assert.equal(paths.upload, "/tours/wizard-photos");
    assert.equal(paths.signedUrl, "/tours/wizard-photos/url");
    assert.throws(() => resolveWizardMediaBackendPaths("unknown"), /UNKNOWN_WIZARD_MEDIA_ROUTE_KEY/);
  });
});
