import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliReviewHero,
  buildDenaliReviewSections,
  mergeDenaliReviewDestinationNames,
  type DenaliReviewCatalog,
  type DenaliReviewFormatLabels,
} from "../src/ui/logic/denali-review-format-logic";

const BASE_CATALOG: DenaliReviewCatalog = {
  destinationNameById: new Map(),
  leaderNameById: new Map([["u1", "Guide One"]]),
  themeNameById: new Map([["t1", "Theme One"]]),
  languageNameById: new Map([["l1", "Lang One"]]),
  equipmentIconKeyById: new Map([["g1", "tent"]]),
};

const LABELS: DenaliReviewFormatLabels = {
  fieldLabel: (path) => path,
  stepLabel: (stepId) => stepId,
  tourKindLabel: (slug) => slug,
  transportModeLabel: (mode) => mode,
  publishStatusLabel: (status) => status,
  locationZoneLabel: (path) => path,
  formatDatetime: (iso) => iso,
  yes: "yes",
  no: "no",
  gearRequired: "required",
  gearOptional: "optional",
  photoCount: (count) => `${count}`,
  dayLabel: (day) => `day ${day}`,
  primaryGathering: "primary",
  socialMediaTelegramAutoLabel: "telegram-auto",
};

describe("denali-review-catalog-merge.spec.ts", () => {
  it("DN-REVIEW-CATALOG-01 prefers live destination names over empty review catalog fallback", () => {
    const merged = mergeDenaliReviewDestinationNames(
      BASE_CATALOG,
      new Map([["dest-1", "Smoke Summit"]])
    );
    const hero = buildDenaliReviewHero(
      {
        data: {
          title: "Review test",
          category: "mountain_day",
          destinationId: "dest-1",
        },
      },
      merged,
      LABELS
    );
    assert.equal(hero.destination, "Smoke Summit");

    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Review test",
          category: "mountain_day",
          destinationId: "dest-1",
        },
      },
      merged,
      LABELS
    );
    const basic = sections.find((section) => section.stepId === "denali_basic");
    const destinationRow = basic?.rows.find((row) => row.label === "destinationId");
    assert.equal(destinationRow?.value, "Smoke Summit");
  });

  it("DN-REVIEW-CATALOG-02 preserves other review catalog maps during destination merge", () => {
    const merged = mergeDenaliReviewDestinationNames(
      BASE_CATALOG,
      new Map([["dest-1", "Smoke Summit"]])
    );
    assert.equal(merged.leaderNameById.get("u1"), "Guide One");
    assert.equal(merged.themeNameById.get("t1"), "Theme One");
    assert.equal(merged.languageNameById.get("l1"), "Lang One");
    assert.equal(merged.equipmentIconKeyById.get("g1"), "tent");
  });
});
