import type { DenaliTourKind } from "../types/legacy/repo-types";

/** Hand-maintained wizard form model (parity with legacy RHF shape; zod codegen excluded from 6.2 build). */
export interface DenaliCreateTourWizardForm {
  basicInfo: {
    title: string;
    tourType: DenaliTourKind | undefined;
    destinationId: string | undefined;
    startDateTime: string;
    endDateTime: string | undefined;
    capacityMin: number | undefined;
    capacityMax: number | undefined;
    meetingPoint: string | undefined;
    startPointLocationText: string | undefined;
    approximateReturnTime: string | undefined;
    leaderUserIds: string[];
    requiresLocalGuide: boolean;
    localGuideName: string | undefined;
    requiresManualAdminApproval: boolean;
    socialMediaLink: string | undefined;
    publishStatus: "draft" | "active" | undefined;
    allowPersonalCar?: boolean;
  };
  programNature: {
    themeIds: string[];
    guideLanguageIds: string[];
    shortDescription: string | undefined;
    longDescription: string | undefined;
    difficultyLevel: number | undefined;
    hikingHoursApprox: number | undefined;
    hikingGoHours: number | undefined;
    hikingReturnHours: number | undefined;
    itinerary: Array<Record<string, unknown>>;
  };
  transport: {
    transportMode: string;
    transportCost?: number;
    dongAmount?: number;
    allowPersonalCar?: boolean;
    transportNotes?: string;
    seatPreference?: string;
    adminCapacityApproval?: boolean;
  };
  pricingPayment: {
    requiresPayment: boolean;
    prepaymentEnabled: boolean;
    prepaymentPercent: number | undefined;
    basePricePerPerson: number | undefined;
    paymentMode: string | undefined;
    includesTourInsurance: boolean;
  };
  participantRequirements: {
    minimumAge: number | undefined;
    maximumAge: number | undefined;
    fitnessLevel: string | undefined;
    nationalIdRequired: boolean;
    fatherNameRequired: boolean;
    birthDateRequired: boolean;
    sportsInsuranceRequired: boolean;
    minRequiredPeaks: number | undefined;
    fitnessPrerequisiteText: string | undefined;
    gearItems: Array<Record<string, unknown>>;
  };
  policies: {
    policiesText: string | undefined;
    cancellationDeadlineHours: number | undefined;
    cancellationPenaltyPercentage: number | undefined;
  };
  photosData: {
    photos: Array<Record<string, unknown>>;
  };
  tripDetails: {
    logistics: {
      gatheringPoints: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };
    overview: {
      customServiceLabels: string[];
      peakHeight?: number;
      trailDistanceKm?: number;
      [key: string]: unknown;
    };
    metrics: Record<string, unknown>;
  };
}
