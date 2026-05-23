import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";

import {
  PRESET_DEFAULTS_ROOT_KEYS,
  parsePresetDefaultsOrThrow,
} from "./tour-preset-defaults.schema";

function expectBadRequest(fn: () => unknown): BadRequestException {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof BadRequestException, `expected BadRequestException, got ${err}`);
    return err as BadRequestException;
  }
  assert.fail("expected BadRequestException to be thrown");
}

function envelopeOf(exc: BadRequestException): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  const body = exc.getResponse() as { error?: { code: string; message: string; details?: Record<string, unknown> } };
  assert.ok(body.error, "expected `error` envelope");
  return body.error!;
}

test("accepts empty defaults", () => {
  const out = parsePresetDefaultsOrThrow({});
  assert.deepEqual(out, {});
});

test("accepts a healthy preset with multiple known root sections (positive case requested in prompt)", () => {
  const healthy = {
    autoAcceptRegistrations: true,
    overview: { shortDescription: "preset short", mainTourThemeId: "abc-uuid" },
    pricing: { basePrice: 1_500_000 },
    location: { regionId: "region-uuid" },
    itinerary: { days: [{ dayNumber: 1, title: "روز اول" }] },
    participation: { minimumAge: 18 },
    logistics: { primaryTransportMode: "bus" },
    policies: { cancellationPolicy: "تا ۷ روز قبل" },
  };
  const out = parsePresetDefaultsOrThrow(healthy);
  assert.equal(out.autoAcceptRegistrations, true);
  assert.deepEqual(out.overview, healthy.overview);
  assert.deepEqual(out.pricing, healthy.pricing);
  assert.deepEqual(out.itinerary, healthy.itinerary);
});

test("rejects a preset where a known root has the wrong type (overview: string, negative case requested in prompt)", () => {
  const broken = { overview: "foo" };
  const exc = expectBadRequest(() => parsePresetDefaultsOrThrow(broken as Record<string, unknown>));
  const err = envelopeOf(exc);
  assert.equal(err.code, "PRESET_DEFAULTS_INVALID_TYPE");
  assert.match(err.message, /preset\.defaults\.overview must be an object/);
  assert.deepEqual(err.details?.path, ["overview"]);
});

test("rejects array at a known root key", () => {
  const broken = { itinerary: [{ day: 1 }] };
  const exc = expectBadRequest(() => parsePresetDefaultsOrThrow(broken as Record<string, unknown>));
  const err = envelopeOf(exc);
  assert.equal(err.code, "PRESET_DEFAULTS_INVALID_TYPE");
  assert.match(err.message, /preset\.defaults\.itinerary must be an object/);
});

test("rejects non-boolean autoAcceptRegistrations", () => {
  const broken = { autoAcceptRegistrations: "yes" };
  const exc = expectBadRequest(() => parsePresetDefaultsOrThrow(broken as Record<string, unknown>));
  const err = envelopeOf(exc);
  assert.equal(err.code, "PRESET_DEFAULTS_INVALID_TYPE");
  assert.match(err.message, /preset\.defaults\.autoAcceptRegistrations must be boolean/);
});

test("rejects unknown root key with PRESET_DEFAULTS_UNKNOWN_ROOT", () => {
  const broken = { overview: { foo: 1 }, customRoot: { bar: 2 } };
  const exc = expectBadRequest(() => parsePresetDefaultsOrThrow(broken as Record<string, unknown>));
  const err = envelopeOf(exc);
  assert.equal(err.code, "PRESET_DEFAULTS_UNKNOWN_ROOT");
  assert.match(err.message, /unknown root keys: customRoot/);
  assert.deepEqual(err.details?.unknownKeys, ["customRoot"]);
  assert.deepEqual(err.details?.allowedKeys, [...PRESET_DEFAULTS_ROOT_KEYS]);
});

test("prefers UNKNOWN_ROOT over INVALID_TYPE when both are present (clearer signal first)", () => {
  const broken = { overview: "foo", customRoot: { bar: 2 } };
  const exc = expectBadRequest(() => parsePresetDefaultsOrThrow(broken as Record<string, unknown>));
  const err = envelopeOf(exc);
  assert.equal(err.code, "PRESET_DEFAULTS_UNKNOWN_ROOT");
});

test("passthrough inside known sections: nested unknown keys do NOT trigger errors (kept loose for wizard evolution)", () => {
  const out = parsePresetDefaultsOrThrow({
    overview: { someFutureWizardField: "x", title: "Y" },
    logistics: { newKnobInWizard: { nested: true } },
  });
  assert.equal((out as any).overview?.someFutureWizardField, "x");
  assert.equal((out as any).overview?.title, "Y");
});

test("PRESET_DEFAULTS_ROOT_KEYS includes the nine wizard-known roots and stays in sync with mapper", () => {
  assert.deepEqual([...PRESET_DEFAULTS_ROOT_KEYS], [
    "autoAcceptRegistrations",
    "overview",
    "pricing",
    "schedule",
    "location",
    "itinerary",
    "participation",
    "logistics",
    "policies",
  ]);
});

test("denali_pilot: accepts 6-tab preset defaults", () => {
  const healthy = {
    basicInfo: { tourType: "nature_day", title: "تور نمونه" },
    programNature: { mainTourThemeId: "uuid", shortDescription: "طبیعت" },
    transport: { primaryTransportMode: "bus" },
    pricingPayment: { requiresPayment: true },
    participantRequirements: { minimumAge: 16 },
    policies: { cancellationPolicy: "قانون" },
  };
  const out = parsePresetDefaultsOrThrow(healthy, { formProfile: "denali_pilot" });
  assert.deepEqual((out as any).basicInfo, healthy.basicInfo);
});

test("denali_pilot: strips unknown keys instead of rejecting", () => {
  const input = {
    basicInfo: { tourType: "nature_day" },
    legacyRoot: { someValue: 123 }, // Should be stripped
    anotherUnknownField: "foo", // Should be stripped
  };
  const out = parsePresetDefaultsOrThrow(input, { formProfile: "denali_pilot" });
  assert.deepEqual(out, { basicInfo: { tourType: "nature_day" } });
  assert.ok(!("legacyRoot" in out));
  assert.ok(!("anotherUnknownField" in out));
});

test("denali_pilot: strips legacy overview root (denali schema uses .strip())", () => {
  const broken = { overview: { shortDescription: "x" } };
  const out = parsePresetDefaultsOrThrow(broken, { formProfile: "denali_pilot" });
  assert.deepEqual(out, {});
  assert.ok(!("overview" in out));
});
