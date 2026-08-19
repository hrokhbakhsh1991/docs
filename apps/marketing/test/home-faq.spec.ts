/**
 * HOME-UNIT — Denali Landing FAQ + supporting-content cleanup (Slice 6).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { WORKSPACE_GUEST_LANDING } from "../../../packages/workspace-sdk/src/catalog/workspace-guest-landing.generated.ts";

import { HOME_EQUIPMENT_ITEM_IDS } from "../src/home/home-equipment-item-ids";
import { HOME_FAQ_ITEM_IDS } from "../src/home/home-faq-item-ids";
import { resolveHomeSectionVisibility } from "../src/home/home-section-gates";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("home-faq.spec.ts", () => {
  it("Denali landing gates drop Journey, Testimonials, and standalone Equipment", () => {
    const landing = WORKSPACE_GUEST_LANDING.denali;
    assert.equal(landing.sections.journey, false);
    assert.equal(landing.sections.testimonials, false);
    assert.equal(landing.sections.equipment, false);
    assert.equal(landing.sections.faq, true);
    assert.equal(landing.sections.gallery, true);
    assert.equal(landing.sections.finalCta, true);

    const visibility = resolveHomeSectionVisibility(landing, 4, 3, 3);
    assert.equal(visibility.journey, false);
    assert.equal(visibility.testimonials, false);
    assert.equal(visibility.equipment, false);
    assert.equal(visibility.faq, true);
    assert.equal(visibility.gallery, true);
    assert.equal(visibility.finalCta, true);
    assert.equal(visibility.whySection, true);
  });

  it("keeps six FAQ items, native details, and merges equipment copy into q2", () => {
    const faq = readSrc("apps/marketing/src/home/home-faq.tsx");
    const compose = readSrc("apps/marketing/src/home/guest-home-full.tsx");
    const en = JSON.parse(readSrc("apps/marketing/messages/en/catalog.json")) as {
      home: {
        full: {
          equipment: Record<string, { label?: string } | string>;
          faq: Record<string, { question?: string }>;
        };
      };
    };
    const fa = JSON.parse(readSrc("apps/marketing/messages/fa/catalog.json")) as {
      home: { full: { equipment: Record<string, { label?: string } | string> } };
    };

    assert.deepEqual([...HOME_FAQ_ITEM_IDS], ["q1", "q2", "q3", "q4", "q5", "q6"]);
    assert.match(faq, /<details key=\{id\} data-marketing-home-faq-item>/);
    assert.match(faq, /<summary data-marketing-home-faq-question>/);
    assert.match(faq, /data-marketing-home-faq-document/);
    assert.match(faq, /data-marketing-home-faq-inner/);
    assert.match(faq, /home\.full\.faq\.title/);
    assert.doesNotMatch(faq, /home\.full\.faq\.lead/);
    assert.doesNotMatch(faq, /href=/);
    assert.doesNotMatch(faq, /\/tours/);
    assert.doesNotMatch(faq, /HomeSectionViewAllLink/);
    assert.match(faq, /HOME_EQUIPMENT_ITEM_IDS/);
    assert.match(faq, /home\.full\.equipment\.lead/);
    assert.match(faq, /home\.full\.equipment\.\$\{id\}\.label/);
    assert.match(faq, /data-marketing-home-faq-answer-equipment/);
    assert.equal(en.home.full.equipment.lead, "Common minimums — each tour page lists full requirements.");
    for (const id of HOME_EQUIPMENT_ITEM_IDS) {
      const enEntry = en.home.full.equipment[id];
      const faEntry = fa.home.full.equipment[id];
      assert.ok(typeof enEntry === "object" && enEntry.label);
      assert.ok(typeof faEntry === "object" && faEntry.label);
    }
    assert.equal(en.home.full.faq.q1?.question, "How do I register for a tour?");
    assert.equal(en.home.full.faq.q2?.question, "What equipment do I need?");
    assert.equal(en.home.full.faq.q6?.question, "How can I contact the club?");

    assert.match(compose, /sections\.journey \? <HomeJourney/);
    assert.match(compose, /sections\.testimonials \? <HomeTestimonials/);
    assert.match(compose, /sections\.equipment \? <HomeEquipment/);
    assert.match(compose, /sections\.faq \? <HomeFaq/);
    assert.match(compose, /<HomeFinalCta/);
  });

  it("owns FAQ CSS as a named landing partial and does not restyle locked sections", () => {
    const aggregator = readSrc("packages/workspaces/denali/theme/marketing/home-landing.css");
    const css = readSrc("packages/workspaces/denali/theme/marketing/home/faq.css");
    const gallery = readSrc("packages/workspaces/denali/theme/marketing/home/gallery.css");
    const why = readSrc("packages/workspaces/denali/theme/marketing/home/why.css");
    const hero = readSrc("packages/workspaces/denali/theme/marketing/home/hero.css");

    assert.match(aggregator, /@import "\.\/home\/gallery\.css"/);
    assert.match(aggregator, /@import "\.\/home\/faq\.css"/);
    assert.match(css, /data-marketing-home-faq-inner/);
    assert.match(css, /max-width: 48rem/);
    assert.match(css, /min-height: 2.75rem/);
    assert.match(css, /--color-bg-surface/);
    assert.doesNotMatch(css, /box-shadow: var\(--mkt-shadow-card\)/);
    assert.doesNotMatch(gallery, /data-marketing-home-faq/);
    assert.doesNotMatch(why, /data-marketing-home-faq/);
    assert.doesNotMatch(hero, /data-marketing-home-faq/);
  });
});
