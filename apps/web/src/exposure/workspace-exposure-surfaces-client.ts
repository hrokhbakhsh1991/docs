export type WorkspaceExposureSurfaceDefinition = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly triggerLabel: string;
  readonly defaultFieldIds: readonly string[];
  readonly activeIntent: {
    readonly mode: "inherit_profile" | "override_fields" | "disabled";
    readonly selectedFieldIds: readonly string[] | null;
  } | null;
};

export type WorkspaceExposureSurfacesResponse = {
  readonly workspaceType: string;
  readonly surfaces: readonly WorkspaceExposureSurfaceDefinition[];
};

export function parseWorkspaceExposureSurfacesResponse(
  payload: unknown,
): WorkspaceExposureSurfacesResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("EXPOSURE_SURFACES_INVALID");
  }
  const record = payload as Record<string, unknown>;
  const surfaces = Array.isArray(record.surfaces)
    ? record.surfaces.filter(
        (entry): entry is WorkspaceExposureSurfaceDefinition =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as { surface?: unknown }).surface === "string",
      )
    : [];
  return {
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : "",
    surfaces,
  };
}

export async function fetchWorkspaceExposureSurfaces(
  workspaceId: string,
): Promise<WorkspaceExposureSurfacesResponse> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/exposure/surfaces`, {
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    throw new Error(`EXPOSURE_SURFACES_HTTP_${res.status}`);
  }
  return parseWorkspaceExposureSurfacesResponse(payload);
}

export type PatchWorkspaceSurfaceExposureIntentInput = {
  readonly audience: string;
  readonly trigger: string;
  readonly enabled: boolean;
  readonly selectedFieldIds: readonly string[];
};

export async function patchWorkspaceSurfaceExposureIntent(
  workspaceId: string,
  surfaceKey: string,
  input: PatchWorkspaceSurfaceExposureIntentInput,
): Promise<void> {
  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/exposure/surfaces/${encodeURIComponent(surfaceKey)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const code =
      typeof payload.code === "string"
        ? payload.code
        : `EXPOSURE_SURFACE_PATCH_HTTP_${res.status}`;
    throw new Error(code);
  }
}
