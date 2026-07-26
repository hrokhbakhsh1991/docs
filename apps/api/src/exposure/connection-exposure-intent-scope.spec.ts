import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NATIVE_EXPOSURE_INTENT_SOURCE, type ExposureIntent } from "./exposure-intent";
import type { ExposureIntentRepository } from "./exposure-intent.repository";
import {
  buildConnectionExposureIntentScope,
  deleteConnectionExposureIntentsInTransaction,
  findConnectionExposureIntentForEvent,
  resolveConnectionExposureIntentForRoute,
} from "./connection-exposure-intent-scope";

const INTENT: ExposureIntent = {
  id: "intent-1",
  profileId: "denali.telegram.TourCreated",
  workspaceType: "denali",
  entityType: "tour",
  surface: "telegram",
  audience: "external_channel",
  trigger: "TourCreated",
  scope: { connectionId: "conn-1", eventType: "TourCreated" },
  mode: "override_fields",
  selectedFieldIds: ["title"],
  source: NATIVE_EXPOSURE_INTENT_SOURCE,
  sourceId: "intent-1",
  version: "2026-01-01T00:00:00.000Z",
};

function repository(found: boolean): ExposureIntentRepository {
  return {
    async findForContext(input) {
      assert.deepEqual(input.scope, {
        connectionId: "conn-1",
        eventType: "TourCreated",
      });
      return found ? INTENT : null;
    },
    async listForConnectionScope() {
      return [];
    },
    async upsert() {
      throw new Error("not used");
    },
  };
}

function listRepository(intents: readonly ExposureIntent[]): ExposureIntentRepository {
  return {
    async findForContext() {
      return null;
    },
    async listForConnectionScope() {
      return intents;
    },
    async upsert() {
      throw new Error("not used");
    },
  };
}

describe("connection exposure intent scope", () => {
  it("stores route event type separately from exposure trigger", async () => {
    assert.deepEqual(
      buildConnectionExposureIntentScope({
        connectionId: "conn-1",
        eventType: "TourCreated",
      }),
      {
        connectionId: "conn-1",
        eventType: "TourCreated",
      },
    );
  });

  it("deleteConnectionExposureIntentsInTransaction filters by scope.connectionId", async () => {
    let captured: unknown;
    const count = await deleteConnectionExposureIntentsInTransaction(
      {
        exposureIntent: {
          deleteMany: async (args: unknown) => {
            captured = args;
            return { count: 2 };
          },
        },
      } as never,
      { tenantId: "tenant-a", connectionId: "conn-1" },
    );
    assert.equal(count, 2);
    assert.deepEqual(captured, {
      where: {
        tenantId: "tenant-a",
        scope: {
          path: ["connectionId"],
          equals: "conn-1",
        },
      },
    });
  });

  it("findConnectionExposureIntentForEvent uses route-scoped lookup only", async () => {
    assert.equal(
      await findConnectionExposureIntentForEvent(repository(true), {
        tenantId: "tenant-a",
        profileId: "denali.telegram.TourCreated",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
        connectionId: "conn-1",
        eventType: "TourCreated",
      }),
      INTENT,
    );
    assert.equal(
      await findConnectionExposureIntentForEvent(repository(false), {
        tenantId: "tenant-a",
        profileId: "denali.telegram.TourCreated",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
        connectionId: "conn-1",
        eventType: "TourCreated",
      }),
      null,
    );
  });

  it("uses route-scoped stored coordinates as runtime effective", async () => {
    const customIntent: ExposureIntent = {
      ...INTENT,
      trigger: "TourPublished",
      profileId: "denali.telegram.TourPublished",
      scope: { connectionId: "conn-1", eventType: "TourCreated" },
    };

    assert.deepEqual(
      await resolveConnectionExposureIntentForRoute(listRepository([customIntent]), {
        tenantId: "tenant-a",
        connectionId: "conn-1",
        eventType: "TourCreated",
        defaultCoordinate: {
          surface: "telegram",
          audience: "external_channel",
          trigger: "TourCreated",
        },
        legacyProfileId: "denali.telegram.TourCreated",
      }),
      {
        exposureIntent: customIntent,
        effectiveContext: {
          surface: "telegram",
          audience: "external_channel",
          trigger: "TourPublished",
        },
        coordinateControlsRuntimeEffective: true,
      },
    );
  });

  it("uses the newest route-scoped row when duplicate route anchors exist", async () => {
    const olderIntent: ExposureIntent = {
      ...INTENT,
      id: "older",
      sourceId: "older",
      trigger: "TourPublished",
      profileId: "denali.telegram.TourPublished",
      scope: { connectionId: "conn-1", eventType: "TourCreated" },
    };
    const newestIntent: ExposureIntent = {
      ...INTENT,
      id: "newest",
      sourceId: "newest",
      trigger: "PaymentCompleted",
      profileId: "denali.telegram.PaymentCompleted",
      scope: { connectionId: "conn-1", eventType: "TourCreated" },
    };

    const resolved = await resolveConnectionExposureIntentForRoute(
      listRepository([newestIntent, olderIntent]),
      {
        tenantId: "tenant-a",
        connectionId: "conn-1",
        eventType: "TourCreated",
        defaultCoordinate: {
          surface: "telegram",
          audience: "external_channel",
          trigger: "TourCreated",
        },
        legacyProfileId: "denali.telegram.TourCreated",
      },
    );

    assert.equal(resolved.exposureIntent?.sourceId, "newest");
    assert.equal(resolved.effectiveContext.trigger, "PaymentCompleted");
  });

  it("resolves profile-scoped route intents with default coordinates when list miss", async () => {
    assert.deepEqual(
      await resolveConnectionExposureIntentForRoute(repository(true), {
        tenantId: "tenant-a",
        connectionId: "conn-1",
        eventType: "TourCreated",
        defaultCoordinate: {
          surface: "telegram",
          audience: "external_channel",
          trigger: "TourCreated",
        },
        legacyProfileId: "denali.telegram.TourCreated",
      }),
      {
        exposureIntent: INTENT,
        effectiveContext: {
          surface: "telegram",
          audience: "external_channel",
          trigger: "TourCreated",
        },
        coordinateControlsRuntimeEffective: false,
      },
    );
  });
});
