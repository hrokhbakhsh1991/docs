"use client";

import { useContext } from "react";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { DenaliCanonicalContext } from "../DenaliCanonicalContext";

/** Internal read access to the canonical tour model — not for step/component UI. */
export function useDenaliCanonicalModel(): DenaliCanonicalTourModel {
  const ctx = useContext(DenaliCanonicalContext);
  if (ctx == null) {
    throw new Error("useDenaliCanonicalModel must be used within DenaliCanonicalProvider");
  }
  return ctx.canonicalModel;
}
