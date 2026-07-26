import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliFlatEditMetaLine } from "../src/ui/chrome/build-denali-flat-edit-meta-line.ts";
import { mapDenaliFlatEditTourHttpStatus } from "../src/ui/chrome/map-denali-flat-edit-tour-http-status.ts";

describe("mapDenaliFlatEditTourHttpStatus", () => {
  it("maps 404 to not-found", () => {
    assert.deepEqual(mapDenaliFlatEditTourHttpStatus(404), {
      ok: false,
      kind: "not-found",
      code: "TOUR_NOT_FOUND",
    });
  });

  it("maps other non-2xx to typed HTTP error", () => {
    assert.deepEqual(mapDenaliFlatEditTourHttpStatus(503), {
      ok: false,
      kind: "error",
      code: "TOUR_EDIT_HTTP_503",
    });
  });

  it("returns null for success statuses", () => {
    assert.equal(mapDenaliFlatEditTourHttpStatus(200), null);
  });
});

describe("buildDenaliFlatEditMetaLine", () => {
  it("joins non-empty parts with middle dot", () => {
    assert.equal(buildDenaliFlatEditMetaLine(["Fri", null, "12 seats", ""]), "Fri · 12 seats");
  });

  it("returns null when nothing remains", () => {
    assert.equal(buildDenaliFlatEditMetaLine([null, "", undefined]), null);
  });
});
