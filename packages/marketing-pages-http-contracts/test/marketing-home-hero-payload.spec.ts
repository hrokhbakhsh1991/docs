import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseMarketingHomeHeroPayload,
  parseMarketingPageLocale,
} from "../src/marketing-home-hero-payload";

describe("marketing-pages-http-contracts", () => {
  it("parses home hero payload", () => {
    const payload = parseMarketingHomeHeroPayload({
      lead: "سلام",
      support: "توضیح",
      ctaPrimary: "برو",
    });
    assert.equal(payload.lead, "سلام");
  });

  it("defaults locale to fa", () => {
    assert.equal(parseMarketingPageLocale(null), "fa");
    assert.equal(parseMarketingPageLocale("en"), "en");
  });
});
