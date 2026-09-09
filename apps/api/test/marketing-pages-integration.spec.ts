import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { MARKETING_PAGE_KEY_HOME_HERO } from "@app-tour/marketing-pages-http-contracts";

import { resetMarketingPagesRepositorySingletonForTests } from "../src/workspace-marketing-pages/create-marketing-pages-repository.ts";
import {
  getMarketingPagesService,
  resetMarketingPagesServiceForTests,
} from "../src/workspace-marketing-pages/marketing-pages.service.ts";

const DENALI_TENANT_ID = "00000000-0000-4000-8000-000000000003";

const samplePayload = {
  lead: "MKP integration lead",
  support: "MKP integration support",
  ctaPrimary: "MKP CTA",
};

function resetMarketingPagesState(): void {
  resetMarketingPagesServiceForTests();
  resetMarketingPagesRepositorySingletonForTests();
  process.env.STORAGE_DRIVER = "memory";
}

describe("marketing-pages service integration (memory)", () => {
  afterEach(() => {
    resetMarketingPagesState();
  });

  it("MKP-API-01 draft save and publish round-trip", async () => {
    resetMarketingPagesState();
    const service = getMarketingPagesService();

    const empty = await service.getOperatorPage(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "fa");
    assert.equal(empty.draft, null);
    assert.equal(empty.published, null);

    await service.saveDraft(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "fa", samplePayload);
    const drafted = await service.getOperatorPage(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "fa");
    assert.deepEqual(drafted.draft, samplePayload);
    assert.equal(drafted.published, null);

    await service.publish(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "fa");
    const published = await service.getOperatorPage(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "fa");
    assert.deepEqual(published.published, samplePayload);
    assert.notEqual(published.publishedAt, null);

    const publicView = await service.getPublishedPublicPage(
      DENALI_TENANT_ID,
      "denali",
      MARKETING_PAGE_KEY_HOME_HERO,
      "fa",
    );
    assert.notEqual(publicView, null);
    assert.deepEqual(publicView?.published, samplePayload);
  });

  it("MKP-API-02 locales are isolated", async () => {
    resetMarketingPagesState();
    const service = getMarketingPagesService();

    await service.saveDraft(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "fa", samplePayload);
    await service.saveDraft(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "en", {
      lead: "EN lead",
      support: "EN support",
      ctaPrimary: "EN CTA",
    });

    const faPage = await service.getOperatorPage(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "fa");
    const enPage = await service.getOperatorPage(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "en");
    assert.equal(faPage.draft?.lead, samplePayload.lead);
    assert.equal(enPage.draft?.lead, "EN lead");
  });

  it("MKP-API-03 publish without draft throws", async () => {
    resetMarketingPagesState();
    const service = getMarketingPagesService();
    await assert.rejects(
      () => service.publish(DENALI_TENANT_ID, MARKETING_PAGE_KEY_HOME_HERO, "fa"),
      /MARKETING_PAGE_DRAFT_REQUIRED/,
    );
  });

  it("MKP-API-04 unsupported workspace returns null public page", async () => {
    resetMarketingPagesState();
    const service = getMarketingPagesService();
    const page = await service.getPublishedPublicPage(
      DENALI_TENANT_ID,
      "starter",
      MARKETING_PAGE_KEY_HOME_HERO,
      "fa",
    );
    assert.equal(page, null);
  });
});
