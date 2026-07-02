import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { UrbanExposureCoordinate } from "../../exposure/urban-exposure-surfaces";

export type UrbanExposureResolverInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly canonical: CanonicalDocument;
  readonly coordinate: UrbanExposureCoordinate;
};

/** Host-injected exposure resolver — implemented in apps/api. */
export interface UrbanExposureResolverPort {
  resolveVisibleFieldIds(input: UrbanExposureResolverInput): Promise<readonly string[]>;
}
