/**
 * HOME-UNIT-02 — fa/en parity for home.full.* and home.minimal.* i18n keys.
 * @see docs/workspaces/denali/marketing-landing.mdoc §7.1
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

import { HOME_CATEGORY_SLUGS } from "../src/home/home-category-slugs";
import { HOME_DESTINATION_IDS } from "../src/home/home-destination-ids";
import { HOME_EQUIPMENT_ITEM_IDS } from "../src/home/home-equipment-item-ids";
import { HOME_FAQ_ITEM_IDS } from "../src/home/home-faq-item-ids";
import { HOME_JOURNEY_STEP_IDS } from "../src/home/home-journey-step-ids";
import { HOME_TESTIMONIAL_IDS } from "../src/home/home-testimonial-ids";
import { HOME_WHY_TILE_IDS } from "../src/home/home-why-tile-ids";

const REQUIRED_HOME_KEYS = [
  "home.full.hero.eyebrow",
  "home.full.hero.lead",
  "home.full.hero.ctaPrimary",
  "home.full.hero.ctaSecondary",
  "home.full.hero.scrollHint",
  "home.full.hero.spotlight.rotateLabel",
  "home.full.hero.spotlight.rotatePrev",
  "home.full.hero.spotlight.rotateNext",
  "home.full.hero.spotlight.exploreTours",
  "home.full.hero.spotlight.stats.elevation",
  "home.full.hero.spotlight.stats.region",
  "home.full.hero.spotlight.alborz.tagline",
  "home.full.hero.spotlight.alborz.elevationValue",
  "home.full.hero.spotlight.alborz.regionValue",
  "home.full.hero.spotlight.damavand.tagline",
  "home.full.hero.spotlight.damavand.elevationValue",
  "home.full.hero.spotlight.damavand.regionValue",
  "home.full.hero.spotlight.zardkuh.tagline",
  "home.full.hero.spotlight.zardkuh.elevationValue",
  "home.full.hero.spotlight.zardkuh.regionValue",
  "home.full.latest.title",
  "home.full.latest.lead",
  "home.full.latest.viewAll",
  "home.full.featured.title",
  "home.full.featured.lead",
  "home.full.featured.flagshipLabel",
  "home.full.featured.picksLabel",
  "home.full.featured.viewAll",
  "home.full.featured.viewProgram",
  "home.full.categories.title",
  "home.full.categories.lead",
  ...HOME_CATEGORY_SLUGS.map((id) => `home.full.categories.labels.${id}`),
  "home.full.destinations.title",
  "home.full.destinations.lead",
  "home.full.destinations.explore",
  "home.full.search.label",
  "home.full.search.placeholder",
  "home.full.search.submit",
  "home.full.gallery.title",
  "home.full.gallery.lead",
  "home.full.gallery.browseAll",
  "home.full.gallery.scrollPrev",
  "home.full.gallery.scrollNext",
  "home.full.gallery.openPhoto",
  "home.full.gallery.photos.01",
  "home.full.gallery.photos.02",
  "home.full.gallery.photos.03",
  "home.full.equipment.title",
  "home.full.equipment.lead",
  "home.full.blog.title",
  "home.full.blog.lead",
  "home.full.blog.stub",
  "nav.skipToContent",
  "home.full.trust.tagline",
  "home.full.why.title",
  "home.full.why.lead",
  "home.full.journey.title",
  "home.full.journey.lead",
  "home.full.testimonials.title",
  "home.full.finalCta.title",
  "home.full.finalCta.lead",
  "home.full.finalCta.cta",
  "home.full.faq.title",
  "home.full.footer.brandLead",
  "home.full.footer.toursTitle",
  "home.full.footer.toursBrowse",
  "home.full.footer.resourcesTitle",
  "home.full.footer.resourcesFaq",
  "home.full.footer.resourcesMember",
  "home.full.footer.contactTitle",
  "home.full.footer.contactLead",
  "home.full.footer.newsletterTitle",
  "home.full.footer.newsletterStub",
  "home.full.footer.copyright",
  "nav.openMenu",
  "home.minimal.title",
  "home.minimal.lead",
  "home.minimal.cta",
  ...HOME_WHY_TILE_IDS.flatMap((id) => [
    `home.full.why.${id}.title`,
    `home.full.why.${id}.description`,
  ]),
  ...HOME_JOURNEY_STEP_IDS.flatMap((id) => [
    `home.full.journey.${id}.title`,
    `home.full.journey.${id}.description`,
  ]),
  ...HOME_TESTIMONIAL_IDS.flatMap((id) => [
    `home.full.testimonials.${id}.quote`,
    `home.full.testimonials.${id}.name`,
    `home.full.testimonials.${id}.role`,
  ]),
  ...HOME_FAQ_ITEM_IDS.flatMap((id) => [
    `home.full.faq.${id}.question`,
    `home.full.faq.${id}.answer`,
  ]),
  ...HOME_DESTINATION_IDS.flatMap((id) => [
    `home.full.destinations.${id}.name`,
    `home.full.destinations.${id}.description`,
  ]),
  ...HOME_EQUIPMENT_ITEM_IDS.map((id) => `home.full.equipment.${id}.label`),
] as const;

function readCatalogMessages(locale: "en" | "fa"): Record<string, unknown> {
  const path = join(repoRoot, "apps/marketing/messages", locale, "catalog.json");
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function readNestedValue(source: Record<string, unknown>, dottedKey: string): unknown {
  let current: unknown = source;
  for (const segment of dottedKey.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function collectHomeKeys(source: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const dottedKey of REQUIRED_HOME_KEYS) {
    const value = readNestedValue(source, dottedKey);
    if (typeof value === "string" && value.trim().length > 0) {
      keys.push(dottedKey);
    }
  }
  return keys;
}

describe("home-i18n-keys.spec.ts — HOME-UNIT-02", () => {
  it("fa and en define the same home.full.* and home.minimal.* keys", () => {
    const en = readCatalogMessages("en");
    const fa = readCatalogMessages("fa");
    const enKeys = collectHomeKeys(en);
    const faKeys = collectHomeKeys(fa);

    assert.deepEqual(enKeys.sort(), faKeys.sort(), "fa/en home key sets must match");
    assert.deepEqual(
      enKeys.sort(),
      [...REQUIRED_HOME_KEYS].sort(),
      "both locales must define all required home keys"
    );
  });
});
