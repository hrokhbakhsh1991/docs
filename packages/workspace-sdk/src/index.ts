export const WORKSPACE_SDK_VERSION = 1 as const;
export type WorkspaceSdkVersion = typeof WORKSPACE_SDK_VERSION;

export {
  buildTourAuthHeaders,
  type CreateTourPayload,
  type UpdateTourPayload,
  type TourAuthHeaders,
  type TourClient,
  type TourClientError,
  type TourRecordDto,
} from "./tours/tour-client.contract";

export * from "./public-api";
