/**
 * Denali wizard RHF form model — types, defaults, normalize re-exports.
 */

export type { DenaliCreateTourWizardForm } from "./denaliTourCreateBaseSchema.generated";

export {
  denaliBasicInfoSchema,
  denaliPhotosSchema,
  denaliProgramNatureSchema,
  denaliTripDetailsMetricsSchema,
  denaliTripDetailsOverviewCoreSchema,
  applyDenaliCoreSchemaRefinements,
} from "./denaliCore.schema.generated";

/** Stable UUIDs for unit tests only — not valid workspace catalog rows. */
export const DENALI_WIZARD_TEST_DESTINATION_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
export const DENALI_WIZARD_TEST_THEME_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

export function buildDenaliTourCreateDefaultValues(): import("./denaliTourCreateBaseSchema.generated").DenaliCreateTourWizardForm {
  return {
    basicInfo: {
      title: "",
      tourType: undefined as unknown as import("@repo/types").DenaliTourKind,
      destinationId: undefined,
      startDateTime: "",
      endDateTime: undefined,
      capacityMin: undefined,
      capacityMax: undefined,
      meetingPoint: undefined,
      startPointLocationText: undefined,
      approximateReturnTime: undefined,
      leaderUserIds: [],
      requiresLocalGuide: false,
      localGuideName: undefined,
      requiresManualAdminApproval: false,
      socialMediaLink: undefined,
      publishStatus: "draft",
    },
    programNature: {
      themeIds: [],
      shortDescription: undefined,
      longDescription: undefined,
      difficultyLevel: 5,
      hikingHoursApprox: undefined,
      hikingGoHours: undefined,
      hikingReturnHours: undefined,
      itinerary: [],
    },
    transport: {
      transportMode: "none",
      dongAmount: undefined,
      transportNotes: undefined,
    },
    pricingPayment: {
      requiresPayment: false,
      basePricePerPerson: undefined,
      paymentMode: undefined,
      includesTourInsurance: false,
    },
    participantRequirements: {
      minimumAge: undefined,
      maximumAge: undefined,
      fitnessLevel: undefined,
      nationalIdRequired: false,
      sportsInsuranceRequired: false,
      minRequiredPeaks: undefined,
      fitnessPrerequisiteText: undefined,
      gearItems: [],
    },
    policies: {
      policiesText: undefined,
      cancellationDeadlineHours: undefined,
      cancellationPenaltyPercentage: undefined,
    },
    photosData: {
      photos: [],
    },
    tripDetails: {
      logistics: {
        gatheringPoints: [],
      },
      overview: {
        customServiceLabels: [],
      },
      metrics: {},
    },
  };
}

export function buildDenaliTourCreateTestValues(): import("./denaliTourCreateBaseSchema.generated").DenaliCreateTourWizardForm {
  const base = buildDenaliTourCreateDefaultValues();
  return {
    ...base,
    basicInfo: {
      ...base.basicInfo,
      title: "صعود به قله دماوند - جبهه جنوبی",
      tourType: "mountain_day",
      destinationId: DENALI_WIZARD_TEST_DESTINATION_ID,
      startDateTime: "2026-06-01T08:00:00.000Z",
      capacityMax: 15,
      publishStatus: "draft",
    },
    programNature: {
      ...base.programNature,
      themeIds: [DENALI_WIZARD_TEST_THEME_ID],
      shortDescription: "یک برنامه جذاب برای صعود به بام ایران.",
      difficultyLevel: 5,
      hikingHoursApprox: 8,
    },
    tripDetails: {
      ...base.tripDetails,
      overview: {
        ...base.tripDetails.overview,
        peakHeight: 5610,
      },
    },
    pricingPayment: {
      ...base.pricingPayment,
      requiresPayment: true,
      paymentMode: "offline_receipt",
      basePricePerPerson: 500_000,
    },
    participantRequirements: {
      ...base.participantRequirements,
      minimumAge: 18,
      fitnessLevel: "medium",
      sportsInsuranceRequired: true,
    },
  };
}
