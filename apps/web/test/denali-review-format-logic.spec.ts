import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliReviewHero,
  buildDenaliReviewSections,
  buildDenaliReviewSectionsFromVisibleSteps,
  type DenaliReviewCatalog,
  type DenaliReviewFormatLabels,
} from "@app-tour/workspace-denali/host/ui/logic/denali-review-format-logic";

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
  fitnessLevelLabel: (level) => level,
  publishStatusLabel: (status) => status,
  locationZoneLabel: (path) => path,
  // Identity stub — production wires isoToDatetimeLocalInput + formatDatetimeLocalLabel.
  formatDatetime: (iso) => `fmt:${iso}`,
  yes: "yes",
  no: "no",
  gearRequired: "required",
  gearOptional: "optional",
  photoCount: (count) => `${count} photos`,
  dayLabel: (day) => `day ${day}`,
  primaryGathering: "primary",
  socialMediaTelegramAutoLabel: "Telegram — auto",
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
    assert.equal(hero.schedule, "fmt:2026-07-01T08:00 → fmt:2026-07-01T20:00");
    assert.doesNotMatch(hero.schedule, /T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it("WEB-DENALI-REVIEW-01b formats Zulu ISO via labels.formatDatetime (INV-DENALI-REVIEW-01)", () => {
    const hero = buildDenaliReviewHero(
      {
        data: {
          title: "Nature multi",
          category: "nature_multi",
          destinationId: "dest-1",
          startDateTime: "2026-08-07T04:30:00.000Z",
          endDateTime: "2026-08-10T13:30:00.000Z",
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    assert.equal(
      hero.schedule,
      "fmt:2026-08-07T04:30:00.000Z → fmt:2026-08-10T13:30:00.000Z"
    );
    assert.doesNotMatch(hero.schedule, /^2026-08-07T04:30:00\.000Z/);
  });

  it("WEB-DENALI-REVIEW-02b shows telegram auto label when social link is empty", () => {
    const sections = buildDenaliReviewSections(
      {
        data: {
          title: "Spring climb",
          category: "mountain_day",
          destinationId: "dest-1",
        },
      },
      EMPTY_CATALOG,
      LABELS
    );
    const basic = sections.find((section) => section.stepId === "denali_basic");
    const socialRow = basic?.rows.find((row) => row.label === "socialMediaLink");
    assert.equal(socialRow?.value, "Telegram — auto");
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
    assert.equal(logistics?.gearItems?.[0]?.name, "Sleeping bag");
    assert.equal(logistics?.cards?.some((card) => card.variant === "self"), true);
  });

  it("WEB-DENALI-REVIEW-08 exposes cover photo and photo grid payloads", () => {
    const draft = {
      data: {
        title: "Photo tour",
        category: "mountain_day",
        destinationId: "dest-1",
        photos: [
          { id: "p1", label: "Trail head", url: "https://cdn.example.com/p1.jpg" },
          { id: "p2", label: "Summit", storageKey: "uploads/p2.jpg", day: 2 },
        ],
      },
    };
    const hero = buildDenaliReviewHero(draft, EMPTY_CATALOG, LABELS);
    assert.equal(hero.coverPhoto?.id, "p1");
    const sections = buildDenaliReviewSections(draft, EMPTY_CATALOG, LABELS);
    const photos = sections.find((section) => section.stepId === "denali_photos");
    assert.equal(photos?.photos?.length, 2);
    assert.equal(photos?.photos?.[0]?.label, "Trail head");
    assert.equal(photos?.cards, undefined);
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

  it("WEB-DENALI-REVIEW-06 filters sections to visible template steps only", () => {
    const contentSteps = [
      {
        stepId: "denali_basic",
        fields: [
          { canonicalPath: "title", fieldId: "title", kind: "text", required: true, hidden: false },
          {
            canonicalPath: "destinationId",
            fieldId: "destinationId",
            kind: "text",
            required: true,
            hidden: false,
          },
        ],
      },
    ];
    const sections = buildDenaliReviewSectionsFromVisibleSteps(
      {
        data: {
          title: "Spring climb",
          category: "mountain_day",
          destinationId: "dest-1",
          transport: { mode: "bus", transportCost: "50000" },
        },
      },
      contentSteps,
      EMPTY_CATALOG,
      LABELS
    );
    assert.deepEqual(
      sections.map((section) => section.stepId),
      ["denali_basic"]
    );
    const basic = sections[0];
    assert.ok(basic?.rows.some((row) => row.canonicalPath === "title"));
    assert.ok(!basic?.rows.some((row) => row.canonicalPath === "transport.mode"));
  });

  it("WEB-DENALI-REVIEW-07 uses transport.transportCost canonical path in logistics", () => {
    const contentSteps = [
      {
        stepId: "denali_logistics",
        fields: [
          {
            canonicalPath: "transport.mode",
            fieldId: "transport.mode",
            kind: "enum",
            required: false,
            hidden: false,
          },
        ],
      },
    ];
    const sections = buildDenaliReviewSectionsFromVisibleSteps(
      {
        data: {
          title: "Tour",
          category: "mountain_day",
          transport: { mode: "bus", transportCost: "120000" },
        },
      },
      contentSteps,
      EMPTY_CATALOG,
      LABELS
    );
    const logistics = sections.find((section) => section.stepId === "denali_logistics");
    assert.ok(logistics?.rows.some((row) => row.canonicalPath === "transport.transportCost"));
    assert.equal(
      logistics?.rows.find((row) => row.canonicalPath === "transport.transportCost")?.value,
      "120000"
    );
  });

  it("WEB-DENALI-REVIEW-09 does not echo UUID destination/leader when catalog is empty (ED-REV-UUID-01)", () => {
    const destId = "00000000-0000-4000-8000-000000000705";
    const leaderId = "00000000-0000-4000-8000-000000000101";
    const empty: DenaliReviewCatalog = {
      destinationNameById: new Map(),
      leaderNameById: new Map(),
      themeNameById: new Map(),
      languageNameById: new Map(),
    };
    const draft = {
      data: {
        title: "Damavand",
        category: "mountain_multi",
        destinationId: destId,
        leaderUserIds: [leaderId],
        startDateTime: "2026-08-17T06:00:00.000Z",
      },
    };
    const hero = buildDenaliReviewHero(draft, empty, LABELS);
    assert.equal(hero.destination, "");
    const sections = buildDenaliReviewSections(draft, empty, LABELS);
    const basic = sections.find((section) => section.stepId === "denali_basic");
    assert.equal(
      basic?.rows.some((row) => row.value.includes(destId) || row.value.includes(leaderId)),
      false
    );
  });
});
