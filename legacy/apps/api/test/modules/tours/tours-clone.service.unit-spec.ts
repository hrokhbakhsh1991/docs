import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";

import { listDenaliSettingsOverlayStoragePaths, buildDenaliClonePresetFromTripDetails } from "@repo/denali-domain";

import { ToursCloneService } from "../../../src/modules/tours/services/tours-clone.service";
import { TourCloneSourceLockedException } from "../../../src/modules/tours/services/tours-clone-source-lock.service";
import type { TourTripDetails } from "../../../src/modules/tours/types/tour-trip-details.types";

type CloneUnitTestDeps = {
  loggerService?: { error: (message: string, meta?: Record<string, unknown>) => void };
  requestContext?: {
    resolveEffectiveTenantId: () => string | null;
    getUserId: () => string | null;
  };
  toursCatalogRead?: { getTourEntityById: (id: string) => Promise<unknown> };
  settingsRepository?: { findTourWizardTemplateByWorkspace: (id: string) => Promise<unknown> };
  templateOrchestrator?: {
    listModernOverlayStoragePaths: () => readonly string[];
    createDraftFromTemplate?: (input: unknown, opts: unknown) => Promise<unknown>;
  };
  toursService?: {
    createTour: (dto: unknown, opts?: { assignedTourId?: string }) => Promise<unknown>;
  };
  fileStorage?: Record<string, never>;
  lock?: {
    withSourceCloneLock: <T>(source: string, tenant: string, fn: () => Promise<T>) => Promise<T>;
  };
  pendingStorage?: {
    executeCloneCopiesWithSaga: (input: unknown) => Promise<void>;
    releaseCloneOperation: (
      tenantId: string,
      cloneOperationId: string,
      options?: { destinationTourId?: string },
    ) => Promise<void>;
  };
};

type MockCloneSourceLock = {
  lock: {
    withSourceCloneLock: <T>(source: string, tenant: string, fn: () => Promise<T>) => Promise<T>;
  };
  readonly calls: Array<{ source: string; tenant: string }>;
};

/** Tracks lock acquisition and enforces exclusive hold (mutation-resistant vs no-op passthrough). */
function createMockCloneSourceLock(): MockCloneSourceLock {
  const calls: Array<{ source: string; tenant: string }> = [];
  let activeSource: string | null = null;

  return {
    calls,
    lock: {
      async withSourceCloneLock<T>(source: string, tenant: string, fn: () => Promise<T>): Promise<T> {
        calls.push({ source, tenant });
        if (activeSource != null) {
          throw new TourCloneSourceLockedException();
        }
        activeSource = source;
        try {
          return await fn();
        } finally {
          activeSource = null;
        }
      },
    },
  };
}

const SOURCE_TOUR_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TENANT_ID = "tenant-1";

function minimalCloneTourMocks(overrides: Partial<CloneUnitTestDeps> = {}): CloneUnitTestDeps {
  const sourceTripDetails = {
    overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
    photos: [
      {
        id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
        filename: "tour.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  } as TourTripDetails;

  const base: CloneUnitTestDeps = {
    requestContext: {
      resolveEffectiveTenantId: () => TENANT_ID,
      getUserId: () => "user-1",
    },
    toursCatalogRead: {
      getTourEntityById: async () => ({
        title: "Source",
        totalCapacity: 10,
        transportModes: [],
        details: { tripDetails: sourceTripDetails },
      }),
    },
    settingsRepository: {
      findTourWizardTemplateByWorkspace: async () => ({
        id: "tpl-1",
        workspaceId: TENANT_ID,
        canonicalData: {},
        fieldRulesOverlay: {},
      }),
    },
    templateOrchestrator: {
      listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
      createDraftFromTemplate: async () => ({
        success: true,
        payload: { title: "Clone", tourType: "mountain", transportModes: [] },
      }),
    },
    toursService: {
      createTour: async (_dto: unknown, opts?: { assignedTourId?: string }) => ({
        id: opts?.assignedTourId ?? "new-tour",
      }),
    },
  };

  return {
    ...base,
    ...overrides,
    toursService: { ...base.toursService, ...overrides.toursService },
    pendingStorage: overrides.pendingStorage ?? base.pendingStorage,
    templateOrchestrator: overrides.templateOrchestrator ?? base.templateOrchestrator,
    toursCatalogRead: overrides.toursCatalogRead ?? base.toursCatalogRead,
    settingsRepository: overrides.settingsRepository ?? base.settingsRepository,
    requestContext: overrides.requestContext ?? base.requestContext,
  } as CloneUnitTestDeps;
}

function createToursCloneServiceForUnitTests(overrides: CloneUnitTestDeps = {}): ToursCloneService {
  const mockLock = overrides.lock ? null : createMockCloneSourceLock();
  const lock = overrides.lock ?? mockLock!.lock;
  const pendingStorage = overrides.pendingStorage ?? {
    executeCloneCopiesWithSaga: async () => undefined,
    releaseCloneOperation: async () => undefined,
  };
  const templateOrchestrator = overrides.templateOrchestrator ?? {
    listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
  };
  const loggerService = overrides.loggerService ?? { error: () => undefined };

  return new ToursCloneService(
    (overrides.requestContext ?? {}) as never,
    (overrides.toursCatalogRead ?? {}) as never,
    (overrides.settingsRepository ?? {}) as never,
    templateOrchestrator as never,
    (overrides.fileStorage ?? {}) as never,
    (overrides.toursService ?? {}) as never,
    lock as never,
    pendingStorage as never,
    loggerService as never,
  );
}

test("ToursCloneService.cloneTripDetailsForWizard preserves 5-zone pins and itinerary geo", () => {
  const service = createToursCloneServiceForUnitTests();
  const source = {
    overview: {
      denaliTourKind: "mountain_multi",
      leaderUserIds: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
      localGuideName: "Guide Ali",
      startPoint: { addressText: "Rineh", latitude: 35.9, longitude: 52.1 },
      summitPoint: { addressText: "Summit", latitude: 35.95, longitude: 52.11 },
      campPoint: { addressText: "Camp", latitude: 35.92, longitude: 52.05 },
      endPoint: { addressText: "Return", latitude: 35.7, longitude: 51.4 },
      difficultyLevel: 6,
      tourThemeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
      shortIntro: "Short",
    },
    logistics: {
      gatheringPoints: [
        {
          title: "Tehran",
          location: { id: "s1", addressText: "Tehran", latitude: 35.7, longitude: 51.4 },
        },
      ],
    },
    itinerary: {
      dayPlans: [
        {
          day: 1,
          title: "Day stop",
          description: "Hike",
          location: { addressText: "Trail", latitude: 36, longitude: 52.2 },
          photos: [
            {
              id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
              url: "https://example.com/d1.jpg",
              filename: "d1.jpg",
              size: 100,
              mimeType: "image/jpeg",
              uploadedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        },
      ],
    },
    photos: [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        url: "https://example.com/tour.jpg",
        filename: "tour.jpg",
        size: 200,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  } as TourTripDetails;

  const cloned = service.cloneTripDetailsForWizard(source);
  assert.ok(cloned);
  assert.deepEqual(cloned!.overview?.tourThemeIds, source.overview?.tourThemeIds);
  assert.deepEqual(cloned!.overview?.leaderUserIds, source.overview?.leaderUserIds);
  assert.equal(cloned!.overview?.localGuideName, "Guide Ali");
  assert.equal(cloned!.logistics?.gatheringPoints?.[0]?.title, "Tehran");
  assert.equal(cloned!.logistics?.gatheringPoints?.[0]?.location?.latitude, 35.7);
  assert.ok(cloned!.logistics?.gatheringPoints?.[0]?.location?.id);
  assert.notEqual(cloned!.logistics?.gatheringPoints?.[0]?.location?.id, "s1");
  assert.equal(cloned!.itinerary?.dayPlans?.[0]?.location?.longitude, 52.2);
  assert.equal(cloned!.itinerary?.dayPlans?.[0]?.photos?.length, 1);
  const sourceDayPhotoId = source.itinerary?.dayPlans?.[0]?.photos?.[0]?.id;
  const clonedDayPhotoId = cloned!.itinerary?.dayPlans?.[0]?.photos?.[0]?.id;
  assert.ok(sourceDayPhotoId);
  assert.ok(clonedDayPhotoId);
  assert.notEqual(clonedDayPhotoId, sourceDayPhotoId);
  assert.equal("url" in (cloned!.itinerary?.dayPlans?.[0]?.photos?.[0] ?? {}), false);
  assert.equal(cloned!.photos?.length, 1);
  const sourceTourPhotoId = source.photos?.[0]?.id;
  const clonedTourPhotoId = cloned!.photos?.[0]?.id;
  assert.ok(sourceTourPhotoId);
  assert.ok(clonedTourPhotoId);
  assert.notEqual(clonedTourPhotoId, sourceTourPhotoId);
  assert.equal("url" in (cloned!.photos?.[0] ?? {}), false);
});

test("ToursCloneService.tripDetailsToDenaliPresetDefaults maps nested itinerary location", () => {
  const service = createToursCloneServiceForUnitTests();
  const defaults = service.tripDetailsToDenaliPresetDefaults({
    overview: {
      denaliTourKind: "mountain_day",
      tourThemeIds: [],
      shortIntro: "x",
    },
    logistics: {
      gatheringPoints: [
        { title: "Meet", location: { addressText: "Meet", latitude: 1, longitude: 2 } },
      ],
    },
    itinerary: {
      dayPlans: [
        {
          day: 1,
          title: "Stop",
          description: "Walk",
          location: { addressText: "Stop", latitude: 3, longitude: 4 },
        },
      ],
    },
  } as TourTripDetails);
  const program = defaults.programNature as { itinerary?: Array<{ location?: { latitude?: number } }> };
  assert.equal(program.itinerary?.[0]?.location?.latitude, 3);
  const tripDetails = defaults.tripDetails as {
    logistics?: {
      gatheringPoints?: Array<{ title?: string; location?: { latitude?: number } }>;
    };
  };
  assert.equal(tripDetails.logistics?.gatheringPoints?.[0]?.location?.latitude, 1);
});

test("ToursCloneService.tripDetailsToDenaliPresetDefaults uses empty preset when remint yields nothing", () => {
  const service = createToursCloneServiceForUnitTests();
  const storagePaths = listDenaliSettingsOverlayStoragePaths();
  const expected = buildDenaliClonePresetFromTripDetails({}, { storagePaths });
  const defaults = service.tripDetailsToDenaliPresetDefaults({} as TourTripDetails);
  assert.deepEqual(defaults.basicInfo, expected.basicInfo);
  assert.deepEqual(defaults.tripDetails.overview, expected.tripDetails.overview);
});

test("ToursCloneService.cloneTripDetailsWithRemap returns undefined for null or empty source", () => {
  const service = createToursCloneServiceForUnitTests();
  assert.equal(service.cloneTripDetailsWithRemap(null), undefined);
  assert.equal(service.cloneTripDetailsWithRemap({}), undefined);
});

test("ToursCloneService.cloneTripDetailsWithRemap returns photoIdRemap for valid source", () => {
  const service = createToursCloneServiceForUnitTests();
  const sourcePhotoId = "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33";
  const result = service.cloneTripDetailsWithRemap({
    overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
    photos: [
      {
        id: sourcePhotoId,
        filename: "tour.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  } as TourTripDetails);

  assert.ok(result);
  assert.ok(result!.photoIdRemap.has(sourcePhotoId));
  assert.notEqual(result!.photoIdRemap.get(sourcePhotoId), sourcePhotoId);
});

test("ToursCloneService.cloneTour omits customServiceLabels when projection sends empty array", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: true,
          payload: {
            title: "Clone",
            tourType: "mountain",
            transportModes: [],
            customServiceLabels: [],
          },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.equal(capturedDto?.customServiceLabels, undefined);
});

test("ToursCloneService.cloneTour uses source description when projection description is non-string", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          title: "Source",
          totalCapacity: 10,
          transportModes: [],
          description: "Persisted description",
          details: {
            tripDetails: {
              overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
              photos: [
                {
                  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
                  filename: "tour.jpg",
                  size: 1,
                  mimeType: "image/jpeg",
                  uploadedAt: "2026-06-01T00:00:00.000Z",
                },
              ],
            },
          },
        }),
      },
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: true,
          payload: {
            title: "Clone",
            tourType: "mountain",
            transportModes: [],
            description: 42,
          },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.equal(capturedDto?.description, "Persisted description");
});

test("ToursCloneService.cloneTour uses source autoAcceptRegistrations when projection value is non-boolean", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          title: "Source",
          totalCapacity: 10,
          transportModes: [],
          autoAcceptRegistrations: true,
          details: {
            tripDetails: {
              overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
              photos: [
                {
                  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
                  filename: "tour.jpg",
                  size: 1,
                  mimeType: "image/jpeg",
                  uploadedAt: "2026-06-01T00:00:00.000Z",
                },
              ],
            },
          },
        }),
      },
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: true,
          payload: {
            title: "Clone",
            tourType: "mountain",
            transportModes: [],
            autoAcceptRegistrations: "yes",
          },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.equal(capturedDto?.autoAcceptRegistrations, true);
});

test("ToursCloneService.cloneTour omits cost_context when source costContext is not an object", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          title: "Source",
          totalCapacity: 10,
          transportModes: [],
          costContext: "not-an-object",
          details: {
            tripDetails: {
              overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
              photos: [
                {
                  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
                  filename: "tour.jpg",
                  size: 1,
                  mimeType: "image/jpeg",
                  uploadedAt: "2026-06-01T00:00:00.000Z",
                },
              ],
            },
          },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.equal(capturedDto?.cost_context, undefined);
});

test("ToursCloneService.cloneTour maps projection fallbacks and source fields into CreateTourDto", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const sourceTripDetails = {
    overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
    photos: [
      {
        id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
        filename: "tour.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  } as TourTripDetails;

  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          title: "  Alpine Trek  ",
          totalCapacity: 25,
          transportModes: ["bus"],
          autoAcceptRegistrations: true,
          description: "Source description",
          chatLink: "https://chat.example/tour",
          costContext: { currency: "USD", estimatedTotal: 100 },
          details: { tripDetails: sourceTripDetails },
        }),
      },
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: true,
          payload: {
            description: "Projection description",
            autoAcceptRegistrations: false,
            tourType: "mountain",
            destinationId: "dest-uuid",
            meetingPoint: "Trailhead",
            durationDays: 3,
            customServiceLabels: ["porter", "guide"],
          },
        }),
      },
      toursService: {
        createTour: async (dto: unknown, opts?: { assignedTourId?: string }) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: opts?.assignedTourId ?? "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });

  assert.ok(capturedDto);
  assert.equal(capturedDto!.title, "Alpine Trek (Copy)");
  assert.equal(capturedDto!.total_capacity, 25);
  assert.equal(capturedDto!.description, "Projection description");
  assert.equal(capturedDto!.autoAcceptRegistrations, false);
  assert.deepEqual(capturedDto!.transportModes, ["bus"]);
  assert.deepEqual(capturedDto!.customServiceLabels, ["porter", "guide"]);
  assert.equal(capturedDto!.destinationId, "dest-uuid");
  assert.equal(capturedDto!.meetingPoint, "Trailhead");
  assert.equal(capturedDto!.durationDays, 3);
  assert.equal(capturedDto!.chat_link, "https://chat.example/tour");
  assert.equal(capturedDto!.sourceTourId, SOURCE_TOUR_ID);
  const costContext = capturedDto!.cost_context as { currency?: string } | undefined;
  assert.equal(costContext?.currency, "USD");
});

test("ToursCloneService.cloneTour falls back to source transportModes when projection omits array", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          title: "Source",
          totalCapacity: 10,
          transportModes: ["walk", "bus"],
          details: {
            tripDetails: {
              overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
              photos: [
                {
                  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
                  filename: "tour.jpg",
                  size: 1,
                  mimeType: "image/jpeg",
                  uploadedAt: "2026-06-01T00:00:00.000Z",
                },
              ],
            },
          },
        }),
      },
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: true,
          payload: { title: "Clone", tourType: "mountain" },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.deepEqual(capturedDto?.transportModes, ["walk", "bus"]);
});

test("ToursCloneService.cloneTour falls back to source scalar fields when projection omits them", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const sourceTripDetails = {
    overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
    photos: [
      {
        id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
        filename: "tour.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  } as TourTripDetails;

  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          totalCapacity: 12,
          transportModes: ["bus"],
          autoAcceptRegistrations: true,
          description: "Source-only description",
          tourType: "desert",
          details: { tripDetails: sourceTripDetails },
        }),
      },
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: true,
          payload: {
            title: "Clone",
            customServiceLabels: [],
          },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });

  assert.equal(capturedDto?.title, "Tour (Copy)");
  assert.equal(capturedDto?.description, "Source-only description");
  assert.equal(capturedDto?.autoAcceptRegistrations, true);
  assert.equal(capturedDto?.tourType, "desert");
  assert.equal(capturedDto?.customServiceLabels, undefined);
});

test("ToursCloneService.cloneTour leaves tourType undefined when projection and source omit it", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const sourceTripDetails = {
    overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
    photos: [
      {
        id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
        filename: "tour.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  } as TourTripDetails;

  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          title: "Source",
          totalCapacity: 10,
          transportModes: [],
          details: { tripDetails: sourceTripDetails },
        }),
      },
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: true,
          payload: { title: "Clone" },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.equal(capturedDto?.tourType, undefined);
});

test("ToursCloneService.cloneTour prefers projection transportModes when array is present", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: true,
          payload: {
            title: "Clone",
            tourType: "mountain",
            transportModes: ["helicopter"],
          },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.deepEqual(capturedDto?.transportModes, ["helicopter"]);
});

test("ToursCloneService.cloneTour omits cost_context when source has none", async () => {
  let capturedDto: Record<string, unknown> | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          title: "Source",
          totalCapacity: 10,
          transportModes: [],
          costContext: null,
          details: {
            tripDetails: {
              overview: { denaliTourKind: "mountain_day", tourThemeIds: [], shortIntro: "x" },
              photos: [
                {
                  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
                  filename: "tour.jpg",
                  size: 1,
                  mimeType: "image/jpeg",
                  uploadedAt: "2026-06-01T00:00:00.000Z",
                },
              ],
            },
          },
        }),
      },
      toursService: {
        createTour: async (dto: unknown) => {
          capturedDto = dto as Record<string, unknown>;
          return { id: "new-tour" };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.equal(capturedDto?.cost_context, undefined);
});

test("ToursCloneService.cloneTour logs stringified release error when release throws non-Error", async () => {
  let loggedError: string | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursService: {
        createTour: async () => {
          throw new Error("CREATE_FAILED");
        },
      },
      pendingStorage: {
        executeCloneCopiesWithSaga: async () => undefined,
        releaseCloneOperation: async () => {
          throw "RELEASE_STRING";
        },
      },
    }),
    loggerService: {
      error: (_message: string, meta?: Record<string, unknown>) => {
        loggedError = meta?.error as string | undefined;
      },
    },
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    /CREATE_FAILED/,
  );
  assert.equal(loggedError, "RELEASE_STRING");
});

test("ToursCloneService.cloneTour logs destination tour id when release fails after successful create", async () => {
  let loggedDestinationTourId: string | undefined;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      pendingStorage: {
        executeCloneCopiesWithSaga: async () => undefined,
        releaseCloneOperation: async () => {
          throw new Error("RELEASE_FAILED");
        },
      },
    }),
    loggerService: {
      error: (_message: string, meta?: Record<string, unknown>) => {
        loggedDestinationTourId = meta?.destination_tour_id as string | undefined;
      },
    },
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.equal(typeof loggedDestinationTourId, "string");
  assert.notEqual(loggedDestinationTourId, undefined);
});

test("ToursCloneService.cloneTour passes empty overlay when template fieldRulesOverlay is null", async () => {
  let capturedOverlay: unknown;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      settingsRepository: {
        findTourWizardTemplateByWorkspace: async () => ({
          id: "tpl-1",
          workspaceId: TENANT_ID,
          canonicalData: {},
          fieldRulesOverlay: null,
        }),
      },
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async (input: unknown) => {
          capturedOverlay = (input as { fieldRulesOverlay?: unknown }).fieldRulesOverlay;
          return { success: true, payload: { title: "Clone", tourType: "mountain", transportModes: [] } };
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  assert.deepEqual(capturedOverlay, {});
});

test("ToursCloneService.cloneTour rejects when source clone lock is not acquired", async () => {
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks(),
    lock: {
      withSourceCloneLock: async () => {
        throw new TourCloneSourceLockedException();
      },
    },
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    (error: unknown) => error instanceof TourCloneSourceLockedException,
  );
});

test("ToursCloneService.cloneTour rejects empty source trip details", async () => {
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursCatalogRead: {
        getTourEntityById: async () => ({
          title: "Source",
          totalCapacity: 10,
          transportModes: [],
          details: { tripDetails: null },
        }),
      },
    }),
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    (error: unknown) => {
      if (!(error instanceof BadRequestException)) {
        return false;
      }
      const response = error.getResponse() as { error?: { code?: string } };
      return response.error?.code === "TOUR_CLONE_EMPTY_SOURCE";
    },
  );
});

test("ToursCloneService.cloneTour rejects workspace mismatch", async () => {
  const service = createToursCloneServiceForUnitTests(minimalCloneTourMocks());

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: "other-tenant" }),
    (error: unknown) => {
      if (!(error instanceof BadRequestException)) {
        return false;
      }
      const response = error.getResponse() as { error?: { code?: string } };
      return response.error?.code === "TOUR_CLONE_WORKSPACE_MISMATCH";
    },
  );
});

test("ToursCloneService.cloneTour rejects when workspace template is missing", async () => {
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      settingsRepository: {
        findTourWizardTemplateByWorkspace: async () => null,
      },
    }),
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test("ToursCloneService.cloneTour rejects orchestration failure", async () => {
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: false,
          errors: [{ path: "basicInfo.title", message: "required" }],
        }),
      },
    }),
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    (error: unknown) => {
      if (!(error instanceof BadRequestException)) {
        return false;
      }
      const response = error.getResponse() as { error?: { code?: string } };
      return response.error?.code === "TOUR_CLONE_ORCHESTRATION_FAILED";
    },
  );
});

test("ToursCloneService.cloneTour rejects orchestration failure with empty errors list when omitted", async () => {
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      templateOrchestrator: {
        listModernOverlayStoragePaths: () => listDenaliSettingsOverlayStoragePaths(),
        createDraftFromTemplate: async () => ({
          success: false,
        }),
      },
    }),
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    (error: unknown) => {
      if (!(error instanceof BadRequestException)) {
        return false;
      }
      const response = error.getResponse() as {
        error?: { code?: string; details?: { errors?: unknown[] } };
      };
      return (
        response.error?.code === "TOUR_CLONE_ORCHESTRATION_FAILED" &&
        Array.isArray(response.error?.details?.errors) &&
        response.error.details.errors.length === 0
      );
    },
  );
});

test("ToursCloneService.cloneTour requires authenticated user", async () => {
  const service = createToursCloneServiceForUnitTests({
    requestContext: {
      resolveEffectiveTenantId: () => TENANT_ID,
      getUserId: () => null,
    },
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test("ToursCloneService.cloneTour requires authenticated tenant context", async () => {
  const service = createToursCloneServiceForUnitTests({
    requestContext: {
      resolveEffectiveTenantId: () => null,
      getUserId: () => "user-1",
    },
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test("ToursCloneService.cloneTour invokes withSourceCloneLock exactly once per request", async () => {
  const mockLock = createMockCloneSourceLock();
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks(),
    lock: mockLock.lock,
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });

  assert.equal(mockLock.calls.length, 1);
  assert.equal(mockLock.calls[0]?.source, SOURCE_TOUR_ID);
  assert.equal(mockLock.calls[0]?.tenant, TENANT_ID);
});

test("ToursCloneService.cloneTour rejects concurrent clone while source lock is held", async () => {
  const mockLock = createMockCloneSourceLock();
  let releaseCreate: (() => void) | undefined;
  const createBlocked = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });

  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursService: {
        createTour: async () => {
          await createBlocked;
          return { id: "new-tour" };
        },
      },
    }),
    lock: mockLock.lock,
  });

  const firstClone = service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });
  await new Promise((resolve) => setTimeout(resolve, 20));

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    (error: unknown) => error instanceof TourCloneSourceLockedException,
  );

  releaseCreate?.();
  await firstClone;
  assert.equal(mockLock.calls.length, 2);
});

test("ToursCloneService.cloneTour invokes storage saga before create and releases in finally", async () => {
  const sagaCalls: string[] = [];
  let releaseOptions: { destinationTourId?: string } | undefined;
  let capturedAssignedTourId: string | undefined;

  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursService: {
        createTour: async (_dto: unknown, opts?: { assignedTourId?: string }) => {
          sagaCalls.push("create");
          capturedAssignedTourId = opts?.assignedTourId;
          return { id: capturedAssignedTourId ?? "new-tour" };
        },
      },
      pendingStorage: {
        executeCloneCopiesWithSaga: async () => {
          sagaCalls.push("saga");
        },
        releaseCloneOperation: async (_tenant, _op, options) => {
          sagaCalls.push("release");
          releaseOptions = options;
        },
      },
    }),
  });

  await service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID });

  assert.deepEqual(sagaCalls, ["saga", "create", "release"]);
  assert.equal(releaseOptions?.destinationTourId, capturedAssignedTourId);
});

test("ToursCloneService.cloneTour surfaces createTour failure when releaseCloneOperation throws in finally", async () => {
  let releaseErrorLogged = false;
  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursService: {
        createTour: async () => {
          throw new Error("CREATE_FAILED");
        },
      },
      pendingStorage: {
        executeCloneCopiesWithSaga: async () => undefined,
        releaseCloneOperation: async () => {
          throw new Error("RELEASE_FAILED");
        },
      },
    }),
    loggerService: {
      error: () => {
        releaseErrorLogged = true;
      },
    },
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    /CREATE_FAILED/,
  );
  assert.equal(releaseErrorLogged, true);
});

test("ToursCloneService.cloneTour releases pending rows in finally when createTour fails", async () => {
  const sagaCalls: string[] = [];
  let releaseOptions: { destinationTourId?: string } | undefined;

  const service = createToursCloneServiceForUnitTests({
    ...minimalCloneTourMocks({
      toursService: {
        createTour: async () => {
          sagaCalls.push("create");
          throw new Error("CREATE_FAILED");
        },
      },
      pendingStorage: {
        executeCloneCopiesWithSaga: async () => {
          sagaCalls.push("saga");
        },
        releaseCloneOperation: async (_tenant, _op, options) => {
          sagaCalls.push("release");
          releaseOptions = options;
        },
      },
    }),
  });

  await assert.rejects(
    () => service.cloneTour(SOURCE_TOUR_ID, { targetWorkspaceId: TENANT_ID }),
    /CREATE_FAILED/,
  );

  assert.deepEqual(sagaCalls, ["saga", "create", "release"]);
  assert.equal(releaseOptions?.destinationTourId, undefined);
});
