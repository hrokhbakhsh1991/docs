import type { NormalizedExposureTrigger } from "./types";

const KNOWN_INTEGRATION_EVENT_TRIGGERS: Readonly<Record<string, NormalizedExposureTrigger>> = {
  TourCreated: { kind: "event", name: "tour_created" },
  TourPublished: { kind: "event", name: "tour_published" },
};

function toSnakeCaseEventName(eventType: string): string {
  return eventType
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

/**
 * Maps integration eventType strings into normalized exposure triggers.
 * No scheduling, provider, or relative-time evaluation.
 */
export function normalizeIntegrationEventType(eventType: string): NormalizedExposureTrigger {
  const trimmed = eventType.trim();
  if (trimmed.length === 0) {
    return { kind: "event", name: "unknown" };
  }

  const known = KNOWN_INTEGRATION_EVENT_TRIGGERS[trimmed];
  if (known !== undefined) {
    return known;
  }

  return { kind: "event", name: toSnakeCaseEventName(trimmed) };
}
