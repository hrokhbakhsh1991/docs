import test from "node:test";
import assert from "node:assert/strict";

import { resolveEventKindFromTourContext } from "./tour-kind";

test("minimal / empty context returns generic and does not throw", () => {
  assert.equal(resolveEventKindFromTourContext({}), "generic");
});

test("unknown tourType and legacy singular style input fall back to generic", () => {
  assert.equal(
    resolveEventKindFromTourContext({
      tourType: "unknown_segment",
      tripStyle: "unknown_style",
    }),
    "generic",
  );
});

test("missing tourType and legacy singular style (only nulls) returns generic", () => {
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

test("mountain from legacy singular mountaineering style", () => {
  assert.equal(resolveEventKindFromTourContext({ tripStyle: "mountaineering" }), "mountain");
});

test("mountain from legacy singular style alias mountain", () => {
  assert.equal(resolveEventKindFromTourContext({ tripStyle: "mountain" }), "mountain");
});

test("legacy tourType camp is resolved before legacy singular style; stays generic even with mountaineering", () => {
  assert.equal(
    resolveEventKindFromTourContext({ tourType: "camp", tripStyle: "mountaineering" }),
    "generic",
  );
});

test("tourType cultural maps to cultural", () => {
  assert.equal(resolveEventKindFromTourContext({ tourType: "cultural" }), "cultural");
});

test("tourType nature maps to generic", () => {
  assert.equal(resolveEventKindFromTourContext({ tourType: "nature" }), "generic");
});

test("modern execution-style slugs on legacy singular input do NOT change event kind", () => {
  for (const style of ["adventure", "relaxed", "luxury", "budget", "familyFriendly", "photography"]) {
    assert.equal(
      resolveEventKindFromTourContext({ tripStyle: style }),
      "generic",
      `legacySingularStyle=${style} should not influence event kind on its own`,
    );
  }
});

test("multi-select tripStyles[] is also orthogonal for new values", () => {
  assert.equal(
    resolveEventKindFromTourContext({
      tripStyles: ["adventure", "photography", "relaxed"],
    }),
    "generic",
  );
});

test("legacy values inside tripStyles[] still drive event kind for back-compat", () => {
  assert.equal(
    resolveEventKindFromTourContext({ tripStyles: ["mountaineering", "adventure"] }),
    "mountain",
  );
  assert.equal(
    resolveEventKindFromTourContext({ tripStyles: ["luxury", "city"] }),
    "city_tour",
  );
});

test("tourType still beats tripStyles[] when both are set", () => {
  assert.equal(
    resolveEventKindFromTourContext({
      tourType: "mountain",
      tripStyles: ["cultural", "city"],
    }),
    "mountain",
  );
});

test("tourType beats legacy singular style: cultural hint under mountain category stays mountain", () => {
  assert.equal(
    resolveEventKindFromTourContext({ tourType: "mountain", tripStyle: "cultural" }),
    "mountain",
  );
});

test("mountain from legacy singular style when tourType is not a short-circuit mapping", () => {
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

test("city_tour from legacy singular style city", () => {
  assert.equal(resolveEventKindFromTourContext({ tripStyle: "city" }), "city_tour");
});

test("cultural from legacy singular style cultural", () => {
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
