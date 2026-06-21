import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildClubSitePreviewUrls } from "../src/platform/create-club/build-club-site-preview";
import {
  buildCreateClubSuccessPath,
  createInitialCreateClubDraft,
  initialCreateClubWizardStep,
  nextCreateClubWizardStep,
  previousCreateClubWizardStep,
} from "../src/platform/create-club/use-create-club-wizard";
import { validateIdentityStep } from "../src/platform/create-club/validate-identity-step";
import { validateOwnerPhoneClient } from "../src/platform/create-club/validate-owner-phone";
import { validateSubdomainClient } from "../src/platform/create-club/validate-subdomain";
import { generateCreateClubIdempotencyKey } from "../src/platform/create-club/submit-create-club";

describe("use-create-club-wizard", () => {
  it("initial step is 1", () => {
    assert.equal(initialCreateClubWizardStep(), 1);
  });

  it("step machine forward and back", () => {
    assert.equal(nextCreateClubWizardStep(1), 2);
    assert.equal(nextCreateClubWizardStep(4), 4);
    assert.equal(previousCreateClubWizardStep(2), 1);
    assert.equal(previousCreateClubWizardStep(1), 1);
  });

  it("success path", () => {
    assert.equal(buildCreateClubSuccessPath("abc"), "/platform/clubs/abc");
  });

  it("initial draft empty", () => {
    const draft = createInitialCreateClubDraft();
    assert.equal(draft.subdomain, "");
    assert.equal(draft.workspaceType, "");
  });
});

describe("validate-subdomain client", () => {
  it("rejects reserved admin", () => {
    const result = validateSubdomainClient("admin");
    assert.equal(result.ok, false);
  });

  it("accepts valid subdomain", () => {
    const result = validateSubdomainClient("my-club");
    assert.equal(result.ok, true);
  });
});

describe("validate identity step", () => {
  it("requires workspace select", () => {
    const draft = createInitialCreateClubDraft();
    draft.subdomain = "valid-club";
    const error = validateIdentityStep(draft, [{ id: "denali", displayName: "Denali" }]);
    assert.match(error ?? "", /workspace/i);
  });
});

describe("validate owner phone", () => {
  it("empty phone error", () => {
    assert.match(validateOwnerPhoneClient("") ?? "", /required/i);
  });
});

describe("build club site preview", () => {
  it("three urls", () => {
    const urls = buildClubSitePreviewUrls("demo");
    assert.match(urls.marketing, /demo\./);
    assert.match(urls.portal, /portal/);
    assert.match(urls.admin, /auth\/login$/);
  });
});

describe("submit create club helpers", () => {
  it("idempotency key is uuid", () => {
    assert.match(generateCreateClubIdempotencyKey(), /^[0-9a-f-]{36}$/i);
  });
});
