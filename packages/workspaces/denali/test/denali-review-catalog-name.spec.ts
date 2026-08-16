import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliReviewSections,
  isDenaliReviewOpaqueCatalogId,
  resolveDenaliReviewCatalogName,
  type DenaliReviewCatalog,
  type DenaliReviewFormatLabels,
} from "../src/ui/logic/denali-review-format-logic";

const EMPTY_CATALOG: DenaliReviewCatalog = {
  destinationNameById: new Map(),
  leaderNameById: new Map(),
  themeNameById: new Map(),
  languageNameById: new Map(),
  equipmentIconKeyById: new Map(),
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
  socialMediaTelegramAutoLabel: "Telegram",
};

describe("denali-review-catalog-name.spec.ts", () => {
  const destId = "00000000-0000-4000-8000-000000000705";

  it("DEN-REV-CATALOG-01 never echoes a UUID when the catalog misses", () => {
    assert.equal(isDenaliReviewOpaqueCatalogId(destId), true);
    assert.equal(resolveDenaliReviewCatalogName(destId, new Map()), "");
    assert.equal(
      resolveDenaliReviewCatalogName(destId, new Map([[destId, "دماوند (تهران)"]])),
      "دماوند (تهران)"
    );
  });

  it("DEN-REV-CATALOG-01b non-UUID slugs may pass through on catalog miss", () => {
    assert.equal(isDenaliReviewOpaqueCatalogId("smoke-mountain"), false);
    assert.equal(resolveDenaliReviewCatalogName("smoke-mountain", new Map()), "smoke-mountain");
  });

  it("DEN-REV-HIKE-01 multi-day review omits hidden go/return hours (ED-HIKE-MULTI-01)", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Damavand",
          category: "mountain_multi",
          program: {
            hikingHoursApprox: "8",
            hikingGoHours: "4",
            hikingReturnHours: "3",
          },
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const program = sections.find((section) => section.stepId === "denali_program");
    const paths = new Set(program?.rows.map((row) => row.canonicalPath) ?? []);
    assert.equal(paths.has("program.hikingHoursApprox"), true);
    assert.equal(paths.has("program.hikingGoHours"), false);
    assert.equal(paths.has("program.hikingReturnHours"), false);
  });
});
