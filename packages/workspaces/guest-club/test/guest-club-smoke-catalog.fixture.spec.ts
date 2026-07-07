import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGuestClubSmokeCatalogCard,
  GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID,
  GUEST_CLUB_SMOKE_PUBLISHED_TOUR_TITLE,
} from "../src/catalog/guest-club-smoke-catalog.fixture";

describe("guest-club smoke catalog fixture", () => {
  it("GC-SMK-01 exposes Event structuredData for marketing SEO smoke", () => {
    const card = buildGuestClubSmokeCatalogCard();
    assert.equal(card.id, GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID);
    assert.equal(card.title, GUEST_CLUB_SMOKE_PUBLISHED_TOUR_TITLE);
    assert.equal(card.structuredData?.["@type"], "Event");
    assert.equal(card.structuredData?.name, GUEST_CLUB_SMOKE_PUBLISHED_TOUR_TITLE);
  });
});
