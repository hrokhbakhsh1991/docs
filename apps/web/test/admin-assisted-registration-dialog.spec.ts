import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("admin-assisted registration dialog", () => {
  it("formats tour metadata and exposes an accessible registrant-mode state", () => {
    const source = readFileSync(
      join(webRoot, "src/features/bookings/admin-assisted-registration-dialog.tsx"),
      "utf8"
    );

    assert.match(source, /formatTourDeparture\(requirements\.departureAt, locale\)/);
    assert.match(source, /closeLabel=\{t\("actions\.cancel"\)\}/);
    assert.match(source, /aria-pressed=\{form\.registrantMode === mode\}/);
    assert.doesNotMatch(source, /requirements\.departureAt \?\? t\("unknownDeparture"\)/);
  });
});
