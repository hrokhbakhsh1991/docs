import test from "node:test";
import assert from "node:assert/strict";

import { resolveEventKindFromTourContext } from "./tour-kind";

test("minimal / empty context returns generic and does not throw", () => {
  assert.equal(resolveEventKindFromTourContext({}), "generic");
});

test("unknown tourType and tripStyle fall back to generic", () => {
  assert.equal(
    resolveEventKindFromTourContext({
      tourType: "unknown_segment",
      tripStyle: "unknown_style",
    }),
    "generic",
  );
});

test("missing tourType and tripStyle (only nulls) returns generic", () => {
  assert.equal(
    resolveEventKindFromTourContext({
      tourType: null,
      tripStyle: null,
      eventKind: null,
    }),
    "generic",
  );
});

test("mountain from tourType", () => {
  assert.equal(resolveEventKindFromTourContext({ tourType: "mountain" }), "mountain");
});

test("mountain from mountaineering tripStyle", () => {
  assert.equal(resolveEventKindFromTourContext({ tripStyle: "mountaineering" }), "mountain");
});

test("mountain from tripStyle alias mountain", () => {
  assert.equal(resolveEventKindFromTourContext({ tripStyle: "mountain" }), "mountain");
});

test("tourType camp is resolved before tripStyle; camp stays generic even with mountaineering tripStyle", () => {
  assert.equal(
    resolveEventKindFromTourContext({ tourType: "camp", tripStyle: "mountaineering" }),
    "generic",
  );
});

test("mountain from tripStyle when tourType is not a short-circuit mapping", () => {
  assert.equal(
    resolveEventKindFromTourContext({ tourType: "", tripStyle: "mountaineering" }),
    "mountain",
  );
});

test("explicit eventKind cultural overrides tourType mountain", () => {
  assert.equal(
    resolveEventKindFromTourContext({ tourType: "mountain", eventKind: "cultural" }),
    "cultural",
  );
});

test("explicit eventKind workshop", () => {
  assert.equal(resolveEventKindFromTourContext({ eventKind: "workshop" }), "workshop");
});

test("explicit eventKind city_tour", () => {
  assert.equal(resolveEventKindFromTourContext({ eventKind: "city_tour" }), "city_tour");
});

test("explicit eventKind generic", () => {
  assert.equal(
    resolveEventKindFromTourContext({ tourType: "mountain", eventKind: "generic" }),
    "generic",
  );
});

test("city_tour from tourType city", () => {
  assert.equal(resolveEventKindFromTourContext({ tourType: "city" }), "city_tour");
});

test("city_tour from tripStyle city", () => {
  assert.equal(resolveEventKindFromTourContext({ tripStyle: "city" }), "city_tour");
});

test("cultural from tripStyle cultural", () => {
  assert.equal(resolveEventKindFromTourContext({ tripStyle: "cultural" }), "cultural");
});

test("legacy tourType camp maps to generic", () => {
  assert.equal(resolveEventKindFromTourContext({ tourType: "camp" }), "generic");
});

test("legacy tourType desert maps to generic", () => {
  assert.equal(resolveEventKindFromTourContext({ tourType: "desert" }), "generic");
});

test("legacy tourType other maps to generic", () => {
  assert.equal(resolveEventKindFromTourContext({ tourType: "other" }), "generic");
});

test("whitespace and casing are normalized for tourType", () => {
  assert.equal(resolveEventKindFromTourContext({ tourType: "  MOUNTAIN  " }), "mountain");
});

test("whitespace and casing are normalized for explicit eventKind", () => {
  assert.equal(resolveEventKindFromTourContext({ eventKind: "  Workshop  " }), "workshop");
});
