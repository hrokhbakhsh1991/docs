import type { MemberModuleManifest, MemberPortalSurface } from "./member-module-manifest";
import { mergePlatformMemberPortalModules } from "./platform-member-portal-modules";
import {
  WORKSPACE_MEMBER_PORTAL_CONTRACTS,
  type MemberPortalContractRow,
} from "./workspace-member-portal-contracts.generated";

export type MemberPortalAvailability = "off" | "minimal" | "full";

export type MemberPortalContract =
  | { readonly availability: "off" }
  | {
      readonly availability: Extract<MemberPortalAvailability, "minimal" | "full">;
      readonly surface: MemberPortalSurface;
    };

export class MemberPortalDisabledError extends Error {
  readonly code = "MEMBER_PORTAL_DISABLED" as const;

  constructor(pluginId: string) {
    super(`MEMBER_PORTAL_DISABLED:${pluginId}`);
    this.name = "MemberPortalDisabledError";
  }
}

function buildSurface(
  row: Extract<MemberPortalContractRow, { readonly availability: "minimal" | "full" }>
): MemberPortalSurface {
  const modules: readonly MemberModuleManifest[] = row.includePlatformHome
    ? mergePlatformMemberPortalModules(row.modules)
    : Object.freeze([...row.modules]);

  return Object.freeze({
    manifestVersion: 1,
    defaultPrimaryModuleId: row.defaultPrimaryModuleId,
    modules,
  });
}

/** Authoritative member portal contract — never infers from conformance level. */
export function resolveMemberPortalContract(
  pluginId: string
): MemberPortalContract {
  const row = WORKSPACE_MEMBER_PORTAL_CONTRACTS[pluginId];
  if (row === undefined || row.availability === "off") {
    return Object.freeze({ availability: "off" });
  }

  return Object.freeze({
    availability: row.availability,
    surface: buildSurface(row),
  });
}

export function isMemberPortalEnabled(pluginId: string): boolean {
  return resolveMemberPortalContract(pluginId).availability !== "off";
}

export function assertMemberPortalEnabled(
  pluginId: string
): asserts pluginId is string {
  if (!isMemberPortalEnabled(pluginId)) {
    throw new MemberPortalDisabledError(pluginId);
  }
}
