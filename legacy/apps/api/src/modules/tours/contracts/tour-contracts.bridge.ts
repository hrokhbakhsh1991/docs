/**
 * API bridge — re-exports shared tour contracts (Phase 14.1 single source).
 */
export {
  TOUR_CREATE_CONTRACT_FIELDS,
  tourCreateContractSchema,
  type TourCreateContract,
  TOUR_PATCH_CONTRACT_DTO_KEYS,
  TOUR_PATCH_CONTRACT_RULES,
  type TourPatchContractDtoKey,
  type TourPatchContractRule,
} from "@repo/shared-contracts";
