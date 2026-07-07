export type ExposureCatalogField = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly kind: "text" | "number" | "date" | "enum" | "boolean" | "composite";
  readonly tags?: readonly string[];
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export type WorkspaceExposureCatalogResponse = {
  readonly workspaceType: string | null;
  readonly fields: readonly ExposureCatalogField[];
  readonly source:
    | "published_wizard_template"
    | "registry_deliverable_migration_seed";
};

const PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE =
  "published_wizard_template" as const;
const REGISTRY_DELIVERABLE_EXPOSURE_CATALOG_SOURCE =
  "registry_deliverable_migration_seed" as const;

function parseExposureCatalogField(payload: unknown): ExposureCatalogField | null {
  const record =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const id = typeof record.id === "string" ? record.id : "";
  if (id === "") {
    return null;
  }
  const kind =
    record.kind === "number" ||
    record.kind === "date" ||
    record.kind === "enum" ||
    record.kind === "boolean" ||
    record.kind === "composite"
      ? record.kind
      : "text";
  return {
    id,
    canonicalPath: typeof record.canonicalPath === "string" ? record.canonicalPath : id,
    kind,
    ...(Array.isArray(record.tags)
      ? { tags: record.tags.filter((tag): tag is string => typeof tag === "string") }
      : {}),
    ...(typeof record.adminLabel === "string" && record.adminLabel.trim().length > 0
      ? { adminLabel: record.adminLabel.trim() }
      : {}),
    ...(typeof record.adminDescription === "string" && record.adminDescription.trim().length > 0
      ? { adminDescription: record.adminDescription.trim() }
      : {}),
    ...(typeof record.group === "string" && record.group.trim().length > 0
      ? { group: record.group.trim() }
      : {}),
    ...(typeof record.icon === "string" && record.icon.trim().length > 0
      ? { icon: record.icon.trim() }
      : {}),
  };
}

export function parseWorkspaceExposureCatalogResponse(
  payload: unknown,
): WorkspaceExposureCatalogResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("EXPOSURE_CATALOG_INVALID");
  }
  const record = payload as Record<string, unknown>;
  return {
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : null,
    fields: Array.isArray(record.fields)
      ? record.fields
          .map(parseExposureCatalogField)
          .filter((field): field is ExposureCatalogField => field !== null)
      : [],
    source:
      record.source === PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE
        ? PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE
        : REGISTRY_DELIVERABLE_EXPOSURE_CATALOG_SOURCE,
  };
}

export async function fetchWorkspaceExposureCatalog(
  workspaceId: string,
): Promise<WorkspaceExposureCatalogResponse> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/exposure/catalog`, {
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string" ? payload.code : `EXPOSURE_CATALOG_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseWorkspaceExposureCatalogResponse(payload);
}
