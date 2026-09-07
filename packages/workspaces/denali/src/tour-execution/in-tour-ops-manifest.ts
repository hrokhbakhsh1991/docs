/**
 * ITO-001 — Denali in-tour operations UI manifest (REFACTOR-01).
 * Optional panels default off; enable via tenant theme `inTourOps.panels`.
 */
export type InTourOpsManifest = {
  readonly version: "1";
  readonly enabled: boolean;
  readonly panels: {
    readonly groups: boolean;
    readonly checklists: boolean;
    readonly incidentLog: boolean;
  };
};

export const DEFAULT_IN_TOUR_OPS_MANIFEST: InTourOpsManifest = Object.freeze({
  version: "1",
  enabled: true,
  panels: Object.freeze({
    groups: false,
    checklists: false,
    incidentLog: false,
  }),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

/** Merge tenant theme `inTourOps` overrides onto Denali default manifest. */
export function resolveInTourOpsManifestFromTheme(theme: unknown = null): InTourOpsManifest {
  if (!isRecord(theme)) {
    return DEFAULT_IN_TOUR_OPS_MANIFEST;
  }
  const raw = theme.inTourOps;
  if (!isRecord(raw)) {
    return DEFAULT_IN_TOUR_OPS_MANIFEST;
  }
  const panelsRaw = isRecord(raw.panels) ? raw.panels : {};
  return Object.freeze({
    version: "1",
    enabled: readBoolean(raw, "enabled", DEFAULT_IN_TOUR_OPS_MANIFEST.enabled),
    panels: Object.freeze({
      groups: readBoolean(panelsRaw, "groups", DEFAULT_IN_TOUR_OPS_MANIFEST.panels.groups),
      checklists: readBoolean(
        panelsRaw,
        "checklists",
        DEFAULT_IN_TOUR_OPS_MANIFEST.panels.checklists,
      ),
      incidentLog: readBoolean(
        panelsRaw,
        "incidentLog",
        DEFAULT_IN_TOUR_OPS_MANIFEST.panels.incidentLog,
      ),
    }),
  });
}
