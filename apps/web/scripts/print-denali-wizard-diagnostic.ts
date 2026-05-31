/**
 * Prints clone-hydration diagnostic JSON (same shape as browser logDenaliWizardDiagnosticReport).
 * Run: cd apps/web && node --import tsx scripts/print-denali-wizard-diagnostic.ts
 */
import { transformTourToDenaliWizardValues } from "@/features/tours";
import { mergeDenaliFormDefaults } from "@/features/tours";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours";
import { buildDenaliWizardDiagnosticReport } from "@/features/tours";
import type { DenaliCreateTourWizardForm } from "@/features/tours";

const GEAR_REQ = "11111111-1111-4111-8111-111111111111";
const GEAR_OPT = "22222222-2222-4222-8222-222222222222";

/** Simulates workspace catalog — replace IDs with your tenant equipment UUIDs when comparing live UI. */
const MOCK_ACTIVE_EQUIPMENT = [
  {
    id: GEAR_REQ,
    name: "Mock boots",
    slug: "mock-boots",
    category: null,
    description: null,
    icon: null,
    compatibleCategories: [],
    isActive: true,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: GEAR_OPT,
    name: "Mock poles",
    slug: "mock-poles",
    category: null,
    description: null,
    icon: null,
    compatibleCategories: [],
    isActive: true,
    sortOrder: 1,
    createdAt: "",
    updatedAt: "",
  },
];

const cloneSource = {
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

const patch = transformTourToDenaliWizardValues(cloneSource as never);
const form = mergeDenaliFormDefaults(
  buildDenaliTourCreateDefaultValues(),
  patch,
) as DenaliCreateTourWizardForm;

const reportWithCatalog = buildDenaliWizardDiagnosticReport({
  form,
  activeEquipment: MOCK_ACTIVE_EQUIPMENT,
  source: "clone-hydration-simulation-with-matching-catalog",
});

const reportStaleCatalog = buildDenaliWizardDiagnosticReport({
  form,
  activeEquipment: [
    {
      ...MOCK_ACTIVE_EQUIPMENT[0]!,
      id: "00000000-0000-4000-8000-000000000099",
    },
  ],
  source: "clone-hydration-simulation-stale-catalog",
});

void {
  note: "Browser live state: open review step and run logDenaliWizardDiagnosticReport from console, or submit to trigger onInvalid JSON.",
  scenarios: {
    cloneWithMatchingWorkspaceGear: reportWithCatalog,
    cloneWithStaleWorkspaceGear: reportStaleCatalog,
  },
};

