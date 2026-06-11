import type { WorkspaceHttpMethod } from "./workspace-http-types";

export type ManifestRoute = {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
};

export type ManifestStaticRoute<THandlerKey extends string> = ManifestRoute & {
  readonly handlerKey: THandlerKey;
};

/**
 * Build registrar static rows from package HTTP manifest + handler map.
 * Throws at module load if manifest and map drift.
 */
export function staticRoutesFromManifest<THandlerKey extends string>(
  manifest: readonly ManifestRoute[],
  handlerByRouteKey: Readonly<Record<string, THandlerKey>>
): readonly ManifestStaticRoute<THandlerKey>[] {
  const routes: ManifestStaticRoute<THandlerKey>[] = [];
  for (const route of manifest) {
    if (route.path.includes(":")) {
      continue;
    }
    const routeKey = `${route.method} ${route.path}`;
    const handlerKey = handlerByRouteKey[routeKey];
    if (handlerKey === undefined) {
      throw new Error(`workspace route manifest missing handler for ${routeKey}`);
    }
    routes.push({ method: route.method, path: route.path, handlerKey });
  }
  return routes;
}

/** Convert `/finance/receipts/:receiptId/review` → anchored param regex. */
export function manifestPathToParamRegex(manifestPath: string): RegExp {
  const pattern = manifestPath
    .split("/")
    .map((segment) => (segment.startsWith(":") ? "([^/]+)" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${pattern}$`);
}

export function findManifestRoute(
  manifest: readonly ManifestRoute[],
  method: WorkspaceHttpMethod,
  path: string
): ManifestRoute | undefined {
  return manifest.find((route) => route.method === method && route.path === path);
}
