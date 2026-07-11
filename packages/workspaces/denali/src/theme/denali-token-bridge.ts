import paletteJson from "../../theme/shared/palette.json";
import semanticsLightJson from "../../theme/shared/semantics.light.json";
import adminLightFlatJson from "../../theme/shared/contexts/admin.light-flat.json";

import { WORKSPACE_THEME_CSS_VARIABLE } from "@app-tour/workspace-sdk";

export type DenaliSurfaceContext = "admin" | "portal" | "marketing";

export type DenaliTokenBridgeContext = {
  readonly surface: DenaliSurfaceContext;
  readonly cssVariables: Readonly<Record<string, string>>;
};

type DtcgGroup = Readonly<Record<string, unknown>>;

function isDtcgLeaf(value: unknown): value is { readonly $value: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "$value" in value &&
    typeof (value as { $value: string }).$value === "string"
  );
}

function readSharedJson(relativePath: string): DtcgGroup {
  switch (relativePath) {
    case "palette.json":
      return paletteJson as DtcgGroup;
    case "semantics.light.json":
      return semanticsLightJson as DtcgGroup;
    case "contexts/admin.light-flat.json":
      return adminLightFlatJson as DtcgGroup;
    default:
      throw new Error(`DENALI_TOKEN_BRIDGE_UNKNOWN_SHARED_JSON:${relativePath}`);
  }
}

function flattenDtcgValues(groups: DtcgGroup, prefix: string[] = []): Readonly<Record<string, string>> {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(groups)) {
    if (isDtcgLeaf(value)) {
      flat[[...prefix, key].join(".")] = value.$value;
      continue;
    }
    Object.assign(flat, flattenDtcgValues(value as DtcgGroup, [...prefix, key]));
  }

  return flat;
}

function resolveReference(
  flat: Readonly<Record<string, string>>,
  raw: string,
  seen: Set<string> = new Set(),
): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^\{([a-z0-9.-]+)\}$/i);
  if (!match) {
    return trimmed;
  }

  const refPath = match[1];
  if (seen.has(refPath)) {
    throw new Error(`DENALI_TOKEN_BRIDGE_CIRCULAR_REF:${refPath}`);
  }

  const target = flat[refPath];
  if (target === undefined) {
    throw new Error(`DENALI_TOKEN_BRIDGE_UNRESOLVED_REF:${refPath}`);
  }

  seen.add(refPath);
  return resolveReference(flat, target, seen);
}

function resolveDtcgGroups(groups: DtcgGroup): Readonly<Record<string, string>> {
  const flat = flattenDtcgValues(groups);
  const resolved: Record<string, string> = {};
  for (const [path, raw] of Object.entries(flat)) {
    resolved[path] = resolveReference(flat, raw);
  }
  return resolved;
}

function mergeSharedGroups(...layers: readonly DtcgGroup[]): DtcgGroup {
  const merged: Record<string, unknown> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !isDtcgLeaf(value) &&
        typeof merged[key] === "object" &&
        merged[key] !== null &&
        !isDtcgLeaf(merged[key])
      ) {
        merged[key] = mergeSharedGroups(merged[key] as DtcgGroup, value as DtcgGroup);
        continue;
      }
      merged[key] = structuredClone(value) as Record<string, unknown>;
    }
  }
  return merged;
}

function readSharedSemanticGroups(): DtcgGroup {
  return mergeSharedGroups(readSharedJson("palette.json"), readSharedJson("semantics.light.json"));
}

function readAdminOperatorGroups(): DtcgGroup {
  return mergeSharedGroups(
    readSharedSemanticGroups(),
    readSharedJson("contexts/admin.light-flat.json"),
  );
}

function colorKeyToWorkspaceVar(key: string): string {
  return `--ws-color-${key}`;
}

function buildSharedWorkspaceCssVariables(
  resolved: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const cssVariables: Record<string, string> = {
    [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: resolved["flat.accent"] ?? resolved["color.primary"] ?? "#0f766e",
  };

  const colorKeys = [
    "primary",
    "primary-hover",
    "primary-fg",
    "bg-page",
    "bg-surface",
    "bg-muted",
    "text-primary",
    "text-secondary",
    "text-muted",
    "border-default",
    "border-subtle",
  ] as const;

  for (const key of colorKeys) {
    const value = resolved[`color.${key}`];
    if (value !== undefined) {
      cssVariables[colorKeyToWorkspaceVar(key)] = value;
    }
  }

  const radius = resolved["flat.radius"];
  if (radius !== undefined) {
    cssVariables["--ws-radius"] = radius;
  }

  return cssVariables;
}

function buildAdminWorkspaceCssVariables(
  resolved: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const cssVariables: Record<string, string> = {
    ...buildSharedWorkspaceCssVariables(resolved),
  };

  const sidebarKeys = [
    ["sidebar", "--ws-sidebar"],
    ["sidebar-border", "--ws-sidebar-border"],
    ["sidebar-foreground", "--ws-sidebar-foreground"],
    ["sidebar-primary", "--ws-sidebar-primary"],
    ["sidebar-accent", "--ws-sidebar-accent"],
  ] as const;

  for (const [flatKey, cssVar] of sidebarKeys) {
    const value = resolved[`flat.${flatKey}`];
    if (value !== undefined) {
      cssVariables[cssVar] = value;
    }
  }

  return cssVariables;
}

/**
 * Builds Denali `--ws-*` variables from `theme/shared/` for admin and guest surfaces.
 * Admin includes operator sidebar tokens; portal/marketing receive shared brand contract only.
 */
export function buildDenaliTokenBridgeContexts(): {
  readonly shared: Readonly<Record<string, string>>;
  readonly admin: DenaliTokenBridgeContext;
  readonly portal: DenaliTokenBridgeContext;
  readonly marketing: DenaliTokenBridgeContext;
} {
  const sharedResolved = resolveDtcgGroups(readSharedSemanticGroups());
  const adminResolved = resolveDtcgGroups(readAdminOperatorGroups());

  const shared = Object.freeze(buildSharedWorkspaceCssVariables(sharedResolved));
  const admin = Object.freeze({
    surface: "admin" as const,
    cssVariables: Object.freeze(buildAdminWorkspaceCssVariables(adminResolved)),
  });
  const portal = Object.freeze({
    surface: "portal" as const,
    cssVariables: Object.freeze({ ...shared }),
  });
  const marketing = Object.freeze({
    surface: "marketing" as const,
    cssVariables: Object.freeze({ ...shared }),
  });

  return Object.freeze({ shared, admin, portal, marketing });
}

/** Pre-resolved admin surface `--ws-*` map for operator ThemeProvider ingress. */
export const DENALI_ADMIN_SURFACE_CSS_VARIABLES = buildDenaliTokenBridgeContexts().admin.cssVariables;

/** Shared brand `--ws-*` map for guest surfaces (portal + marketing manifest theme). */
export const DENALI_GUEST_SURFACE_CSS_VARIABLES = buildDenaliTokenBridgeContexts().shared;
