import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type { UrbanTourPatchBody } from "@app-tour/workspace-urban/tours";

import { WORKSPACE_TOUR_WRITE_BINDINGS } from "./workspace-tour-write-bindings.generated";

type CanonicalPatchData = Record<string, unknown>;

type TourPatchMerger = (
  existing: CanonicalPatchData,
  patch: CanonicalPatchData | undefined
) => CanonicalPatchData;

type TourPublishFieldGate = (body: UrbanTourPatchBody) => boolean;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Root-level shallow merge for starter/default workspaces without a manifest merger. */
function mergeDefaultCanonicalPatchData(
  existing: CanonicalPatchData,
  patch: CanonicalPatchData | undefined,
): CanonicalPatchData {
  if (patch === undefined) {
    return existing;
  }
  const next: CanonicalPatchData = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (isRecord(value) && isRecord(existing[key])) {
      next[key] = { ...(existing[key] as Record<string, unknown>), ...value };
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function mergeCanonicalPatchDataForWorkspace(
  workspaceType: string,
  existing: CanonicalPatchData,
  patch: CanonicalPatchData | undefined
): CanonicalPatchData {
  const merger = patchMergers[workspaceType];
  if (merger !== undefined) {
    return merger(existing, patch);
  }
  return mergeDefaultCanonicalPatchData(existing, patch);
}

export function tourPatchTouchesProtectedPublishFields(
  workspaceType: string,
  body: UrbanTourPatchBody
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
