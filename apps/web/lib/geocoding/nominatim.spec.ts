import assert from "node:assert/strict";
import test from "node:test";

import { parseNominatimRows } from "./nominatim";

test("parseNominatimRows normalizes display name and coordinates", () => {
  const rows = parseNominatimRows([
    { display_name: "Tehran, Iran", lat: "35.6892", lon: "51.3890" },
    { display_name: "", lat: "1", lon: "2" },
    { lat: "bad", lon: "51" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.addressText, "Tehran, Iran");
  assert.equal(rows[0]?.latitude, 35.6892);
  assert.equal(rows[0]?.longitude, 51.389);
});
