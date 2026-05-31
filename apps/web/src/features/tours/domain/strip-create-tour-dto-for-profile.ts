import {
  stripCreateTourDtoForFormProfile as stripCreateTourDtoForFormProfileShared,
  type CreateTourDtoWireLike,
} from "@repo/shared-contracts";
import { type TourFormProfile } from "@repo/types";

import type { CreateTourDto } from "@/lib/services/tours.service";

/**
 * Client create-tour profile strip — delegates to the shared contract in `@repo/shared-contracts`.
 */
export function stripCreateTourDtoForFormProfile(
  profile: TourFormProfile,
  dto: CreateTourDto,
): CreateTourDto {
  return stripCreateTourDtoForFormProfileShared(
    profile,
    dto as CreateTourDto & CreateTourDtoWireLike,
  ) as CreateTourDto;
}
