/**
 * Diagnostic: submit gate issues + clone gear UUID parity.
 * Run: cd apps/web && node --import tsx scripts/denali-wizard-debug-check.ts
 */
import { transformTourToDenaliWizardValues } from "../src/features/tours/clone/transformTourToDenaliWizardValues";
import { getDenaliWizardSubmitIssues } from "../src/features/tours/wizard/denali/validation/denaliWizardFormZod";
import { buildDenaliTourCreateTestValues } from "../src/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { DenaliCreateTourWizardForm } from "../src/features/tours/wizard/schemas/denaliTourCreateSchema";

function logIssues(label: string, form: DenaliCreateTourWizardForm): void {
  const issues = getDenaliWizardSubmitIssues(form);
  console.log(`\n=== ${label} (${issues.length} issue(s)) ===`);
  if (issues.length === 0) {
    console.log("(none)");
    return;
  }
  for (const issue of issues) {
    console.log(`  ${issue.path.join(".")}: ${issue.message}`);
  }
}

function logGearParity(
  label: string,
  gearItems: DenaliCreateTourWizardForm["participantRequirements"]["gearItems"],
  activeEquipmentIds: string[],
): void {
  const activeSet = new Set(activeEquipmentIds.map((id) => id.trim()));
  console.log(`\n=== ${label} — gearItems vs activeEquipment ===`);
  console.log("gearItems:", gearItems);
  console.log(
    "matches:",
    (gearItems ?? []).map((g) => ({
      id: g.id,
      inActiveCatalog: activeSet.has(g.id.trim()),
    })),
  );
}

const GEAR_REQ = "11111111-1111-4111-8111-111111111111";
const GEAR_OPT = "22222222-2222-4222-8222-222222222222";
const MOCK_ACTIVE_EQUIPMENT = [GEAR_REQ, GEAR_OPT];

const apiTour = {
  title: "abcdefghijklmnop",
  description: "long desc",
  tourType: "mountain",
  destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  costContext: { totalCost: 500_000, requiresPayment: true },
  transportModes: ["bus"],
  details: {
    tripDetails: {
      overview: {
        denaliTourKind: "mountain_day",
        shortIntro: "short",
        tourThemeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
        difficultyLevel: 5,
      },
      logistics: {
        departureDate: "2026-08-10",
        departureMeetingTime: "08:30",
        primaryTransportMode: "bus",
        groupSizeMax: 15,
      },
      participation: {
        minimumAge: 18,
        fitnessLevel: "moderate",
        sportsInsuranceRequired: true,
        gearRequiredIds: [GEAR_REQ],
        gearOptionalIds: [GEAR_OPT],
      },
      itinerary: { programNotes: "مدت تقریبی پیاده‌روی: 4 ساعت" },
    },
  },
};

const cloned = transformTourToDenaliWizardValues(apiTour as never);
logIssues("clone transform (mountain_day + gear, missing startDateTime ISO)", cloned as DenaliCreateTourWizardForm);
logGearParity(
  "clone vs matching catalog IDs",
  cloned.participantRequirements?.gearItems,
  MOCK_ACTIVE_EQUIPMENT,
);
logGearParity(
  "clone vs stale UUIDs (unit-test ids from spec)",
  cloned.participantRequirements?.gearItems,
  ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
);

logIssues("buildDenaliTourCreateTestValues (missing tourType + startDateTime)", buildDenaliTourCreateTestValues());

console.log("\nNote: transformTourToDenaliWizardValues copies gearRequiredIds/gearOptionalIds verbatim as gearItems[].id");
