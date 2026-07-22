import type { DraftSchemaGate } from "@app-tour/draft-engine";
import type { MutableRefObject } from "react";

/**
 * Schema gate that delegates to a ref populated later by wizard rule sync.
 * Until the ref is set, candidates pass through unchanged.
 */
export function createDeferredDraftSchemaGate<T>(
  gateRef: MutableRefObject<DraftSchemaGate<T> | null>
): DraftSchemaGate<T> {
  return (candidate, ctx) => {
    const active = gateRef.current;
    if (active == null) {
      return { ok: true, value: candidate };
    }
    return active(candidate, ctx);
  };
}
