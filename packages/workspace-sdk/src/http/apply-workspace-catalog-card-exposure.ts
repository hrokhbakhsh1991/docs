import type { CanonicalDocument } from "../canonical/canonical-document";
import type { WorkspaceExposureResolverPort } from "./workspace-http-ports";

export type ApplyWorkspaceCatalogCardExposureParams<TCard, TCoordinate> = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly canonical: CanonicalDocument;
  readonly card: TCard;
  readonly exposurePort?: WorkspaceExposureResolverPort<TCoordinate>;
  readonly resolveCoordinate: () => TCoordinate;
  readonly applyExposure: (card: TCard, visibleFieldIds: ReadonlySet<string>) => TCard;
};

/**
 * Shared catalog-card exposure apply (DG-1.3).
 * Workspace supplies coordinate resolver + card binding; host supplies exposure port.
 */
export async function applyWorkspaceCatalogCardExposure<TCard, TCoordinate>(
  params: ApplyWorkspaceCatalogCardExposureParams<TCard, TCoordinate>,
): Promise<TCard> {
  if (params.exposurePort === undefined) {
    return params.card;
  }
  const visibleFieldIds = await params.exposurePort.resolveVisibleFieldIds({
    tenantId: params.tenantId,
    tourId: params.tourId,
    canonical: params.canonical,
    coordinate: params.resolveCoordinate(),
  });
  return params.applyExposure(params.card, new Set(visibleFieldIds));
}

/** One registry fieldId → card redaction step (DG-3.3). Binding tables stay in W. */
export type WorkspaceCatalogCardFieldBinding<TCard> = {
  readonly fieldId: string;
  readonly applyHidden: (card: TCard) => TCard;
};

/**
 * Apply fieldId→applyHidden bindings for fields not in the visible set (DG-3.3).
 * Product packages run product-specific post-steps after this loop.
 */
export function applyWorkspaceCatalogCardFieldBindings<TCard>(
  card: TCard,
  visibleFieldIds: ReadonlySet<string>,
  bindings: readonly WorkspaceCatalogCardFieldBinding<TCard>[],
): TCard {
  let next = card;
  for (const binding of bindings) {
    if (!visibleFieldIds.has(binding.fieldId)) {
      next = binding.applyHidden(next);
    }
  }
  return next;
}

/**
 * Freeze a card copy with one string-ish field set to null (DG-3.6).
 * Binding tables stay in W; this is the shared redaction primitive.
 */
export function clearWorkspaceCatalogCardStringField<TCard extends object>(
  card: TCard,
  key: keyof TCard & string,
): TCard {
  return Object.freeze({ ...card, [key]: null }) as TCard;
}

/**
 * Freeze a card copy with one key removed (DG-3.6) — e.g. omit `structuredData`.
 */
export function omitWorkspaceCatalogCardKey<TCard extends object>(
  card: TCard,
  key: string,
): TCard {
  const next = { ...card } as Record<string, unknown>;
  delete next[key];
  return Object.freeze(next) as TCard;
}
