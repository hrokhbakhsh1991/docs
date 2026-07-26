/** HTTP path for Urban owner settings (matches `URBAN_HTTP_ROUTE_MANIFEST`). */
export const URBAN_OWNER_SETTINGS_HTTP_PATH = "/urban/settings" as const;

export type UrbanOwnerSettingsPanelLabels = {
  readonly title: string;
  readonly loadError: (status: number) => string;
  readonly catalogEnabled: string;
  readonly catalogSlug: string;
  readonly registrationPolicy: string;
  readonly yes: string;
  readonly no: string;
  readonly viewCatalog: string;
};

export type UrbanOwnerSettingsEnvelope = {
  readonly success: boolean;
  readonly data?: {
    readonly urban?: {
      readonly catalog?: { readonly publicEnabled?: boolean; readonly slug?: string };
      readonly registration?: { readonly policy?: string };
    };
  };
};

export type UrbanOwnerSettingsPanelProps = {
  readonly apiBaseUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly labels: UrbanOwnerSettingsPanelLabels;
  readonly catalogHref?: string;
  readonly fetchImpl?: typeof fetch;
};

/**
 * Urban owner settings read panel — host injects API base, auth headers, and labels (Wave H.i).
 */
export async function UrbanOwnerSettingsPanel(props: UrbanOwnerSettingsPanelProps) {
  const fetchImpl = props.fetchImpl ?? fetch;
  const catalogHref = props.catalogHref ?? "/catalog";
  const res = await fetchImpl(`${props.apiBaseUrl}${URBAN_OWNER_SETTINGS_HTTP_PATH}`, {
    method: "GET",
    headers: props.headers,
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div role="alert" data-urban-settings-error data-status-code={String(res.status)}>
        <p>{props.labels.loadError(res.status)}</p>
      </div>
    );
  }

  const body = (await res.json()) as UrbanOwnerSettingsEnvelope;
  const urban = body.data?.urban;

  return (
    <section data-urban-owner-settings-panel data-workspace-owner-settings-panel>
      <h1>{props.labels.title}</h1>
      <dl>
        <dt>{props.labels.catalogEnabled}</dt>
        <dd>{urban?.catalog?.publicEnabled === false ? props.labels.no : props.labels.yes}</dd>
        <dt>{props.labels.catalogSlug}</dt>
        <dd>{urban?.catalog?.slug ?? "catalog"}</dd>
        <dt>{props.labels.registrationPolicy}</dt>
        <dd>{urban?.registration?.policy ?? "open"}</dd>
      </dl>
      <p>
        <a href={catalogHref}>{props.labels.viewCatalog}</a>
      </p>
    </section>
  );
}

/** Wave H.m — product-blind shell alias (same component). */
export const WorkspaceOwnerSettingsPanel = UrbanOwnerSettingsPanel;
export type WorkspaceOwnerSettingsPanelProps = UrbanOwnerSettingsPanelProps;
export type WorkspaceOwnerSettingsPanelLabels = UrbanOwnerSettingsPanelLabels;
