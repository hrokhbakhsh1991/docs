/**
 * Tour API client types (workspace tours). Implementations: {@link ./services/tours.service}.
 */
import type { TourDto } from "@repo/types";

import type { CreateTourDto, TourDetailDto, UpdateTourDto } from "./services/tours.service";

export type { TourDto };

/** Create payload (includes optional `destinationId`). */
export type CreateTourInput = CreateTourDto;

/** PATCH payload (includes optional `destinationId`). */
export type UpdateTourInput = UpdateTourDto;

/** Normalized tour row from list/detail API. */
export type TourFromApi = TourDetailDto;
