import { randomUUID } from "node:crypto";

import type { DenaliTourMutationSideEffect } from "@app-tour/workspace-denali/tours";

type TourMutationOutboxRow = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly domainEventId: string;
};

const memoryTourMutationOutbox: TourMutationOutboxRow[] = [];

export function resetTourMutationOutboxForTests(): void {
  memoryTourMutationOutbox.length = 0;
}

export function listTourMutationOutboxForTests(): readonly TourMutationOutboxRow[] {
  return memoryTourMutationOutbox;
}

function sideEffectToEventType(kind: DenaliTourMutationSideEffect["kind"]): string {
  switch (kind) {
    case "notification_required":
      return "tour.mutation.notification_required";
    case "repricing_required":
      return "tour.mutation.repricing_required";
    case "transport_review_required":
      return "tour.mutation.transport_review_required";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export async function emitTourMutationSideEffects(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly sideEffects: readonly DenaliTourMutationSideEffect[];
  readonly changedFields: readonly string[];
}): Promise<void> {
  if (input.sideEffects.length === 0) {
    return;
  }

  for (const sideEffect of input.sideEffects) {
    const eventType = sideEffectToEventType(sideEffect.kind);
    const domainEventId = `${eventType}:${input.tourId}:${randomUUID()}`;
    const payload = {
      tourId: input.tourId,
      kind: sideEffect.kind,
      fields: [...sideEffect.fields],
      changedFields: [...input.changedFields],
    };

    const persisted = await (async () => {
      const { persistStandaloneOutboxRowIfPrismaDriver } = await import(
        "../outbox/persist-standalone-outbox-row"
      );
      return persistStandaloneOutboxRowIfPrismaDriver({
        tenantId: input.tenantId,
        aggregateType: "tour",
        aggregateId: input.tourId,
        eventType,
        payload,
        domainEventId,
      });
    })();
    if (persisted) {
      continue;
    }

    memoryTourMutationOutbox.push({
      tenantId: input.tenantId,
      tourId: input.tourId,
      eventType,
      payload,
      domainEventId,
    });
  }
}
