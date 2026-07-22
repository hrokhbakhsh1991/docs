import { BANNER } from "../constants.mjs";
import { workspaceManifestConstPrefix } from "../utils.mjs";

/**
 * PF-3.1 / Phase 10.3 — every manifest with httpRoutes must codegen handler loaders from workspace package.
 * @param {Record<string, unknown>} manifest
 */
export function assertHttpRoutesManifest(manifest) {
  const httpRoutes = manifest.httpRoutes;
  if (httpRoutes === undefined) {
    return;
  }
  if (httpRoutes.loadHandlersFromPackage !== true) {
    throw new Error(
      `${manifest.id}: httpRoutes.loadHandlersFromPackage: true is required (handlers live in workspace package)`
    );
  }
  if (typeof httpRoutes.handlerPackage !== "string" || httpRoutes.handlerPackage.length === 0) {
    throw new Error(`${manifest.id}: httpRoutes.handlerPackage must be a non-empty string`);
  }
}

/** @param {readonly Record<string, unknown>[]} manifests */
export function generateWorkspaceHttpRoutes(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {Set<string>} */
  const handlerKeys = new Set();
  /** @type {string[]} */
  const staticManifestBlocks = [];
  /** @type {string[]} */
  const paramManifestBlocks = [];

  for (const m of manifests) {
    const httpRoutes = m.httpRoutes;
    if (httpRoutes === undefined) continue;
    const defaultHandlerPackage =
      typeof httpRoutes.handlerPackage === "string" && httpRoutes.handlerPackage.length > 0
        ? httpRoutes.handlerPackage
        : `${m.package}/http`;
    if (!Array.isArray(httpRoutes.groups) || httpRoutes.groups.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: httpRoutes.groups must be a non-empty array`);
    }

    for (let i = 0; i < httpRoutes.groups.length; i++) {
      const group = httpRoutes.groups[i];
      if (typeof group.manifestExport !== "string" || group.manifestExport.length === 0) {
        throw new Error(
          `workspace.manifest.json ${m.id}: httpRoutes.groups[${i}].manifestExport is required`
        );
      }
      if (group.staticHandlers === undefined || typeof group.staticHandlers !== "object") {
        throw new Error(
          `workspace.manifest.json ${m.id}: httpRoutes.groups[${i}].staticHandlers is required`
        );
      }
      const handlerPackage =
        typeof group.handlerPackage === "string" && group.handlerPackage.length > 0
          ? group.handlerPackage
          : defaultHandlerPackage;
      importLines.add(`import { ${group.manifestExport} } from "${handlerPackage}";`);
      const staticConst = `${workspaceManifestConstPrefix(m.id)}_${group.manifestExport}_STATIC_HANDLERS`;
      staticManifestBlocks.push(
        `const ${staticConst} = ${JSON.stringify(group.staticHandlers, null, 2)} as const satisfies Record<string, WorkspaceHttpHandlerKey>;`
      );
      staticManifestBlocks.push(
        `...staticRoutesFromManifest(${group.manifestExport}, ${staticConst}),`
      );
      for (const handlerKey of Object.values(group.staticHandlers)) {
        handlerKeys.add(String(handlerKey));
      }

      const paramHandlers = group.paramHandlers ?? {};
      const paramConst = `${workspaceManifestConstPrefix(m.id)}_${group.manifestExport}_PARAM_HANDLERS`;
      paramManifestBlocks.push(
        `const ${paramConst} = ${JSON.stringify(paramHandlers, null, 2)} as const satisfies Record<string, WorkspaceHttpHandlerKey>;`
      );
      paramManifestBlocks.push(
        `...paramRoutesFromManifest(${group.manifestExport}, ${paramConst}),`
      );
      for (const handlerKey of Object.values(paramHandlers)) {
        handlerKeys.add(String(handlerKey));
      }
    }
  }

  if (handlerKeys.size === 0) {
    throw new Error("generateWorkspaceHttpRoutes: no httpRoutes groups found in manifests");
  }

  const handlerUnion = [...handlerKeys].sort().map((key) => `  | "${key}"`).join("\n");

  return `${BANNER}
import {
  manifestPathToParamRegex,
  staticRoutesFromManifest,
} from "./workspace-route-manifest-bridge";
import type { WorkspaceHttpMethod } from "./workspace-http-method";

${[...importLines].sort().join("\n")}

export type WorkspaceHttpHandlerKey =
${handlerUnion};

export type WorkspaceHttpStaticRoute = {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
  readonly handlerKey: WorkspaceHttpHandlerKey;
};

export type WorkspaceHttpParamRoute = {
  readonly method: WorkspaceHttpMethod;
  readonly pathPattern: RegExp;
  readonly handlerKey: WorkspaceHttpHandlerKey;
};

function paramRoutesFromManifest(
  manifest: readonly { readonly method: WorkspaceHttpMethod; readonly path: string }[],
  handlerByRouteKey: Readonly<Record<string, WorkspaceHttpHandlerKey>>
): readonly WorkspaceHttpParamRoute[] {
  const routes: WorkspaceHttpParamRoute[] = [];
  for (const route of manifest) {
    if (!route.path.includes(":")) {
      continue;
    }
    const routeKey = \`\${route.method} \${route.path}\`;
    const handlerKey = handlerByRouteKey[routeKey];
    if (handlerKey === undefined) {
      throw new Error(\`workspace http route manifest missing param handler for \${routeKey}\`);
    }
    routes.push({
      method: route.method,
      pathPattern: manifestPathToParamRegex(route.path),
      handlerKey,
    });
  }
  return routes;
}

${staticManifestBlocks.filter((line) => line.startsWith("const ")).join("\n\n")}

${paramManifestBlocks.filter((line) => line.startsWith("const ")).join("\n\n")}

export const WORKSPACE_HTTP_STATIC_ROUTES: readonly WorkspaceHttpStaticRoute[] = [
${staticManifestBlocks.filter((line) => line.startsWith("...")).join("\n")}
];

export const WORKSPACE_HTTP_PARAM_ROUTES: readonly WorkspaceHttpParamRoute[] = [
${paramManifestBlocks.filter((line) => line.startsWith("...")).join("\n")}
];
`;
}

/** @param {readonly Record<string, unknown>[]} manifests */
export function generateWorkspaceHttpHandlerLoaders(manifests) {
  /** @type {Map<string, Set<string>>} */
  const packageHandlers = new Map();

  for (const m of manifests) {
    const httpRoutes = m.httpRoutes;
    if (httpRoutes === undefined || httpRoutes.loadHandlersFromPackage !== true) continue;
    const defaultHandlerPackage =
      typeof httpRoutes.handlerPackage === "string" && httpRoutes.handlerPackage.length > 0
        ? httpRoutes.handlerPackage
        : `${m.package}/http`;
    for (const group of httpRoutes.groups) {
      const handlerPackage =
        typeof group.handlerPackage === "string" && group.handlerPackage.length > 0
          ? group.handlerPackage
          : defaultHandlerPackage;
      const keys = packageHandlers.get(handlerPackage) ?? new Set();
      for (const handlerKey of Object.values(group.staticHandlers ?? {})) {
        keys.add(String(handlerKey));
      }
      for (const handlerKey of Object.values(group.paramHandlers ?? {})) {
        keys.add(String(handlerKey));
      }
      packageHandlers.set(handlerPackage, keys);
    }
  }

  if (packageHandlers.size === 0) {
    return `${BANNER}
import type { WorkspaceHttpHandlerFn, WorkspaceRouteHandlers } from "./workspace-route-registrar";

export type WorkspaceHttpPackageHandlers = Pick<WorkspaceRouteHandlers, never>;

export async function loadWorkspaceHttpHandlersForPackage(
  _pkg: string
): Promise<Partial<WorkspaceRouteHandlers>> {
  return {};
}

export async function ensureWorkspaceHttpHandler(
  _key: never
): Promise<WorkspaceHttpHandlerFn> {
  throw new Error("WORKSPACE_HTTP_HANDLER_EMPTY");
}

export function resetWorkspaceHttpHandlerPackageCache(): void {}

export async function loadWorkspaceHttpPackageHandlers(): Promise<WorkspaceHttpPackageHandlers> {
  return {};
}
`;
  }

  const packagesSorted = [...packageHandlers.keys()].sort((a, b) => a.localeCompare(b));

  /** @type {string[]} */
  const handlerToPackageEntries = [];
  for (const pkg of packagesSorted) {
    const keys = [...packageHandlers.get(pkg)].sort();
    for (const key of keys) {
      handlerToPackageEntries.push(`  ${key}: ${JSON.stringify(pkg)},`);
    }
  }

  const packageSwitchCases = packagesSorted
    .map((pkg) => {
      const keys = [...packageHandlers.get(pkg)].sort();
      const entries = keys.map((key) => `        ${key}: mod.${key},`).join("\n");
      return `    case ${JSON.stringify(pkg)}: {
      const mod = await import(${JSON.stringify(pkg)});
      return {
${entries}
      };
    }`;
    })
    .join("\n");

  const handlerUnion = [...new Set([...packageHandlers.values()].flatMap((s) => [...s]))]
    .sort()
    .map((key) => `  | "${key}"`)
    .join("\n");

  return `${BANNER}
import type { WorkspaceHttpHandlerFn, WorkspaceRouteHandlers } from "./workspace-route-registrar";

export type WorkspaceHttpPackageHandlerKey =
${handlerUnion};

export type WorkspaceHttpPackageHandlers = Pick<
  WorkspaceRouteHandlers,
  WorkspaceHttpPackageHandlerKey
>;

const WORKSPACE_HTTP_HANDLER_PACKAGE_BY_KEY = Object.freeze({
${handlerToPackageEntries.join("\n")}
}) as Readonly<Record<WorkspaceHttpPackageHandlerKey, string>>;

const WORKSPACE_HTTP_HANDLER_PACKAGES = Object.freeze([
${packagesSorted.map((pkg) => `  ${JSON.stringify(pkg)},`).join("\n")}
] as const);

/** @type {Map<string, Promise<Partial<WorkspaceRouteHandlers>>>} */
const workspaceHttpHandlerPackageCache = new Map();

/** Wave G.b — load handlers from a single HTTP handler package. */
export async function loadWorkspaceHttpHandlersForPackage(
  pkg: string
): Promise<Partial<WorkspaceRouteHandlers>> {
  switch (pkg) {
${packageSwitchCases}
    default:
      throw new Error(\`WORKSPACE_HTTP_HANDLER_PACKAGE_UNKNOWN:\${pkg}\`);
  }
}

export function resetWorkspaceHttpHandlerPackageCache(): void {
  workspaceHttpHandlerPackageCache.clear();
}

/** Wave G.b — resolve one handler; caches per package (not multi-product eager). */
export async function ensureWorkspaceHttpHandler(
  key: WorkspaceHttpPackageHandlerKey
): Promise<WorkspaceHttpHandlerFn> {
  const pkg = WORKSPACE_HTTP_HANDLER_PACKAGE_BY_KEY[key];
  let pending = workspaceHttpHandlerPackageCache.get(pkg);
  if (pending === undefined) {
    pending = loadWorkspaceHttpHandlersForPackage(pkg);
    workspaceHttpHandlerPackageCache.set(pkg, pending);
  }
  const handlers = await pending;
  const handler = handlers[key];
  if (handler == null) {
    throw new Error(\`WORKSPACE_HTTP_HANDLER_MISSING:\${key}\`);
  }
  return handler;
}

/**
 * Compat — loads **all** HTTP handler packages (tests / ownership proofs).
 * Hot path must use {@link ensureWorkspaceHttpHandler} instead (Wave G.b).
 */
export async function loadWorkspaceHttpPackageHandlers(): Promise<WorkspaceHttpPackageHandlers> {
  /** @type {Partial<WorkspaceRouteHandlers>} */
  const handlers = {};
  for (const pkg of WORKSPACE_HTTP_HANDLER_PACKAGES) {
    Object.assign(handlers, await loadWorkspaceHttpHandlersForPackage(pkg));
  }
  return handlers as WorkspaceHttpPackageHandlers;
}
`;
}

/** @param {readonly Record<string, unknown>[]} manifests */
export function generateWorkspaceHttpErrorMap(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];
  /** @type {string[]} */
  const codeStatusBlocks = [];

  for (const m of manifests) {
    const httpErrors = m.httpErrors;
    if (!Array.isArray(httpErrors) || httpErrors.length === 0) continue;
    const handlerPackage =
      typeof m.httpRoutes?.handlerPackage === "string" && m.httpRoutes.handlerPackage.length > 0
        ? m.httpRoutes.handlerPackage
        : `${m.package}/http`;

    for (const entry of httpErrors) {
      if (
        typeof entry.isErrorExport !== "string" ||
        typeof entry.codeExport !== "string" ||
        typeof entry.status !== "number"
      ) {
        throw new Error(
          `workspace.manifest.json ${m.id}: httpErrors entries require isErrorExport, codeExport, status`
        );
      }
      importLines.add(
        `import { ${entry.isErrorExport}, ${entry.codeExport} } from "${handlerPackage}";`
      );
      bindingBlocks.push(`  {
    workspaceId: ${JSON.stringify(m.id)},
    status: ${entry.status},
    isError: ${entry.isErrorExport},
    code: ${entry.codeExport},
  },`);
      codeStatusBlocks.push(`  [${entry.codeExport}]: ${entry.status},`);
    }
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS = [] as const;

export const WORKSPACE_HTTP_ERROR_CODE_STATUS = {} as const satisfies Record<string, number>;

export function resolveWorkspaceHttpErrorCodeStatus(code: string): number | undefined {
  return WORKSPACE_HTTP_ERROR_CODE_STATUS[code as keyof typeof WORKSPACE_HTTP_ERROR_CODE_STATUS];
}
`;
  }

  return `${BANNER}
${[...importLines].sort().join("\n")}

type WorkspaceHttpErrorBinding = {
  readonly workspaceId: string;
  readonly status: number;
  readonly isError: (error: unknown) => boolean;
  readonly code: string;
};

export const WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS: readonly WorkspaceHttpErrorBinding[] = [
${bindingBlocks.join("\n")}
];

export const WORKSPACE_HTTP_ERROR_CODE_STATUS = {
${codeStatusBlocks.join("\n")}
} as const satisfies Record<string, number>;

export function resolveWorkspaceHttpErrorCodeStatus(code: string): number | undefined {
  return WORKSPACE_HTTP_ERROR_CODE_STATUS[code as keyof typeof WORKSPACE_HTTP_ERROR_CODE_STATUS];
}
`;
}
