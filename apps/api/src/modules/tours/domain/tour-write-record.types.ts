import type { TourFormProfile, TourType } from "@repo/types";
import type { TourLifecycleStatus } from "@repo/domain-contracts";

import type { TourTransportMode } from "../tour-transport-modes";
import type { TourDetailsPolicySnapshot } from "./tour-policy.types";

export type TourDestinationRegionRef = {
  id?: string;
  name?: string;
  regionId?: string;
  region?: { id?: string; name?: string } | null;
};

/**
 * Writable tour aggregate root for port contracts (implemented by infra {@link TourEntity}).
 */
export type TourWriteRecord = {
  id: string;
  tenantId: string;
  title: string;
  description?: string | null;
  totalCapacity: number;
  acceptedCount: number;
  lifecycleStatus: TourLifecycleStatus;
  chatLink?: string | null;
  costContext?: Record<string, unknown> | null;
  autoAcceptRegistrations?: boolean | null;
  tourType?: TourType | null;
  transportModes: TourTransportMode[];
  destination?: TourDestinationRegionRef | null;
  details?: TourDetailsPolicySnapshot | null;
  tourProductId?: string | null;
  tourDepartureId?: string | null;
  createdByUserId?: string | null;
  formProfileSnapshot?: TourFormProfile | null;
  startsOn?: string | null;
  endsOn?: string | null;
  currencyCode?: string | null;
  listPriceMinor?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};
