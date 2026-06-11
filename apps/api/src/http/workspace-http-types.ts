/** HTTP methods the workspace route registrar may dispatch (Phase 10.3). */
export type WorkspaceHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Declarative workspace HTTP route — handlers stay in API adapters until Phase 10.3 S3.
 */
export type WorkspaceHttpRouteDescriptor = {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
  readonly handlerKey: WorkspaceUrbanHandlerKey;
};

export type WorkspaceUrbanHandlerKey =
  | "handleGetUrbanSettings"
  | "handlePatchUrbanSettings"
  | "handleGetUrbanCatalog"
  | "handleGetUrbanCatalogTour"
  | "handlePostUrbanRegistration";
