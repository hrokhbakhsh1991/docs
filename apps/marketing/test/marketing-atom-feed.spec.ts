import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMarketingAtomFeed } from "../src/seo/build-marketing-atom-feed";

describe("buildMarketingAtomFeed", () => {
  it("MKT-40 emits Atom feed with tour entry links", () => {
    const xml = buildMarketingAtomFeed({
      host: "operator.localhost:3002",
      siteName: "Operator Smoke",
      tours: [
        {
          tourId: "00000000-0000-4000-8000-000000000210",
          catalogUpdatedAt: "2026-07-01T08:00:00.000Z",
          coverImageUrl: null,
        },
      ],
    });

    assert.match(xml, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
    assert.match(xml, /<entry>/);
    assert.match(xml, /\/tours\/00000000-0000-4000-8000-000000000210/);
    assert.match(xml, /<updated>2026-07-01T08:00:00\.000Z<\/updated>/);
  });
});
