import type {
  WorkspaceExposureResolverInput,
  WorkspaceExposureResolverPort,
} from "@app-tour/workspace-sdk";

import type { DenaliExposureCoordinate } from "../../exposure/denali-exposure-surfaces";

export type DenaliExposureResolverInput =
  WorkspaceExposureResolverInput<DenaliExposureCoordinate>;

/** Host-injected exposure resolver — implemented in apps/api. */
export type DenaliExposureResolverPort =
  WorkspaceExposureResolverPort<DenaliExposureCoordinate>;
