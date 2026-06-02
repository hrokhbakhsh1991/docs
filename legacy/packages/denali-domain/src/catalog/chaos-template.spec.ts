/**
 * Mutation-resistant chaos suite for {@link resolveStoredTemplateCanonical}.
 * Any mutation that yields `{ ok: true }` is treated as FATAL.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resolveStoredTemplateCanonical } from "@repo/types/denali";

import { denaliTemplateOrchestratorFactory } from "../rules/factory/DenaliTemplateOrchestratorFactory";

const VALID_THEME_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VALID_DESTINATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VALID_LEADER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VALID_GEAR_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const VALID_PHOTO_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const CHAOS_GHOST_KEY = "__chaosGhost";

const BASELINE = {
  category: "mountain" as const,
  duration: "single" as const,
  title: "Chaos baseline tour",
  destinationId: VALID_DESTINATION_ID,
  program: {
    shortDescription: "Short",
    themeIds: [VALID_THEME_ID],
    difficultyLevel: 3,
    hikingHoursApprox: 4,
    itinerary: [
      {
        day: 1,
        activities: "Summit push",
        locationText: "Base camp",
        location: { addressText: "Trail head" },
      },
    ],
  },
  transport: {
    mode: "bus" as const,
    transportCost: 120,
    allowPersonalCar: false,
  },
  pricing: {
    requiresPayment: true,
    basePricePerPerson: 500,
  },
  participants: {
    minimumAge: 18,
    gearItems: [{ id: VALID_GEAR_ID, isRequired: true }],
  },
  policies: {
    policiesText: "Standard policy",
    cancellationDeadlineHours: 48,
  },
  overview: { peakHeight: 4100 },
  metrics: { elevationGain: 900 },
  gatheringPoints: [
    {
      title: "Main gate",
      location: { addressText: "Gate A" },
    },
  ],
  startPoint: { addressText: "Start" },
  photos: [
    {
      id: VALID_PHOTO_ID,
      url: "https://example.com/photo.jpg",
      filename: "photo.jpg",
      size: 1024,
      mimeType: "image/jpeg",
      uploadedAt: "2026-01-15T10:00:00.000Z",
    },
  ],
  leaderUserIds: [VALID_LEADER_ID],
};

type ChaosMutation = {
  id: string;
  category: "top_level_fossil" | "nested_fossil" | "bad_uuid" | "type_swap";
  canonicalData: unknown;
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Inject a rogue key on every plain-object node (including array elements). */
function injectNestedGhostKeys(value: unknown, ghostKey = CHAOS_GHOST_KEY): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => injectNestedGhostKeys(entry, ghostKey));
  }
  if (value == null || typeof value !== "object") {
    return value;
  }
  const objectValue = value as Record<string, unknown>;
  const injected: Record<string, unknown> = { [ghostKey]: true };
  for (const [key, nested] of Object.entries(objectValue)) {
    injected[key] = injectNestedGhostKeys(nested, ghostKey);
  }
  return injected;
}

function buildMutations(): ChaosMutation[] {
  const mutations: ChaosMutation[] = [
    {
      id: "root.tripDetails",
      category: "top_level_fossil",
      canonicalData: { ...deepClone(BASELINE), tripDetails: { rogue: true } },
    },
    {
      id: "root.basicInfo",
      category: "top_level_fossil",
      canonicalData: { ...deepClone(BASELINE), basicInfo: { title: "ghost" } },
    },
    {
      id: "root.eventVariant",
      category: "top_level_fossil",
      canonicalData: { ...deepClone(BASELINE), eventVariant: "cinema" },
    },
    {
      id: "root.defaults",
      category: "top_level_fossil",
      canonicalData: { ...deepClone(BASELINE), defaults: { overview: {} } },
    },
    {
      id: "overview.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        overview: { peakHeight: 4100, [CHAOS_GHOST_KEY]: true },
      },
    },
    {
      id: "program.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        program: { ...BASELINE.program, [CHAOS_GHOST_KEY]: true },
      },
    },
    {
      id: "program.itinerary.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        program: {
          ...BASELINE.program,
          itinerary: [{ ...BASELINE.program.itinerary[0]!, [CHAOS_GHOST_KEY]: true }],
        },
      },
    },
    {
      id: "transport.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        transport: { ...BASELINE.transport, [CHAOS_GHOST_KEY]: true },
      },
    },
    {
      id: "pricing.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        pricing: { ...BASELINE.pricing, [CHAOS_GHOST_KEY]: true },
      },
    },
    {
      id: "participants.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        participants: { ...BASELINE.participants, [CHAOS_GHOST_KEY]: true },
      },
    },
    {
      id: "policies.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        policies: { ...BASELINE.policies, [CHAOS_GHOST_KEY]: true },
      },
    },
    {
      id: "metrics.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        metrics: { ...BASELINE.metrics, [CHAOS_GHOST_KEY]: true },
      },
    },
    {
      id: "gatheringPoints.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        gatheringPoints: [{ ...BASELINE.gatheringPoints[0]!, [CHAOS_GHOST_KEY]: true }],
      },
    },
    {
      id: "startPoint.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        startPoint: { ...BASELINE.startPoint, [CHAOS_GHOST_KEY]: true },
      },
    },
    {
      id: "photos.nestedGhost",
      category: "nested_fossil",
      canonicalData: {
        ...deepClone(BASELINE),
        photos: [{ ...BASELINE.photos[0]!, [CHAOS_GHOST_KEY]: true }],
      },
    },
    {
      id: "deep.tree.nestedGhostEverywhere",
      category: "nested_fossil",
      canonicalData: injectNestedGhostKeys(deepClone(BASELINE)),
    },
    {
      id: "destinationId.nonV4",
      category: "bad_uuid",
      canonicalData: { ...deepClone(BASELINE), destinationId: "00000000-0000-0000-0000-000000000000" },
    },
    {
      id: "leaderUserIds.nonV4",
      category: "bad_uuid",
      canonicalData: { ...deepClone(BASELINE), leaderUserIds: ["not-a-v4-uuid"] },
    },
    {
      id: "program.themeIds.nonV4",
      category: "bad_uuid",
      canonicalData: {
        ...deepClone(BASELINE),
        program: { ...BASELINE.program, themeIds: ["12345678-1234-1234-1234-123456789012"] },
      },
    },
    {
      id: "participants.gearItems.nonV4",
      category: "bad_uuid",
      canonicalData: {
        ...deepClone(BASELINE),
        participants: {
          ...BASELINE.participants,
          gearItems: [{ id: "legacy-gear-id", isRequired: true }],
        },
      },
    },
    {
      id: "photos.id.nonV4",
      category: "bad_uuid",
      canonicalData: {
        ...deepClone(BASELINE),
        photos: [{ ...BASELINE.photos[0]!, id: "photo-not-v4" }],
      },
    },
    {
      id: "title.typeSwap.number",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), title: 12_345 },
    },
    {
      id: "overview.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), overview: "not-an-object" },
    },
    {
      id: "program.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), program: "not-an-object" },
    },
    {
      id: "transport.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), transport: "not-an-object" },
    },
    {
      id: "pricing.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), pricing: "not-an-object" },
    },
    {
      id: "participants.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), participants: "not-an-object" },
    },
    {
      id: "policies.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), policies: "not-an-object" },
    },
    {
      id: "gatheringPoints.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), gatheringPoints: "not-an-array" },
    },
    {
      id: "photos.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), photos: "not-an-array" },
    },
    {
      id: "capacityMax.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), capacityMax: "ten" },
    },
    {
      id: "requiresLocalGuide.typeSwap.string",
      category: "type_swap",
      canonicalData: { ...deepClone(BASELINE), requiresLocalGuide: "yes" },
    },
    {
      id: "program.itinerary.typeSwap.string",
      category: "type_swap",
      canonicalData: {
        ...deepClone(BASELINE),
        program: { ...BASELINE.program, itinerary: "not-an-array" },
      },
    },
    {
      id: "program.itinerary.activities.typeSwap.number",
      category: "type_swap",
      canonicalData: {
        ...deepClone(BASELINE),
        program: {
          ...BASELINE.program,
          itinerary: [{ ...BASELINE.program.itinerary[0]!, activities: 42 }],
        },
      },
    },
    {
      id: "root.typeSwap.string",
      category: "type_swap",
      canonicalData: "not-an-object",
    },
    {
      id: "root.typeSwap.null",
      category: "type_swap",
      canonicalData: null,
    },
  ];

  return mutations;
}

const CHAOS_MUTATIONS = buildMutations();

type ChaosRunReport = {
  total: number;
  fatalPasses: string[];
  resolverRejected: number;
  orchestratorEscapes: string[];
};

async function runChaosSuite(): Promise<ChaosRunReport> {
  const fatalPasses: string[] = [];
  const orchestratorEscapes: string[] = [];

  for (const mutation of CHAOS_MUTATIONS) {
    const resolved = resolveStoredTemplateCanonical({ canonicalData: mutation.canonicalData });

    if (resolved.ok) {
      fatalPasses.push(mutation.id);
      continue;
    }

    const orchestration = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
      workspaceId: "ws-chaos",
      templateId: "tpl-chaos",
      canonicalData: mutation.canonicalData as Record<string, unknown>,
      fieldRulesOverlay: {},
    });

    if (orchestration.success) {
      orchestratorEscapes.push(mutation.id);
    }
  }

  return {
    total: CHAOS_MUTATIONS.length,
    fatalPasses,
    resolverRejected: CHAOS_MUTATIONS.length - fatalPasses.length,
    orchestratorEscapes,
  };
}

test("chaos: baseline canonical is accepted by resolveStoredTemplateCanonical", () => {
  const resolved = resolveStoredTemplateCanonical({ canonicalData: deepClone(BASELINE) });
  assert.equal(resolved.ok, true);
});

test("chaos: zero mutation traps yield resolveStoredTemplateCanonical ok:true (FATAL)", async () => {
  const report = await runChaosSuite();

  assert.equal(
    report.fatalPasses.length,
    0,
    `FATAL ok:true on mutations: ${report.fatalPasses.join(", ") || "(none)"}`,
  );
});

test("chaos: orchestrator cannot proceed when resolver rejects (no escape path)", async () => {
  const report = await runChaosSuite();

  assert.equal(
    report.orchestratorEscapes.length,
    0,
    `Orchestrator escape paths: ${report.orchestratorEscapes.join(", ") || "(none)"}`,
  );
});

test("chaos: report mutation-trap coverage counts", async () => {
  const report = await runChaosSuite();

  assert.equal(report.total, CHAOS_MUTATIONS.length);
  assert.equal(report.resolverRejected, CHAOS_MUTATIONS.length);
  assert.equal(report.fatalPasses.length, 0);
  assert.equal(report.orchestratorEscapes.length, 0);
});
