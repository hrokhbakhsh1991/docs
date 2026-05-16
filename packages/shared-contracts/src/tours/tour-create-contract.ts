import { z } from "zod";
import { CREATE_TOUR_DTO_WIRE_KEYS, type CreateTourDtoWireKey } from "./create-tour-wire-keys";

/** Single source for tour CREATE wire shape (API DTO, BFF, FE forms). */
export type TourCreateContract = Partial<Record<CreateTourDtoWireKey, unknown>>;

const createFieldShape = Object.fromEntries(
  CREATE_TOUR_DTO_WIRE_KEYS.map((key) => [key, z.unknown().optional()]),
) as Record<CreateTourDtoWireKey, z.ZodOptional<z.ZodUnknown>>;

export const tourCreateContractSchema = z.object(createFieldShape).strict();

export const TOUR_CREATE_CONTRACT_FIELDS = CREATE_TOUR_DTO_WIRE_KEYS;
