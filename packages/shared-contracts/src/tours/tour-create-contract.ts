import { z } from "zod";
import { CREATE_TOUR_POST_WIRE_KEYS, type CreateTourPostWireKey } from "./create-tour-wire-keys";

/** Client POST `/api/v2/tours` wire shape (excludes ignored server hints such as `formProfile`). */
export type TourCreatePostContract = Partial<Record<CreateTourPostWireKey, unknown>>;

const postFieldShape = Object.fromEntries(
  CREATE_TOUR_POST_WIRE_KEYS.map((key) => [key, z.unknown().optional()]),
) as Record<CreateTourPostWireKey, z.ZodOptional<z.ZodUnknown>>;

export const tourCreatePostContractSchema = z.object(postFieldShape).strict();

/** @deprecated Use {@link tourCreatePostContractSchema} — alias kept for existing imports. */
export const tourCreateContractSchema = tourCreatePostContractSchema;

export const TOUR_CREATE_POST_CONTRACT_FIELDS = CREATE_TOUR_POST_WIRE_KEYS;

/** @deprecated Use {@link TOUR_CREATE_POST_CONTRACT_FIELDS}. */
export const TOUR_CREATE_CONTRACT_FIELDS = CREATE_TOUR_POST_WIRE_KEYS;

export type TourCreateContract = TourCreatePostContract;
