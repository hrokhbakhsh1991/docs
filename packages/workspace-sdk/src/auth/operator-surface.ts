import type { TenantAuthContext } from "./auth-context";
import type { SettingsModuleManifest } from "../operator/settings/settings-module-manifest";
import { isAdminOrOwner, isAuthzGranted, isWorkspaceOwner } from "./tenant-auth-grants";

/** Operator admin surfaces (DEC-P9-004 · CASL-OPERATOR-SPEC § OperatorSurface). */
export type OperatorSurface =
  | "operator.session.read"
  | "operator.dashboard.read"
  | "operator.tours.read"
  | "operator.tours.mutate"
  | "operator.users.read"
  | "operator.users.mutate"
  | "operator.bookings.read"
  | "operator.bookings.approve"
  | "operator.settings.read"
  | "operator.settings.mutate"
  | "operator.finance.read";

export type CanPerformOperatorSurfaceOptions = {
  /** Manifest rows for per-module read/mutate resolution (DEC-P9-009). */
  readonly settingsModules?: readonly SettingsModuleManifest[];
};

/** Fallback when manifest not passed — readonly explorer modules members may read. */
const MEMBER_READABLE_SETTINGS_MODULE_IDS = new Set<string>(["audit_trail", "workspace_branding"]);

const OWNER_ONLY_OPERATOR_SURFACES = new Set<string>([
  "operator.users.read",
  "operator.users.mutate",
]);

const ADMIN_ONLY_OPERATOR_SURFACES = new Set<string>([
  "operator.tours.mutate",
  "operator.bookings.approve",
  "operator.settings.read",
  "operator.settings.mutate",
  "operator.finance.read",
]);

const MEMBER_READ_OPERATOR_SURFACES = new Set<string>([
  "operator.session.read",
  "operator.dashboard.read",
  "operator.tours.read",
  "operator.bookings.read",
]);

function resolveSettingsModuleGrant(
  context: TenantAuthContext,
  moduleId: string,
  verb: "read" | "mutate",
  settingsModules?: readonly SettingsModuleManifest[]
): boolean {
  if (verb === "mutate") {
    return isAdminOrOwner(context);
  }
  const manifestRow = settingsModules?.find((row) => row.id === moduleId);
  if (manifestRow?.kind === "readonly_explorer") {
    return isAuthzGranted(context);
  }
  if (MEMBER_READABLE_SETTINGS_MODULE_IDS.has(moduleId)) {
    return isAuthzGranted(context);
  }
  return isAdminOrOwner(context);
}

export function evaluateOperatorSurfaceGrant(
  context: TenantAuthContext,
  surface: string,
  options?: CanPerformOperatorSurfaceOptions
): boolean {
  if (!isAuthzGranted(context)) {
    return false;
  }

  const settingsModuleMatch = /^operator\.settings\.([^.]+)\.(read|mutate)$/.exec(surface);
  if (settingsModuleMatch !== null) {
    const moduleId = settingsModuleMatch[1] ?? "";
    const verb = settingsModuleMatch[2] as "read" | "mutate";
    return resolveSettingsModuleGrant(context, moduleId, verb, options?.settingsModules);
  }

  if (OWNER_ONLY_OPERATOR_SURFACES.has(surface)) {
    return isWorkspaceOwner(context);
  }

  if (ADMIN_ONLY_OPERATOR_SURFACES.has(surface)) {
    return isAdminOrOwner(context);
  }

  if (MEMBER_READ_OPERATOR_SURFACES.has(surface)) {
    return true;
  }

  return false;
}
