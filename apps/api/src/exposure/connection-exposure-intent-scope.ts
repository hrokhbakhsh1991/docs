import type { Prisma } from "@prisma/client";

import type { ExposureIntent } from "./exposure-intent";
import {
  exposureIntentContextLookupKey,
  type ExposureIntentRepository,
} from "./exposure-intent.repository";
import type { FieldExposureRuntimeCoordinate } from "./resolve-runtime-truth-source";

import type { ExposureIntentScope } from "./exposure-intent.repository";

export function buildConnectionExposureIntentScope(input: {
  readonly connectionId: string;
  readonly eventType: string;
}): ExposureIntentScope {
  return {
    connectionId: input.connectionId,
    eventType: input.eventType,
  };
}

/** Removes all native intents bound to a connection scope (route + legacy shapes). */
export async function deleteConnectionExposureIntentsInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    readonly tenantId: string;
    readonly connectionId: string;
  },
): Promise<number> {
  const result = await tx.exposureIntent.deleteMany({
    where: {
      tenantId: input.tenantId,
      scope: {
        path: ["connectionId"],
        equals: input.connectionId,
      },
    },
  });
  return result.count;
}

export async function findConnectionExposureIntentForEvent(
  repository: ExposureIntentRepository,
  input: {
    readonly tenantId: string;
    readonly profileId: string;
    readonly surface: string;
    readonly audience: string;
    readonly trigger: string;
    readonly connectionId: string;
    readonly eventType: string;
  },
): Promise<ExposureIntent | null> {
  return repository.findForContext({
    tenantId: input.tenantId,
    profileId: input.profileId,
    surface: input.surface,
    audience: input.audience,
    trigger: input.trigger,
    scope: buildConnectionExposureIntentScope({
      connectionId: input.connectionId,
      eventType: input.eventType,
    }),
  });
}

/** @deprecated Use findConnectionExposureIntentForEvent — legacy scope fallback removed after 9.5b. */
export const findConnectionExposureIntentWithLegacyScopeFallback =
  findConnectionExposureIntentForEvent;

export function coordinateFromIntent(
  intent: ExposureIntent,
  fallback: FieldExposureRuntimeCoordinate,
): FieldExposureRuntimeCoordinate {
  return {
    surface:
      typeof intent.surface === "string" && intent.surface.trim().length > 0
        ? intent.surface
        : fallback.surface,
    audience:
      typeof intent.audience === "string" && intent.audience.trim().length > 0
        ? intent.audience
        : fallback.audience,
    trigger:
      typeof intent.trigger === "string" && intent.trigger.trim().length > 0
        ? intent.trigger
        : fallback.trigger,
  };
}

export async function resolveConnectionExposureIntentForRoute(
  repository: ExposureIntentRepository,
  input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly eventType: string;
    readonly defaultCoordinate: FieldExposureRuntimeCoordinate;
    readonly legacyProfileId?: string;
  },
): Promise<{
  readonly exposureIntent: ExposureIntent | null;
  readonly effectiveContext: FieldExposureRuntimeCoordinate;
  readonly coordinateControlsRuntimeEffective: boolean;
}> {
  const routeScoped = (
    await repository.listForConnectionScope({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
    })
  ).find((intent) => intent.scope.eventType === input.eventType);
  if (routeScoped !== undefined) {
    return {
      exposureIntent: routeScoped,
      effectiveContext: coordinateFromIntent(routeScoped, input.defaultCoordinate),
      coordinateControlsRuntimeEffective: true,
    };
  }

  if (input.legacyProfileId !== undefined) {
    const routed = await findConnectionExposureIntentForEvent(repository, {
      tenantId: input.tenantId,
      profileId: input.legacyProfileId,
      surface: input.defaultCoordinate.surface,
      audience: input.defaultCoordinate.audience,
      trigger: input.defaultCoordinate.trigger,
      connectionId: input.connectionId,
      eventType: input.eventType,
    });
    if (routed !== null) {
      return {
        exposureIntent: routed,
        effectiveContext: input.defaultCoordinate,
        coordinateControlsRuntimeEffective: false,
      };
    }
  }

  return {
    exposureIntent: null,
    effectiveContext: input.defaultCoordinate,
    coordinateControlsRuntimeEffective: false,
  };
}

export function resolveConnectionIntentForEventSync(input: {
  readonly tenantId: string;
  readonly connectionId: string;
  readonly eventType: string;
  readonly defaultCoordinate: FieldExposureRuntimeCoordinate;
  readonly legacyProfileId?: string;
  readonly connectionIntents: readonly ExposureIntent[];
  readonly legacyIntentLookup: ReadonlyMap<string, ExposureIntent>;
}): {
  readonly exposureIntent: ExposureIntent | null;
  readonly effectiveContext: FieldExposureRuntimeCoordinate;
  readonly coordinateControlsRuntimeEffective: boolean;
} {
  const routeScoped = input.connectionIntents.find(
    (intent) => intent.scope.eventType === input.eventType,
  );
  if (routeScoped !== undefined) {
    return {
      exposureIntent: routeScoped,
      effectiveContext: coordinateFromIntent(routeScoped, input.defaultCoordinate),
      coordinateControlsRuntimeEffective: true,
    };
  }

  if (input.legacyProfileId !== undefined) {
    const lookupKey = exposureIntentContextLookupKey({
      tenantId: input.tenantId,
      profileId: input.legacyProfileId,
      surface: input.defaultCoordinate.surface,
      audience: input.defaultCoordinate.audience,
      trigger: input.defaultCoordinate.trigger,
      scope: buildConnectionExposureIntentScope({
        connectionId: input.connectionId,
        eventType: input.eventType,
      }),
    });
    const routed = input.legacyIntentLookup.get(lookupKey) ?? null;
    if (routed !== null) {
      return {
        exposureIntent: routed,
        effectiveContext: input.defaultCoordinate,
        coordinateControlsRuntimeEffective: false,
      };
    }
  }

  return {
    exposureIntent: null,
    effectiveContext: input.defaultCoordinate,
    coordinateControlsRuntimeEffective: false,
  };
}
