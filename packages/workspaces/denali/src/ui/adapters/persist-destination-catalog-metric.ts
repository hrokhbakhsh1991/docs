import type { DenaliDestinationCatalogMetricBinding } from "../../settings/destination-catalog-metric-bindings";
import { parseDestinationCatalogMetricPatchValue } from "../../settings/resolve-destination-catalog-metric-lock";
import type { DestinationResource } from "./catalog-types";

export type PatchDestinationCatalogMetricResult =
  | { readonly ok: true; readonly destination: DestinationResource }
  | { readonly ok: false; readonly code: string };

export async function patchDestinationCatalogMetric(input: {
  readonly destinationId: string;
  readonly binding: DenaliDestinationCatalogMetricBinding;
  readonly rawValue: string;
}): Promise<PatchDestinationCatalogMetricResult> {
  const parsed = parseDestinationCatalogMetricPatchValue(input.rawValue, input.binding);
  if (parsed == null) {
    return { ok: false, code: "DESTINATION_METRIC_INVALID" };
  }

  const response = await fetch(`/api/settings/resources/locations/${input.destinationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [input.binding.patchField]: parsed }),
  });

  if (!response.ok) {
    return { ok: false, code: `DESTINATION_METRIC_PATCH_HTTP_${response.status}` };
  }

  const body: unknown = await response.json();
  if (body == null || typeof body !== "object" || !("id" in body)) {
    return { ok: false, code: "DESTINATION_METRIC_PATCH_INVALID_BODY" };
  }

  return { ok: true, destination: body as DestinationResource };
}
