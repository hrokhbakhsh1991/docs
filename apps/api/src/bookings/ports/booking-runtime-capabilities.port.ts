/**
 * Injected runtime capability decisions for BookingsService.
 * Composition resolves graded matrix + adapter checks; application only gates on these.
 */
export type BookingRuntimeCapabilityDecision = {
  readonly enabled: boolean;
  readonly mode: string;
};

/** Host-composed write-path capability snapshot — no generated bindings. */
export type BookingRuntimeCapabilities = {
  readonly publicCreate: BookingRuntimeCapabilityDecision;
  readonly operatorCreate: BookingRuntimeCapabilityDecision;
  readonly capacity: BookingRuntimeCapabilityDecision;
  readonly validation: BookingRuntimeCapabilityDecision;
  readonly approval: BookingRuntimeCapabilityDecision;
  readonly eventReaction: BookingRuntimeCapabilityDecision;
};
