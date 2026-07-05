/**
 * PS-6 — More hub presentation (DL-10).
 * @see docs/phase-19/member-portal-shell/member-portal-registry-schema.mdoc §6.1
 */

import type { MemberModuleManifest } from "./member-module-manifest";
import { resolveMemberPortalModules } from "./resolve-member-portal-modules";

/** Secondary module count at which hub list switches to virtualised presentation (DL-10). */
export const MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD = 25;

/** Platform-owned More hub route — workspace MUST NOT declare module id `more`. */
export const MEMBER_PORTAL_MORE_ROUTE_PATH = "/me/more";

export type MemberPortalHubPresentationMode = "plain" | "virtualised";

export type MemberPortalHubPresentation = {
  readonly mode: MemberPortalHubPresentationMode;
  readonly moduleCount: number;
  readonly threshold: typeof MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD;
};

export function resolveMemberPortalSecondaryModules(
  pluginId: string
): readonly MemberModuleManifest[] {
  const surface = resolveMemberPortalModules(pluginId);
  return Object.freeze(surface.modules.filter((module) => module.nav.tier === "secondary"));
}

export function resolveMemberPortalHubPresentation(
  secondaryModuleCount: number
): MemberPortalHubPresentation {
  const mode: MemberPortalHubPresentationMode =
    secondaryModuleCount >= MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD ? "virtualised" : "plain";
  return Object.freeze({
    mode,
    moduleCount: secondaryModuleCount,
    threshold: MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD,
  });
}

/** Whether shell should render the platform More nav slot. */
export function shouldRenderMemberPortalMoreHub(secondaryModuleCount: number): boolean {
  return secondaryModuleCount > 0;
}
