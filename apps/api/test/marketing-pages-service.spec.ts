import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MARKETING_PAGE_KEY_HOME_HERO } from "@app-tour/marketing-pages-http-contracts";

import {
  getMarketingPagesService,
  resetMarketingPagesServiceForTests,
} from "../src/workspace-marketing-pages/marketing-pages.service.ts";

describe("marketing-pages service", () => {
  it("exports service factory", () => {
    resetMarketingPagesServiceForTests();
    const service = getMarketingPagesService();
    assert.equal(typeof service.getOperatorPage, "function");
    assert.equal(MARKETING_PAGE_KEY_HOME_HERO, "home-hero");
  });
});
