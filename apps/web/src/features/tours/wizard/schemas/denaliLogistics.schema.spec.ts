import assert from "node:assert/strict";
import test from "node:test";

import { denaliTransportSchema } from "./denaliLogistics.schema";

test("denaliTransportSchema accepts minimal transport payload", () => {
  const parsed = denaliTransportSchema.safeParse({
    transportMode: "organizer_vehicle",
  });
  assert.equal(parsed.success, true);
});
