import { validateStructuredData } from "@app-tour/workspace-sdk";

import {
  enrichMarketingTourStructuredData,
  type EnrichMarketingStructuredDataInput,
} from "./enrich-marketing-structured-data";

/** Enrich workspace JSON-LD with the marketing URL, then fail closed on invalid shape. */
export function buildValidatedMarketingTourStructuredData(
  input: EnrichMarketingStructuredDataInput
): Readonly<Record<string, unknown>> | null {
  const structuredData = enrichMarketingTourStructuredData(input);
  const validation = validateStructuredData(structuredData);
  return validation.ok ? structuredData : null;
}
