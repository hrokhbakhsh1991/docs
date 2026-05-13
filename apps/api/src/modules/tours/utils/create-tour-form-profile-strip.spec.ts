import assert from "node:assert/strict";
import test from "node:test";
import type { Repository } from "typeorm";

import { TOUR_FORM_PROFILE_DESCRIPTORS, URBAN_LOGISTICS_WHITELIST_KEYS } from "@repo/types";

import type { CreateTourDto } from "../dto/create-tour.dto";
import { WorkspaceTourThemeEntity } from "../../settings-locations/entities/workspace-tour-theme.entity";

import {
  URBAN_LOGISTICS_WHITELIST,
  resolveTourFormProfileForCreateDto,
  resolveTourFormProfileForCreateDtoWithSource,
  resolveTourFormProfileFromTripDetails,
  stripCreateTourDtoForFormProfile,
  stripTripDetailsForFormProfile,
} from "./create-tour-form-profile-strip";
import { assertTripDetailsForFormProfile } from "./assert-create-tour-invariants";

function sampleDto(overrides?: Partial<CreateTourDto>): CreateTourDto {
  return {
    title: "1234567890 minimum tour title",
    total_capacity: 10,
    tourType: "mountain",
    tripDetails: {
      overview: { tourThemeIds: ["theme-main-uuid"] },
      itinerary: {
        dayPlans: [{ day: 1, title: "ghost day" }],
        highlights: ["keep-me"],
      },
      participation: { minimumAge: 12, requirements: "ghost" },
      logistics: {
        departureDate: "2026-06-01",
        returnDate: "2026-06-02",
        meetingPoint: "Gate A",
        primaryTransportMode: "bus",
        groupSizeMax: 20,
        fuelShareToman: 5000,
      },
    },
    transportModes: ["bus"],
    ...overrides,
  } as CreateTourDto;
}

test("stripCreateTourDtoForFormProfile: general does not mutate dto", () => {
  const dto = sampleDto();
  stripCreateTourDtoForFormProfile("general", dto);
  assert.ok(dto.tripDetails?.participation);
  assert.ok(dto.tripDetails?.itinerary?.dayPlans);
});

test("stripCreateTourDtoForFormProfile: cinema_event removes participation and structured itinerary", () => {
  const dto = sampleDto();
  stripCreateTourDtoForFormProfile("cinema_event", dto);
  assert.equal(dto.tripDetails?.participation, undefined);
  assert.equal(dto.tripDetails?.itinerary?.dayPlans, undefined);
  assert.deepEqual(dto.tripDetails?.itinerary?.highlights, ["keep-me"]);
  assert.equal(dto.tripDetails?.logistics?.primaryTransportMode, "bus");
  assert.deepEqual(dto.transportModes, ["bus"]);
});

test("stripCreateTourDtoForFormProfile: urban_event slims logistics and clears transportModes", () => {
  const dto = sampleDto();
  stripCreateTourDtoForFormProfile("urban_event", dto);
  assert.equal(dto.transportModes, undefined);
  assert.equal(dto.tripDetails?.participation, undefined);
  assert.equal(dto.tripDetails?.itinerary?.dayPlans, undefined);
  const log = dto.tripDetails?.logistics as Record<string, unknown> | undefined;
  assert.deepEqual(Object.keys(log ?? {}).sort(), ["departureDate", "meetingPoint", "returnDate"]);
  assert.equal(log?.departureDate, "2026-06-01");
  assert.equal(log?.primaryTransportMode, undefined);
  assert.equal(log?.groupSizeMax, undefined);
  assert.equal(log?.fuelShareToman, undefined);
});

test("stripTripDetailsForFormProfile mutates tripDetails object (urban logistics slim)", () => {
  const td = {
    overview: { tourThemeIds: ["x"] },
    participation: { minimumAge: 5 },
    itinerary: { dayPlans: [{ day: 1 }], highlights: ["h"] },
    logistics: { departureDate: "2026-01-01", primaryTransportMode: "bus", groupSizeMax: 9 },
  };
  stripTripDetailsForFormProfile("urban_event", td);
  assert.equal(td.participation, undefined);
  assert.equal((td.logistics as Record<string, unknown>).primaryTransportMode, undefined);
  assert.equal((td.logistics as Record<string, unknown>).departureDate, "2026-01-01");
});

test("stripCreateTourDtoForFormProfile: urban_event satisfies assertTripDetailsForFormProfile", () => {
  const dto = sampleDto();
  stripCreateTourDtoForFormProfile("urban_event", dto);
  assert.doesNotThrow(() =>
    assertTripDetailsForFormProfile("urban_event", dto.tripDetails as never, dto.transportModes ?? undefined),
  );
});

test("stripCreateTourDtoForFormProfile: cinema_event satisfies assertTripDetailsForFormProfile", () => {
  const dto = sampleDto();
  stripCreateTourDtoForFormProfile("cinema_event", dto);
  assert.doesNotThrow(() =>
    assertTripDetailsForFormProfile("cinema_event", dto.tripDetails as never, dto.transportModes ?? undefined),
  );
});

test("resolveTourFormProfileFromTripDetails: explicit formProfile overrides theme row", async () => {
  const repo = {
    async findOne() {
      return { formProfile: "cinema_event" as const };
    },
  } as unknown as Repository<WorkspaceTourThemeEntity>;
  const dto = sampleDto();
  const p = await resolveTourFormProfileFromTripDetails(
    "tenant-1",
    dto.tripDetails as never,
    dto.tourType,
    repo,
    "mountain_outdoor",
  );
  assert.equal(p, "mountain_outdoor");
});

test("resolveTourFormProfileFromTripDetails uses theme row when present", async () => {
  const repo = {
    async findOne() {
      return { formProfile: "cinema_event" as const };
    },
  } as unknown as Repository<WorkspaceTourThemeEntity>;
  const dto = sampleDto();
  const p = await resolveTourFormProfileFromTripDetails(
    "tenant-1",
    dto.tripDetails as never,
    dto.tourType,
    repo,
  );
  assert.equal(p, "cinema_event");
});

test("resolveTourFormProfileForCreateDtoWithSource: explicit wins over theme row", async () => {
  const repo = {
    async findOne() {
      return { formProfile: "cinema_event" as const };
    },
  } as unknown as Repository<WorkspaceTourThemeEntity>;
  const dto = sampleDto({ formProfile: "urban_event" } as Partial<CreateTourDto>);
  const r = await resolveTourFormProfileForCreateDtoWithSource("tenant-1", dto, repo);
  assert.equal(r.profile, "urban_event");
  assert.equal(r.source, "explicit_client");
});

test("resolveTourFormProfileForCreateDtoWithSource: theme row when no explicit", async () => {
  const repo = {
    async findOne() {
      return { formProfile: "cinema_event" as const };
    },
  } as unknown as Repository<WorkspaceTourThemeEntity>;
  const dto = sampleDto();
  const r = await resolveTourFormProfileForCreateDtoWithSource("tenant-1", dto, repo);
  assert.equal(r.profile, "cinema_event");
  assert.equal(r.source, "workspace_theme");
});

test("resolveTourFormProfileForCreateDtoWithSource: tour_type when theme id missing", async () => {
  const repo = {
    async findOne() {
      return null;
    },
  } as unknown as Repository<WorkspaceTourThemeEntity>;
  const dto = sampleDto({ tripDetails: { overview: { tourThemeIds: [] } } } as Partial<CreateTourDto>);
  const r = await resolveTourFormProfileForCreateDtoWithSource("tenant-1", dto, repo);
  assert.equal(r.profile, "mountain_outdoor");
  assert.equal(r.source, "tour_type_default");
});

test("resolveTourFormProfileForCreateDto: falls back to tourType when theme missing", async () => {
  const repo = {
    async findOne() {
      return null;
    },
  } as unknown as Repository<WorkspaceTourThemeEntity>;
  const dto = sampleDto({ tripDetails: { overview: { tourThemeIds: [] } } } as Partial<CreateTourDto>);
  const p = await resolveTourFormProfileForCreateDto("tenant-1", dto, repo);
  assert.equal(p, "mountain_outdoor");
});

test("resolveTourFormProfileForCreateDto: general when no themes and no tourType", async () => {
  const repo = {
    async findOne() {
      return null;
    },
  } as unknown as Repository<WorkspaceTourThemeEntity>;
  const dto = sampleDto({ tourType: undefined, tripDetails: { overview: {} } } as Partial<CreateTourDto>);
  const p = await resolveTourFormProfileForCreateDto("tenant-1", dto, repo);
  assert.equal(p, "general");
});

/* ---------------------------------------------------------------------------------------------
 * Invariant I-7: the api-side `URBAN_LOGISTICS_WHITELIST` is a `Set` over the canonical
 * `URBAN_LOGISTICS_WHITELIST_KEYS` exported from `@repo/types`. If a future commit reintroduces
 * a hardcoded local copy, this test fails immediately.
 * ------------------------------------------------------------------------------------------- */
test("I-7: URBAN_LOGISTICS_WHITELIST is exactly URBAN_LOGISTICS_WHITELIST_KEYS (no client/server drift)", () => {
  assert.equal(URBAN_LOGISTICS_WHITELIST.size, URBAN_LOGISTICS_WHITELIST_KEYS.length);
  for (const key of URBAN_LOGISTICS_WHITELIST_KEYS) {
    assert.ok(URBAN_LOGISTICS_WHITELIST.has(key), `whitelist is missing canonical key "${key}"`);
  }
});

/* ---------------------------------------------------------------------------------------------
 * Phase P10 (promptq.md) — descriptor-driven strip parity probe.
 *
 * These tests pin `stripTripDetailsForFormProfile` / `stripCreateTourDtoForFormProfile` to the
 * declarative descriptor: every profile-specific branch removed during P10 must now match the
 * descriptor row exactly. Catches future drift where someone adds a new descriptor field but
 * forgets to read it from the strip function (or vice versa).
 * ------------------------------------------------------------------------------------------- */
test("P10: descriptor strip.logisticsWhitelist drives urban_event survivors", () => {
  const fromDescriptor = TOUR_FORM_PROFILE_DESCRIPTORS.urban_event.strip.logisticsWhitelist;
  assert.ok(fromDescriptor, "urban_event must declare logisticsWhitelist");
  assert.deepEqual([...fromDescriptor!].sort(), [...URBAN_LOGISTICS_WHITELIST_KEYS].sort());

  const td: Record<string, unknown> = {
    overview: { tourThemeIds: ["t-1"] },
    logistics: Object.fromEntries(fromDescriptor!.map((k) => [k, `v:${k}`])),
  };
  td.logistics = {
    ...(td.logistics as Record<string, unknown>),
    primaryTransportMode: "bus",
    fuelShareToman: 5000,
  };
  stripTripDetailsForFormProfile("urban_event", td as never);
  const survivors = Object.keys(td.logistics as Record<string, unknown>).sort();
  assert.deepEqual(survivors, [...fromDescriptor!].sort());
});

test("P10: descriptor strip.clearsTripDetailsRoots drives cinema_event participation drop", () => {
  const fromDescriptor = TOUR_FORM_PROFILE_DESCRIPTORS.cinema_event.strip.clearsTripDetailsRoots;
  assert.ok(fromDescriptor.includes("participation"), "cinema_event must clear participation per descriptor");
  const td: Record<string, unknown> = {
    overview: { tourThemeIds: ["t-1"] },
    participation: { minimumAge: 12 },
    itinerary: { dayPlans: [{ day: 1 }], highlights: ["h"] },
  };
  stripTripDetailsForFormProfile("cinema_event", td as never);
  assert.equal(td.participation, undefined);
});

test("P10: descriptor strip with empty deltas is a no-op (general / mountain_outdoor / nature_trip / cultural_tour)", () => {
  for (const slug of ["general", "mountain_outdoor", "nature_trip", "cultural_tour"] as const) {
    const td: Record<string, unknown> = {
      overview: { tourThemeIds: ["t-1"] },
      participation: { minimumAge: 12 },
      itinerary: { dayPlans: [{ day: 1 }] },
      logistics: { primaryTransportMode: "bus", fuelShareToman: 5000 },
    };
    const snapshot = JSON.stringify(td);
    stripTripDetailsForFormProfile(slug, td as never);
    assert.equal(JSON.stringify(td), snapshot, `${slug}: strip must be a no-op`);
  }
});

test("I-7: stripTripDetailsForFormProfile retains exactly the canonical whitelist keys for urban_event", () => {
  const td: Record<string, unknown> = {
    overview: { tourThemeIds: ["t-1"] },
    logistics: {
      departureDate: "2026-06-01",
      departureMeetingTime: "08:00",
      meetingPoint: "Gate",
      returnDate: "2026-06-02",
      returnPoint: "Bus stop",
      primaryTransportMode: "bus",
      groupSizeMin: 1,
      groupSizeMax: 10,
      fuelShareToman: 5000,
      accommodationDetails: "ghost",
    },
  };
  stripTripDetailsForFormProfile("urban_event", td as never);
  const survivingKeys = Object.keys(td.logistics as Record<string, unknown>).sort();
  assert.deepEqual(survivingKeys, [...URBAN_LOGISTICS_WHITELIST_KEYS].sort());
});
