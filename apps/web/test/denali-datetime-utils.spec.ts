import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  datetimeLocalInputToIso,
  isoToDatetimeLocalInput,
} from "@app-tour/workspace-denali/ui/logic/denali-datetime-utils";

describe("denali-datetime-utils.spec.ts", () => {
  it("WEB-DENALI-DT-01 round-trips ISO through datetime-local input", () => {
    const iso = "2026-06-15T10:30:00.000Z";
    const local = isoToDatetimeLocalInput(iso);
    assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const back = datetimeLocalInputToIso(local);
    assert.equal(Date.parse(back), Date.parse(iso));
  });
});
