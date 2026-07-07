import type { ShadowDeliveryParity } from "./shadow-delivery-field-parity";
import type { ShadowRenderedParity } from "./shadow-rendered-delivery-parity";

export type ShadowExposureParity = {
  readonly matches: boolean;
  readonly mismatches: readonly string[];
};

export function resolveShadowExposureParity(input: {
  readonly deliveryParity: ShadowDeliveryParity;
  readonly renderedParity: ShadowRenderedParity;
  readonly intentParity?: {
    readonly matches: boolean;
    readonly mismatches: readonly string[];
  };
}): ShadowExposureParity {
  const mismatches = [
    ...input.deliveryParity.mismatches,
    ...input.renderedParity.mismatches,
    ...(input.intentParity?.matches === false ? input.intentParity.mismatches : []),
  ];

  return {
    matches:
      input.deliveryParity.matches &&
      input.renderedParity.matches &&
      (input.intentParity?.matches ?? true),
    mismatches,
  };
}
