import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDenaliWizardDraftSessionId,
  isDenaliWizardDraftSessionId,
} from "../src/photos/wizard-draft-session-id";
import {
  denaliImageFileAssetSchema,
  isDenaliHttpsImageUrl,
} from "../src/schemas/denaliFileAssetSchema";

describe("denali-file-asset-schema.spec.ts", () => {
  it("isDenaliHttpsImageUrl accepts https only", () => {
    assert.equal(isDenaliHttpsImageUrl("https://cdn.example.com/a.jpg"), true);
    assert.equal(isDenaliHttpsImageUrl("http://cdn.example.com/a.jpg"), false);
    assert.equal(isDenaliHttpsImageUrl("javascript:alert(1)"), false);
    assert.equal(isDenaliHttpsImageUrl("not-a-url"), false);
  });

  it("denaliImageFileAssetSchema rejects non-https url", () => {
    const result = denaliImageFileAssetSchema.safeParse({
      id: "photo-1",
      url: "http://example.com/a.jpg",
    });
    assert.equal(result.success, false);
  });

  it("denaliImageFileAssetSchema accepts storageKey or https url", () => {
    assert.equal(
      denaliImageFileAssetSchema.safeParse({
        id: "photo-1",
        storageKey: "tenant/wizard-drafts/s/photos/p",
      }).success,
      true
    );
    assert.equal(
      denaliImageFileAssetSchema.safeParse({
        id: "photo-1",
        url: "https://cdn.example.com/a.jpg",
      }).success,
      true
    );
  });

  it("createDenaliWizardDraftSessionId returns UUID shape", () => {
    const sessionId = createDenaliWizardDraftSessionId();
    assert.equal(isDenaliWizardDraftSessionId(sessionId), true);
  });
});
