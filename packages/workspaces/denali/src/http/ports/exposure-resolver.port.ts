import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { DenaliExposureCoordinate } from "../../exposure/denali-exposure-surfaces";

export type DenaliExposureResolverInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly canonical: CanonicalDocument;
  readonly coordinate: DenaliExposureCoordinate;
};

/** Host-injected exposure resolver — implemented in apps/api. */
export interface DenaliExposureResolverPort {
  resolveVisibleFieldIds(input: DenaliExposureResolverInput): Promise<readonly string[]>;
}
