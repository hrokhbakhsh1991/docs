import type { UrbanTourPatchBody } from "@app-tour/workspace-urban/tours";

import { WORKSPACE_TOUR_WRITE_BINDINGS } from "./workspace-tour-write-bindings.generated";

type CanonicalPatchData = Record<string, unknown>;

type TourPatchMerger = (
  existing: CanonicalPatchData,
  patch: CanonicalPatchData | undefined
) => CanonicalPatchData;

type TourPublishFieldGate = (body: UrbanTourPatchBody) => boolean;

function buildBindingMaps() {
  const mergers: Record<string, TourPatchMerger> = {};
  const gates: Record<string, TourPublishFieldGate> = {};
  const surfaces: Record<string, string> = {};

  for (const binding of WORKSPACE_TOUR_WRITE_BINDINGS) {
    const workspaceType = binding.workspaceType as string;
    mergers[workspaceType] = binding.mergeCanonicalPatch as TourPatchMerger;
    gates[workspaceType] = binding.publishFieldGate as TourPublishFieldGate;
    surfaces[workspaceType] = binding.publishOwnerSurface as string;
  }

  return {
    patchMergers: Object.freeze(mergers),
    publishFieldGates: Object.freeze(gates),
    ownerSurfaces: Object.freeze(surfaces),
  };
}

const { patchMergers, publishFieldGates, ownerSurfaces } = buildBindingMaps();

export function mergeCanonicalPatchDataForWorkspace(
  workspaceType: string,
  existing: CanonicalPatchData,
  patch: CanonicalPatchData | undefined
): CanonicalPatchData {
  const merger = patchMergers[workspaceType];
  if (merger !== undefined) {
    return merger(existing, patch);
  }
  return patch === undefined ? existing : patch;
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
