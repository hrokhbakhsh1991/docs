import assert from "node:assert/strict";
import test from "node:test";

import { isParsableIsoDateTime, optionalInt } from "./denaliSchemaPrimitives";

test("optionalInt coerces empty input to undefined", () => {
  assert.equal(optionalInt().parse(""), undefined);
  assert.equal(optionalInt().parse(2), 2);
});

test("isParsableIsoDateTime validates ISO strings", () => {
  assert.equal(isParsableIsoDateTime("2026-01-15T10:00:00.000Z"), true);
  assert.equal(isParsableIsoDateTime(""), false);
});
