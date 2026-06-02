import type { TourCapability } from "@repo/shared";

export type TourPatchFieldGroup = "core" | "tripDetails";

export type TourPatchViewerRole = "guest" | "member" | "leader" | "admin";

export const TOUR_PATCH_CONTRACT_DTO_KEYS = [
  "title",
  "description",
  "total_capacity",
  "lifecycle_status",
  "chat_link",
  "cost_context",
  "autoAcceptRegistrations",
  "tourType",
  "formProfile",
  "transportModes",
  "destinationId",
  "destinationName",
  "elevationM",
  "difficulty",
  "durationDays",
  "meetingPoint",
  "metadata",
  "itinerary",
  "tripDetails",
] as const;

export type TourPatchContractDtoKey = (typeof TOUR_PATCH_CONTRACT_DTO_KEYS)[number];

export type TourPatchContractRule = {
  readonly dtoKey: TourPatchContractDtoKey;
  readonly group: TourPatchFieldGroup;
  readonly requiredCapability: TourCapability;
  readonly minRoleForEdit?: TourPatchViewerRole;
};

/** PATCH policy matrix — API `tour-patch-field-policy` and FE field gates derive from this. */
export const TOUR_PATCH_CONTRACT_RULES: readonly TourPatchContractRule[] = [
  { dtoKey: "title", group: "core", requiredCapability: "tour.update.core" },
  { dtoKey: "description", group: "core", requiredCapability: "tour.update.core" },
  {
    dtoKey: "total_capacity",
    group: "core",
    requiredCapability: "tour.update.core",
    minRoleForEdit: "leader",
  },
  { dtoKey: "lifecycle_status", group: "core", requiredCapability: "tour.update.core" },
  { dtoKey: "chat_link", group: "core", requiredCapability: "tour.update.core" },
  { dtoKey: "cost_context", group: "core", requiredCapability: "tour.update.core" },
  { dtoKey: "autoAcceptRegistrations", group: "core", requiredCapability: "tour.update.core" },
  { dtoKey: "tourType", group: "core", requiredCapability: "tour.update.core" },
  { dtoKey: "formProfile", group: "core", requiredCapability: "tour.update.core" },
  { dtoKey: "transportModes", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
  { dtoKey: "destinationId", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
  { dtoKey: "destinationName", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
  { dtoKey: "elevationM", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
  { dtoKey: "difficulty", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
  { dtoKey: "durationDays", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
  { dtoKey: "meetingPoint", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
  { dtoKey: "metadata", group: "core", requiredCapability: "tour.update.core" },
  { dtoKey: "itinerary", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
  { dtoKey: "tripDetails", group: "tripDetails", requiredCapability: "tour.update.tripDetails" },
] as const;
