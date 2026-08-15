/**
 * Denali wizard form model — types, defaults, test builders (Phase 6.2).
 */

import type { DenaliTourKind } from "../types/legacy/repo-types";

export type { DenaliCreateTourWizardForm } from "./denaliCreateTourForm.types";

import type { DenaliCreateTourWizardForm } from "./denaliCreateTourForm.types";

/** Stable UUIDs for unit tests only — not valid workspace catalog rows. */
export const DENALI_WIZARD_TEST_DESTINATION_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
export const DENALI_WIZARD_TEST_THEME_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

export function buildDenaliTourCreateDefaultValues(): DenaliCreateTourWizardForm {
  return {
    basicInfo: {
      title: "",
      tourType: undefined as unknown as DenaliTourKind,
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
      guideLanguageIds: [],
      shortDescription: undefined,
      longDescription: undefined,
      difficultyLevel: undefined,
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
      prepaymentEnabled: false,
      prepaymentPercent: undefined,
      basePricePerPerson: undefined,
      paymentMode: undefined,
      includesTourInsurance: false,
    },
    participantRequirements: {
      minimumAge: undefined,
      maximumAge: undefined,
      fitnessLevel: undefined,
      nationalIdRequired: false,
      fatherNameRequired: false,
      birthDateRequired: false,
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
        includedServices: [],
        excludedServices: [],
      },
      overview: {
        customServiceLabels: [],
      },
      metrics: {},
    },
  };
}

export function buildDenaliTourCreateTestValues(): DenaliCreateTourWizardForm {
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
      prepaymentEnabled: true,
      prepaymentPercent: 30,
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
