import type { WorkspaceTourCommercialCapability } from "@app-tour/workspace-sdk";

export function resolveTourSuggestedPrepaymentMinor(input: {
  readonly tourCanonicalData: unknown;
  readonly invoiceTotalMinor: string;
  readonly balanceDueMinor: string;
  readonly commercialPolicy?: Pick<
    WorkspaceTourCommercialCapability,
    "resolveSuggestedPrepaymentMinor"
  > | null;
}): string | null {
  return input.commercialPolicy?.resolveSuggestedPrepaymentMinor?.(input) ?? null;
}
