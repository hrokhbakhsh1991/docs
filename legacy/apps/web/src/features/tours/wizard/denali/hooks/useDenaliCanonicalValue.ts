"use client";

import { useMemo } from "react";

import { getDenaliCanonicalPathValue } from "../denaliCanonicalPathUtils";
import { useDenaliCanonicalModel } from "./useDenaliCanonicalModel";

/**
 * Reads a registry `canonicalPath` from the Denali canonical context.
 * Sole UI read path for step/component fields (see `@repo/denali-domain` registry).
 */
export function useDenaliCanonicalValue<T = unknown>(canonicalPath: string): T {
  const model = useDenaliCanonicalModel();
  return useMemo(
    () => getDenaliCanonicalPathValue(model, canonicalPath) as T,
    [canonicalPath, model],
  );
}
