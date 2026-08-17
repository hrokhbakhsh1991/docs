import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  fitnessLevelLabel: (level) => level,
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
  optionalEmptyValue: "Not selected (optional)",
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

  it("DEN-REV-VIS-01 mountain review includes max age and fitness (ED-REV-VIS-01)", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Damavand",
          category: "mountain_day",
          participants: {
            minimumAge: "18",
            maximumAge: "55",
            fitnessLevel: "medium",
          },
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const pricing = sections.find((section) => section.stepId === "denali_pricing");
    const paths = new Set(pricing?.rows.map((row) => row.canonicalPath) ?? []);
    assert.equal(paths.has("participants.minimumAge"), true);
    assert.equal(paths.has("participants.maximumAge"), true);
    assert.equal(paths.has("participants.fitnessLevel"), true);
    const fitness = pricing?.rows.find((row) => row.canonicalPath === "participants.fitnessLevel");
    assert.equal(fitness?.value, "medium");
  });

  it("ED-GATHER-PERSIST-01 nested-only gathering appears on logistics review", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "صعود یک‌روزه توچال از دربند",
          category: "mountain_day",
          tripDetails: {
            logistics: {
              gatheringPoints: [
                { name: "میدان دربند", address: "دربند، تهران", isPrimary: true },
              ],
            },
          },
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const logistics = sections.find((section) => section.stepId === "denali_logistics");
    const gathering = logistics?.rows.filter((row) => row.canonicalPath === "gatheringPoints") ?? [];
    assert.equal(gathering.length > 0, true);
    assert.match(gathering[0]?.value ?? "", /میدان دربند/);
    assert.match(gathering[0]?.value ?? "", /دربند، تهران/);
  });

  it("ED-CAMP-PERSIST-01 nested-only campPoint appears on logistics review", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "کمپینگ چندروزه آبشار اسکلیم",
          category: "nature_multi",
          tripDetails: {
            overview: {
              campPoint: {
                label: "کمپ آبشار اسکلیم",
                address: "آبشار آهکی اسکلیم, لفور",
              },
            },
          },
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const logistics = sections.find((section) => section.stepId === "denali_logistics");
    const camp = logistics?.rows.find((row) => row.canonicalPath === "campPoint");
    assert.match(camp?.value ?? "", /کمپ آبشار اسکلیم/);
    assert.match(camp?.value ?? "", /آبشار آهکی اسکلیم/);
  });

  it("ED-REV-CURR-01 review formats base price and transport cost as grouped toman", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "کمپینگ چندروزه آبشار اسکلیم",
          category: "nature_multi",
          pricing: { basePricePerPerson: "3200000", requiresPayment: "true" },
          transport: { mode: "bus", transportCost: "450000", dongAmount: "80000" },
        },
      },
      EMPTY_CATALOG,
      { ...LABELS, locale: "en" }
    );
    const pricing = sections.find((section) => section.stepId === "denali_pricing");
    const logistics = sections.find((section) => section.stepId === "denali_logistics");
    const price = pricing?.rows.find((row) => row.canonicalPath === "pricing.basePricePerPerson");
    const transport = logistics?.rows.find((row) => row.canonicalPath === "transport.transportCost");
    const dong = logistics?.rows.find((row) => row.canonicalPath === "transport.dongAmount");
    assert.equal(price?.value, "3,200,000 toman");
    assert.equal(transport?.value, "450,000 toman");
    assert.equal(dong?.value, "80,000 toman");
    const logic = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/ui/logic/denali-review-format-logic.ts"),
      "utf8"
    );
    assert.match(logic, /formatDenaliTomanAmount/);
    assert.equal(/from ["']@apps\/web/.test(logic), false);
    assert.equal(/formatTourPrice/.test(logic), false);
  });

  it("DEN-REV-VIS-01b nature review omits mountain-only age and fitness", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Nature walk",
          category: "nature_day",
          participants: {
            minimumAge: "18",
            maximumAge: "55",
            fitnessLevel: "medium",
          },
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const pricing = sections.find((section) => section.stepId === "denali_pricing");
    const paths = new Set(pricing?.rows.map((row) => row.canonicalPath) ?? []);
    assert.equal(paths.has("participants.maximumAge"), false);
    assert.equal(paths.has("participants.fitnessLevel"), false);
  });
});
