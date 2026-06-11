import { buildServerCloneTourApiPath } from "./proxy-tour-clone-api.server";

export type ServerCloneTourResponse = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: {
    readonly data?: Record<string, unknown>;
    readonly schemaVersion?: number;
    readonly roots?: readonly string[];
  };
};

export type RequestServerTourCloneOptions = {
  readonly activeEquipmentIds?: readonly string[];
};

export function buildServerCloneTourUrl(tourId: string): string {
  return buildServerCloneTourApiPath(tourId);
}

/** One-shot server duplicate via web BFF (Phase 11.14). */
export async function requestServerTourClone(
  tourId: string,
  options?: RequestServerTourCloneOptions
): Promise<ServerCloneTourResponse> {
  const body =
    options?.activeEquipmentIds !== undefined
      ? { activeEquipmentIds: [...options.activeEquipmentIds] }
      : {};

  const response = await fetch(buildServerCloneTourUrl(tourId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code =
      typeof payload.code === "string"
        ? payload.code
        : typeof payload.error === "string"
          ? payload.error
          : `TOUR_CLONE_HTTP_${response.status}`;
    throw new Error(code);
  }

  const id = typeof payload.id === "string" ? payload.id : "";
  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : "";
  const canonical = payload.canonical;
  if (id.length === 0 || tenantId.length === 0 || canonical == null || typeof canonical !== "object") {
    throw new Error("TOUR_CLONE_INVALID_RESPONSE");
  }

  return {
    id,
    tenantId,
    canonical: canonical as ServerCloneTourResponse["canonical"],
  };
}
