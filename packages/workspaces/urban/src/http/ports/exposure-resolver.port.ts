import type {
  WorkspaceExposureResolverInput,
  WorkspaceExposureResolverPort,
} from "@app-tour/workspace-sdk";

import type { UrbanExposureCoordinate } from "../../exposure/urban-exposure-surfaces";

export type UrbanExposureResolverInput =
  WorkspaceExposureResolverInput<UrbanExposureCoordinate>;

/** Host-injected exposure resolver — implemented in apps/api. */
export type UrbanExposureResolverPort =
  WorkspaceExposureResolverPort<UrbanExposureCoordinate>;
