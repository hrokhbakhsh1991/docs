import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliReviewHero,
  buildDenaliReviewSections,
  type DenaliReviewCatalog,
  type DenaliReviewFormatLabels,
} from "../src/wizard/denali/denali-review-format-logic";

const EMPTY_CATALOG: DenaliReviewCatalog = {
  destinationNameById: new Map([["dest-1", "Damavand"]]),
  leaderNameById: new Map([["u1", "Ali Reza"]]),
  themeNameById: new Map([["theme-1", "Alpine"]]),
  languageNameById: new Map([["fa", "Persian"]]),
};

const LABELS: DenaliReviewFormatLabels = {
  fieldLabel: (path) => path,
  stepLabel: (stepId) => stepId,
  tourKindLabel: (slug) => slug,
  transportModeLabel: (mode) => mode,
  publishStatusLabel: (status) => status,
  locationZoneLabel: (path) => path,
  yes: "yes",
  no: "no",
  gearRequired: "required",
  gearOptional: "optional",
  photoCount: (count) => `${count} photos`,
  dayLabel: (day) => `day ${day}`,
  primaryGathering: "primary",
};

describe("denali-review-format-logic.spec.ts", () => {
  it("WEB-DENALI-REVIEW-01 builds hero from draft basics", () => {
    const hero = buildDenaliReviewHero(
      {
        data: {
          title: "Spring climb",
          category: "mountain_day",
          destinationId: "dest-1",
          startDateTime: "2026-07-01T08:00",
          endDateTime: "2026-07-01T20:00",
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    assert.equal(hero.title, "Spring climb");
    assert.equal(hero.destination, "Damavand");
    assert.match(hero.schedule, /2026-07-01T08:00/);
  });

  it("WEB-DENALI-REVIEW-02 groups filled fields into wizard sections", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Spring climb",
          category: "mountain_day",
          destinationId: "dest-1",
          leaderUserIds: ["u1"],
          program: {
            themeIds: ["theme-1"],
            shortDescription: "A scenic day hike",
          },
          transport: {
            mode: "bus",
          },
          participants: {
            gearItems: [{ equipmentId: "g1", name: "Sleeping bag", isRequired: true }],
            minimumAge: "18",
          },
          tripDetails: {
            logistics: {
              includedServices: ["Breakfast"],
              excludedServices: ["Lunch"],
            },
          },
          pricing: {
            requiresPayment: "true",
          },
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const stepIds = sections.map((section) => section.stepId);
    assert.deepEqual(stepIds, [
      "denali_basic",
      "denali_photos",
      "denali_logistics",
      "denali_pricing",
    ]);
    const logistics = sections.find((section) => section.stepId === "denali_logistics");
    assert.ok(logistics?.chips?.includes("Breakfast"));
    assert.equal(logistics?.cards?.some((card) => card.variant === "self"), true);
  });

  it("WEB-DENALI-REVIEW-03 renders itinerary day segments in program section", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Multi-day trek",
          category: "mountain_multi",
          program: {
            itinerary: [
              {
                dayNumber: 1,
                title: "Arrival day",
                summary: "Set up camp",
                segments: [
                  {
                    id: "s1",
                    kind: "activity",
                    title: "Briefing",
                    startTime: "09:00",
                    locationLabel: "Base camp",
                  },
                ],
              },
            ],
          },
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const program = sections.find((section) => section.stepId === "denali_program");
    assert.equal(program?.cards?.length, 1);
    assert.equal(program?.cards?.[0]?.title, "Arrival day");
    assert.match(program?.cards?.[0]?.body ?? "", /09:00 — Briefing/);
    assert.match(program?.cards?.[0]?.body ?? "", /Base camp/);
  });

  it("WEB-DENALI-REVIEW-04 renders segment photo labels in program section", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Multi-day trek",
          category: "mountain_multi",
          photos: [
            { id: "p1", label: "Summit view" },
            { id: "p2", label: "Camp setup" },
          ],
          program: {
            itinerary: [
              {
                dayNumber: 1,
                title: "Arrival day",
                segments: [
                  {
                    id: "s1",
                    kind: "activity",
                    title: "Briefing",
                    photoIds: ["p1", "p2"],
                  },
                ],
              },
            ],
          },
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const program = sections.find((section) => section.stepId === "denali_program");
    assert.match(program?.cards?.[0]?.body ?? "", /Photos: Summit view, Camp setup/);
  });

  it("WEB-DENALI-REVIEW-05 renders segment catalog destination in program section", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Multi-day event",
          category: "event_reading_multi",
          program: {
            itinerary: [
              {
                dayNumber: 1,
                title: "Day one",
                segments: [
                  {
                    id: "s1",
                    kind: "activity",
                    title: "Panel",
                    destinationId: "dest-1",
                  },
                ],
              },
            ],
          },
        },
      },
      {
        ...EMPTY_CATALOG,
        destinationNameById: new Map([["dest-1", "Tehran Book City"]]),
      },
      LABELS
    );
    const program = sections.find((section) => section.stepId === "denali_program");
    assert.match(program?.cards?.[0]?.body ?? "", /Tehran Book City/);
  });
});
