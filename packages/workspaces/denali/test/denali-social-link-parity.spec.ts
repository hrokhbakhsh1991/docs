/**
 * Social link field parity — Create/Edit Tour ↔ Telegram delivery.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { prepareDenaliSubmitArtifact } from "../src/acl/migrateDenaliCanonical";
import {
  emptyDenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../src/draft/denali-tour-wizard-draft";
import { DENALI_DELIVERABLE_FIELD_IDS } from "../src/exposure/denali-exposure-surfaces";
import { normalizeSocialMediaLink } from "../src/ui/logic/denali-social-media-link-logic";
import { enrichCanonicalDeliveryPayload } from "../../../../apps/api/src/integrations/application/enrich-canonical-delivery-payload";
import { formatIntegrationDeliveryMessage } from "../../../../apps/api/src/integrations/platform/format-integration-delivery-message";

const SRC_ROOT = join(import.meta.dirname, "../src");
const SOCIAL_URL = "https://t.me/example-group";

describe("denali-social-link-parity.spec.ts", () => {
  it("DN-SOCIAL-PARITY-A create field exposes manual URL input", () => {
    const field = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-social-media-link-field.tsx"),
      "utf8"
    );
    assert.match(field, /DENALI_SOCIAL_MEDIA_TEST_IDS\.input/);
    assert.match(field, /normalizeSocialMediaLink/);
    assert.doesNotMatch(field, /telegramAutoInfo/);
    assert.doesNotMatch(field, /selectKind/);
  });

  it("DN-SOCIAL-PARITY-B draft stores normalized socialMediaLink", () => {
    const normalized = normalizeSocialMediaLink("https://t.me/example-group");
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;

    let draft = emptyDenaliTourWizardDraft();
    draft = setCanonicalStringValue(draft, "socialMediaLink", normalized.value);
    assert.equal(getCanonicalStringValue(draft, "socialMediaLink"), SOCIAL_URL);
  });

  it("DN-SOCIAL-PARITY-C create submit artifact persists socialMediaLink", () => {
    const artifact = prepareDenaliSubmitArtifact({
      basicInfo: { socialMediaLink: SOCIAL_URL },
    });
    assert.equal(artifact.socialMediaLink, SOCIAL_URL);
  });

  it("DN-SOCIAL-PARITY-D edit hydrates stored link from canonical draft", () => {
    const draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "socialMediaLink", SOCIAL_URL);
    assert.equal(getCanonicalStringValue(draft, "socialMediaLink"), SOCIAL_URL);
  });

  it("DN-SOCIAL-PARITY-E clearing link persists empty string", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "socialMediaLink", SOCIAL_URL);
    draft = setCanonicalStringValue(draft, "socialMediaLink", "");
    assert.equal(getCanonicalStringValue(draft, "socialMediaLink"), "");
  });

  it("DN-SOCIAL-PARITY-F telegram deliverable registry includes social field", () => {
    assert.ok(DENALI_DELIVERABLE_FIELD_IDS.includes("denali.social-media-link"));
    const registry = readFileSync(join(SRC_ROOT, "field-registry/denaliFieldRegistryData.ts"), "utf8");
    assert.match(registry, /canonicalPath: "socialMediaLink"/);
    assert.match(registry, /deliverable/);
    assert.doesNotMatch(registry, /telegramIntegrationActive[\s\S]*socialMediaLink/);
  });

  it("DN-SOCIAL-PARITY-G delivery enriches and renders social link; empty omits line", async () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: { socialMediaLink: SOCIAL_URL, title: "Day hike" },
      eligibleFieldIds: ["denali.social-media-link", "title"],
      definitions: [
        {
          id: "denali.social-media-link",
          workspaceType: "denali",
          canonicalPath: "socialMediaLink",
          kind: "text",
          version: 1,
        },
        {
          id: "title",
          workspaceType: "denali",
          canonicalPath: "title",
          kind: "text",
          version: 1,
        },
      ],
    });
    assert.equal(enriched.fieldValues["denali.social-media-link"], SOCIAL_URL);

    const rendered = await formatIntegrationDeliveryMessage({
      workspaceType: "denali",
      eventType: "TourPublished",
      payload: {
        title: "Day hike",
        aggregateId: "tour-1",
        integrationDeliveryFieldIds: ["denali.social-media-link", "title"],
        integrationDeliveryFieldValues: enriched.fieldValues,
      },
    });
    assert.match(rendered, /Day hike/);
    assert.match(rendered, /example-group|t\.me/);

    const emptyRendered = await formatIntegrationDeliveryMessage({
      workspaceType: "denali",
      eventType: "TourPublished",
      payload: {
        title: "Day hike",
        aggregateId: "tour-1",
        integrationDeliveryFieldIds: ["denali.social-media-link", "title"],
        integrationDeliveryFieldValues: { title: "Day hike" },
      },
    });
    assert.doesNotMatch(emptyRendered, /Social Media Link: \s*$/m);
    assert.doesNotMatch(emptyRendered, /Group \/ Social Link:\s*$/m);
  });
});
