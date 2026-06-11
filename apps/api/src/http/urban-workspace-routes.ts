import { URBAN_HTTP_ROUTE_MANIFEST } from "@app-tour/workspace-urban/http";

import {
  findManifestRoute,
  manifestPathToParamRegex,
  staticRoutesFromManifest,
} from "./workspace-route-manifest-bridge";
import type { WorkspaceHttpRouteDescriptor } from "./workspace-http-types";

const URBAN_STATIC_HANDLER_KEYS = {
  "GET /urban/settings": "handleGetUrbanSettings",
  "PATCH /urban/settings": "handlePatchUrbanSettings",
  "GET /urban/catalog": "handleGetUrbanCatalog",
  "POST /urban/registrations": "handlePostUrbanRegistration",
} as const satisfies Record<string, WorkspaceHttpRouteDescriptor["handlerKey"]>;

/** Urban workspace HTTP routes — derived from `URBAN_HTTP_ROUTE_MANIFEST` (Phase 10.3). */
export const URBAN_WORKSPACE_HTTP_ROUTES: readonly WorkspaceHttpRouteDescriptor[] =
  staticRoutesFromManifest(URBAN_HTTP_ROUTE_MANIFEST, URBAN_STATIC_HANDLER_KEYS);

const catalogTourRoute = findManifestRoute(
  URBAN_HTTP_ROUTE_MANIFEST,
  "GET",
  "/urban/catalog/:tourId"
);
if (catalogTourRoute === undefined) {
  throw new Error("URBAN_HTTP_ROUTE_MANIFEST missing GET /urban/catalog/:tourId");
}

/** Parameterized urban catalog detail — pattern derived from manifest. */
export const URBAN_CATALOG_TOUR_PATH_PATTERN = manifestPathToParamRegex(catalogTourRoute.path);
