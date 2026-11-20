import { renderSessionUi } from "./fixtures/render-session-ui";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { createTranslator } from "next-intl";

import catalog from "../messages/fa/catalog.json";
import { CatalogTourDetailBookingRailContent } from "../src/catalog/catalog-tour-detail-booking-rail";
import type { MarketingCatalogCard } from "../src/catalog/catalog-types";
import { resolveCatalogTourRegistrationState } from "../src/catalog/resolve-catalog-tour-registration-state";
import { resolveMarketingTourDetailCtaModel } from "../src/catalog/resolve-marketing-tour-detail-cta";

const tour: MarketingCatalogCard = {
  id: "tour-1",
  title: "مسیر خط‌الرأس",
  shortDescription: null,
  category: "mountain_single_day",
  departureAt: null,
  endAt: null,
  priceAmount: null,
  priceCurrency: null,
  coverImageUrl: null,
  totalCapacity: 12,
  spotsRemaining: 11,
  difficultyLevel: null,
  fitnessLevel: null,
};

const t = createTranslator({
  locale: "fa",
  messages: { catalog },
  namespace: "catalog",
});
const registrationUrl = "https://portal.example.test/register/tour-1";

function renderRail(item: MarketingCatalogCard, pluginId = "denali"): string {
  const registration = resolveCatalogTourRegistrationState(item, registrationUrl);
  const cta = resolveMarketingTourDetailCtaModel({
    registrationUrl,
    tourSignInUrl: null,
    canRegister: registration.canRegister,
    memberSessionReadable: false,
    selfRegistrationDetailUrl: null,
  });

  return renderSessionUi(
    createElement(CatalogTourDetailBookingRailContent, {
      tour: item,
      pluginId,
      registration,
      cta,
      t,
      locale: "fa",
    })
  );
}

describe("catalog tour detail booking rail", () => {
  it("announces an ended tour without advertising its spare seats or a booking action", () => {
    const html = renderRail({ ...tour, registrationState: "past" });
    assert.match(html, /<aside\b/);
    assert.match(html, /این تور به پایان رسیده است/);
    assert.doesNotMatch(html, /جای خالی|ظرفیت:|<button\b|<a\s[^>]*href=/);
  });

  it("preserves the existing ended-tour capacity in the standard catalog", () => {
    const html = renderRail({ ...tour, registrationState: "past" }, "urban");
    assert.match(html, /این تور به پایان رسیده است/);
    assert.match(html, /۱۱ جای خالی/);
    assert.doesNotMatch(html, /<button\b|<a\s[^>]*href=/);
  });

  it("displays remaining seats and registration for an active tour", () => {
    const html = renderRail({ ...tour, registrationState: "open" });
    assert.match(html, /۱۱ جای خالی/);
    assert.match(html, /ثبت‌نام/);
    assert.doesNotMatch(html, /ظرفیت:|این تور به پایان رسیده است/);
  });

  it("displays total capacity for an active tour with no remaining-seat count", () => {
    const html = renderRail({
      ...tour,
      registrationState: "open",
      spotsRemaining: null,
    });
    assert.match(html, /ظرفیت: ۱۲/);
    assert.doesNotMatch(html, /جای خالی/);
  });
});
