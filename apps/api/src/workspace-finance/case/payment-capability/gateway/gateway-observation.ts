/**
 * Non-blocking gateway observation (PR10-C).
 * Never gates business workflow; Host may no-op or emit metrics.
 */

export type GatewayObservationEvent =
  | {
      readonly kind: "provider_latency";
      readonly subjectId: string;
      readonly latencyMs: number;
    }
  | {
      readonly kind: "provider_degradation";
      readonly subjectId: string;
      readonly reason: string;
    }
  | {
      readonly kind: "unsupported_gateway_fields";
      readonly subjectId: string;
      readonly fields: readonly string[];
    };

export type GatewayObservationSink = {
  observe(event: GatewayObservationEvent): void;
};

export function createNoopGatewayObservationSink(): GatewayObservationSink {
  return { observe() {} };
}

export function createInMemoryGatewayObservationSink(): {
  readonly sink: GatewayObservationSink;
  readonly events: GatewayObservationEvent[];
} {
  const events: GatewayObservationEvent[] = [];
  return {
    events,
    sink: {
      observe(event) {
        events.push(event);
      },
    },
  };
}
