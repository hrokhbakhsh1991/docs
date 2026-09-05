import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { mergeShallowCanonicalPatchData } from "@app-tour/tour-core";

import { WORKSPACE_TOUR_WRITE_BINDINGS } from "./workspace-tour-write-bindings.generated";

type CanonicalPatchData = Record<string, unknown>;

type TourPatchMerger = (
  existing: CanonicalPatchData,
  patch: CanonicalPatchData | undefined
) => CanonicalPatchData;

/** Workspace publish-field gates accept product-specific bodies via generated bindings. */
type TourPublishFieldGate = (body: unknown) => boolean;

type PublishFieldOwnerAssert = (params: {
  readonly auth: TenantAuthContext;
  readonly workspaceType: string;
  readonly surface: string;
}) => void;

type TourWriteBinding = (typeof WORKSPACE_TOUR_WRITE_BINDINGS)[number];

function buildBindingMaps() {
  const mergers: Record<string, TourPatchMerger> = {};
  const gates: Record<string, TourPublishFieldGate> = {};
  const surfaces: Record<string, string> = {};
  const ownerAsserts: Record<string, PublishFieldOwnerAssert> = {};
  const memberPatchForbidden = new Set<string>();

  for (const binding of WORKSPACE_TOUR_WRITE_BINDINGS) {
    const workspaceType = binding.workspaceType as string;
    mergers[workspaceType] = binding.mergeCanonicalPatch as TourPatchMerger;
    gates[workspaceType] = binding.publishFieldGate as TourPublishFieldGate;
    surfaces[workspaceType] = binding.publishOwnerSurface as string;
    const assertFn = (binding as TourWriteBinding & {
      assertPublishFieldOwner?: PublishFieldOwnerAssert;
    }).assertPublishFieldOwner;
    if (assertFn !== undefined) {
      ownerAsserts[workspaceType] = assertFn;
    }
    if (
      (binding as TourWriteBinding & { forbidOperatorMemberTourPatch?: true })
        .forbidOperatorMemberTourPatch === true
    ) {
      memberPatchForbidden.add(workspaceType);
    }
  }

  return {
    patchMergers: Object.freeze(mergers),
    publishFieldGates: Object.freeze(gates),
    ownerSurfaces: Object.freeze(surfaces),
    ownerAsserts: Object.freeze(ownerAsserts),
    memberPatchForbidden,
  };
}

const { patchMergers, publishFieldGates, ownerSurfaces, ownerAsserts, memberPatchForbidden } =
  buildBindingMaps();

export function mergeCanonicalPatchDataForWorkspace(
  workspaceType: string,
  existing: CanonicalPatchData,
  patch: CanonicalPatchData | undefined
): CanonicalPatchData {
  const merger = patchMergers[workspaceType];
  if (merger !== undefined) {
    return merger(existing, patch);
  }
  return mergeShallowCanonicalPatchData(existing, patch);
}

export function tourPatchTouchesProtectedPublishFields(
  workspaceType: string,
  body: unknown
): boolean {
  const gate = publishFieldGates[workspaceType];
  return gate !== undefined ? gate(body) : false;
}

export function tourPublishFieldOwnerSurface(workspaceType: string): string | undefined {
  return ownerSurfaces[workspaceType];
}

export function assertTourPublishFieldOwner(input: {
  readonly auth: TenantAuthContext;
  readonly workspaceType: string;
  readonly surface: string;
}): void {
  const assertFn = ownerAsserts[input.workspaceType];
  if (assertFn === undefined) {
    return;
  }
  assertFn(input);
}

export function operatorMemberTourPatchForbidden(workspaceType: string): boolean {
  return memberPatchForbidden.has(workspaceType);
}

/** Denali operator panel: member and viewer are read-only for tour PATCH (owner/admin only). */
export function operatorTourPatchForbiddenForRole(
  workspaceType: string,
  role: string
): boolean {
  return (
    operatorMemberTourPatchForbidden(workspaceType) &&
    (role === "member" || role === "viewer")
  );
}

export function resolveStarterCreateBridgeOperatorTenantId(
  workspaceType: string
): string | undefined {
  for (const binding of WORKSPACE_TOUR_WRITE_BINDINGS) {
    if (binding.workspaceType !== workspaceType) {
      continue;
    }
    if ("starterCreateBridgeOperatorTenantId" in binding) {
      return binding.starterCreateBridgeOperatorTenantId as string;
    }
  }
  return undefined;
}
