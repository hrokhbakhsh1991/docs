/**
 * Phase 4 migration step 1: canonical model introduced, not wired yet.
 *
 * MVP product model for the Denali create wizard — only fields the user sees on the
 * 5-step rail. Not the legacy RHF form shape; not API persistence (`denaliTourKind`, etc.).
 *
 * @see packages/types/src/denali-canonical-tour-model.ts — prior nested model (superseded in Phase 4)
 */

import type { DenaliLocationData } from "./locationData";

export type { DenaliLocationData, DenaliLocationZoneKey } from "./locationData";
export { DENALI_LOCATION_ZONE_KEYS } from "./locationData";

export type DenaliCanonicalCategory = "mountain" | "nature" | "desert" | "event";

export const DENALI_CANONICAL_CATEGORY_VALUES = [
  "mountain",
  "nature",
  "desert",
  "event",
] as const;

/** Product duration control (not `single_day` / `multi_day` form tokens). */
export type DenaliCanonicalDuration = "single" | "multi";

export const DENALI_CANONICAL_DURATION_VALUES = ["single", "multi"] as const;

export type DenaliCanonicalTransportMode =
  | "organizer_vehicle"
  | "bus"
  | "minibus"
  | "train"
  | "shared_cars"
  | "none";

export const DENALI_CANONICAL_TRANSPORT_MODE_VALUES = [
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
] as const;

/**
 * Canonical Denali tour — MVP wizard user inputs only.
 */
export interface DenaliCanonicalTourModel {
  category: DenaliCanonicalCategory;
  duration: DenaliCanonicalDuration;

  title: string;
  destinationId: string;
  startDateTime: string;
  endDateTime?: string;
  /** Omitted when unset on form; Zod submit requires integer ≥ 1. */
  capacityMax?: number;
  capacityMin?: number;
  meetingPoint?: string;
  /** Start location (village, square, trailhead, base camp, etc.). */
  startPointLocationText?: string;
  /** Where passengers assemble (maps to legacy `meetingPoint` when unset). */
  gatheringPoint?: DenaliLocationData;
  /** Trailhead where hiking begins. */
  startPoint?: DenaliLocationData;
  /** Geographical peak coordinate. */
  summitPoint?: DenaliLocationData;
  /** Optional overnight camp / shelter. */
  campPoint?: DenaliLocationData;
  /** Final pick-up zone (maps to legacy logistics `returnPoint` when unset). */
  endPoint?: DenaliLocationData;
  /** Approximate return clock time (24h HH:mm), not full end datetime. */
  approximateReturnTime?: string;
  /** Workspace user ids assigned as tour leaders / crew (multi-select). */
  leaderUserIds?: string[];
  /** When true, a local (non-workspace) guide is required on this tour. */
  requiresLocalGuide?: boolean;
  /** Display name for the local guide when `requiresLocalGuide` is set. */
  localGuideName?: string;
  /** When true, registrations need admin approval before confirmation (Telegram workflow). */
  requiresManualAdminApproval?: boolean;
  /** Coordination channel URL (primary wire: `chat_link` from Telegram, Bale, Eitaa, Instagram, etc.). */
  socialMediaLink?: string;

  program: {
    /** Workspace theme catalog ids — marketing tags only (not form invariants). */
    themeIds: string[];
    shortDescription: string;
    longDescription?: string;
    /** Outdoor programs only (1-10 scale). */
    difficultyLevel?: number;
    /** Outdoor programs only. */
    hikingHoursApprox?: number;
    /** Outbound hiking hours (outdoor categories). */
    hikingGoHours?: number;
    /** Return hiking hours (outdoor categories). */
    hikingReturnHours?: number;
    /** Mountain category only. */
    altitudeMeasurement?: number;
    /** Dynamic daily activities for multi-day tours. */
    itinerary?: Array<{
      day: number;
      activities: string;
      /** Optional stop / area label for multi-stop routing within the tour window. */
      locationText?: string;
      /** Optional structured geolocation pin for the day's stop. */
      location?: DenaliLocationData;
      photos?: Array<{
        id: string;
        url: string;
        filename?: string;
        size?: number;
        mimeType?: string;
        uploadedAt?: string;
      }>;
    }>;
  };

  transport: {
    mode: DenaliCanonicalTransportMode;
    /** Organizer transport fee per person (Toman) — not دنگ. */
    transportCost?: number;
    /** Bus/minibus/train — permission for participants to use a personal car. */
    allowPersonalCar?: boolean;
    /** Personal car fuel share (دنگ) — only when `shared_cars` or `allowPersonalCar`. */
    dongAmount?: number;
    transportNotes?: string;
  };

  pricing: {
    requiresPayment?: boolean;
    basePricePerPerson?: number;
    paymentMode: "offline_receipt";
    /** Organizer includes group liability insurance in the tour package. */
    includesTourInsurance?: boolean;
  };

  participants: {
    minimumAge?: number;
    maximumAge?: number;
    /** Outdoor programs only. */
    fitnessLevel?: "low" | "medium" | "high";
    /** Checkout must collect national ID on the participant profile. */
    nationalIdRequired?: boolean;
    sportsInsuranceRequired?: boolean;
    /** Free-text fitness / experience prerequisites. */
    fitnessPrerequisiteText?: string;
    /** Gear items selected from workspace settings. */
    gearItems?: Array<{
      id: string;
      isRequired: boolean;
    }>;
  };

  policies: {
    policiesText?: string;
    /** Hours before departure when cancellation penalty applies. */
    cancellationDeadlineHours?: number;
    /** Penalty percentage (0–100) when cancelling inside the deadline window. */
    cancellationPenaltyPercentage?: number;
  };

  photos?: Array<{
    id: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }>;
}
