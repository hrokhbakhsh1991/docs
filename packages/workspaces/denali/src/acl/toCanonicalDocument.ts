import { createCanonicalDocument, type CanonicalDocument } from "@app-tour/workspace-sdk";

import {
  normalizeLegacyTripDetails,
  type LegacyTripDetailsBlob,
} from "./normalizeLegacyTripDetails";

export type DenaliLegacyCreateTourInput = {
  readonly basics?: Record<string, unknown>;
  readonly tripDetails?: LegacyTripDetailsBlob;
  readonly [key: string]: unknown;
};

/**
 * Maps legacy create-tour strips into a platform {@link CanonicalDocument}.
 * Phase 6.2 scaffold — minimal projection for registry-parity validateCanonical tests.
 */
export function toCanonicalDocument(legacy: DenaliLegacyCreateTourInput): CanonicalDocument {
  const basics = legacy.basics ?? {};
  const tripDetails = normalizeLegacyTripDetails(legacy.tripDetails);

  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["basics", "tripDetails"],
    data: {
      basics,
      tripDetails,
    },
  });
}
