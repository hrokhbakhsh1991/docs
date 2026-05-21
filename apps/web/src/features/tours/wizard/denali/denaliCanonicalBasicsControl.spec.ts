import assert from "node:assert/strict";
import test from "node:test";

import { patchDenaliCanonicalBasics, readDenaliCanonicalBasics } from "./denaliCanonicalBasicsControl";

test("patchDenaliCanonicalBasics updates legacy slug from category + duration", () => {
  assert.equal(
    patchDenaliCanonicalBasics("mountain_day", { duration: "multi_day" }),
    "mountain_multi",
  );
  assert.equal(
    patchDenaliCanonicalBasics(undefined, { category: "event", eventVariant: "cinema" }),
    "event_cinema",
  );
});

test("readDenaliCanonicalBasics parses slug", () => {
  assert.deepEqual(readDenaliCanonicalBasics("nature_day"), {
    category: "nature",
    duration: "single_day",
  });
});
