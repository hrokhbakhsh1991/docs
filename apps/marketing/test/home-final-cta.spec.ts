/**
 * HOME-UNIT — Denali Landing Final CTA (Slice 7).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { WORKSPACE_GUEST_LANDING } from "../../../packages/workspace-sdk/src/catalog/workspace-guest-landing.generated.ts";

import { resolveHomeSectionVisibility } from "../src/home/home-section-gates";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("home-final-cta.spec.ts", () => {
  it("Denali landing still composes Final CTA once after FAQ", () => {
    const landing = WORKSPACE_GUEST_LANDING.denali;
    assert.equal(landing.sections.finalCta, true);
    assert.equal(landing.sections.faq, true);
    assert.equal(landing.sections.gallery, true);
    assert.equal(landing.sections.journey, false);

    const visibility = resolveHomeSectionVisibility(landing, 4, 3, 3);
    assert.equal(visibility.finalCta, true);
    assert.equal(visibility.faq, true);
    assert.equal(visibility.gallery, true);

    const compose = readSrc("apps/marketing/src/home/guest-home-full.tsx");
    assert.match(compose, /sections\.faq \? <HomeFaq/);
    assert.match(compose, /sections\.finalCta \? <HomeFinalCta/);
    const faqIdx = compose.indexOf("sections.faq ? <HomeFaq");
    const ctaIdx = compose.indexOf("sections.finalCta ? <HomeFinalCta");
    assert.ok(faqIdx >= 0 && ctaIdx > faqIdx);
  });

  it("uses existing finalCta copy, one /tours link, and no secondary conversion", () => {
    const source = readSrc("apps/marketing/src/home/home-final-cta.tsx");
    const en = JSON.parse(readSrc("apps/marketing/messages/en/catalog.json")) as {
      home: { full: { finalCta: { title: string; lead: string; cta: string } } };
    };

    assert.match(source, /data-marketing-home-final-cta-panel/);
    assert.match(source, /data-marketing-home-final-cta-inner/);
    assert.match(source, /data-marketing-home-final-cta-body/);
    assert.match(source, /home\.full\.finalCta\.title/);
    assert.match(source, /home\.full\.finalCta\.lead/);
    assert.match(source, /home\.full\.finalCta\.cta/);
    assert.match(source, /resolveMarketingToursListPath/);
    assert.match(source, /data-marketing-home-final-cta-action/);
    assert.equal((source.match(/<Link /g) ?? []).length, 1);
    assert.doesNotMatch(source, /HomeSectionViewAllLink/);
    assert.doesNotMatch(source, /data-marketing-home-search/);
    assert.doesNotMatch(source, /data-marketing-home-cta-secondary/);
    assert.doesNotMatch(source, /#why-us/);
    assert.doesNotMatch(source, /Limited spots|Book now|Join thousands/i);
    assert.equal(en.home.full.finalCta.title, "Ready for your next trip?");
    assert.equal(en.home.full.finalCta.lead, "Take the next step — choose a program that fits you.");
    assert.equal(en.home.full.finalCta.cta, "Browse tours");
  });

  it("owns Final CTA CSS as a named landing partial and does not restyle locked sections", () => {
    const aggregator = readSrc("packages/workspaces/denali/theme/marketing/home-landing.css");
    const css = readSrc("packages/workspaces/denali/theme/marketing/home/final-cta.css");
    const faq = readSrc("packages/workspaces/denali/theme/marketing/home/faq.css");
    const gallery = readSrc("packages/workspaces/denali/theme/marketing/home/gallery.css");
    const hero = readSrc("packages/workspaces/denali/theme/marketing/home/hero.css");

    assert.match(aggregator, /@import "\.\/home\/faq\.css"/);
    assert.match(aggregator, /@import "\.\/home\/final-cta\.css"/);
    assert.match(css, /data-marketing-home-final-cta-inner/);
    assert.match(css, /data-marketing-home-final-cta-body/);
    assert.match(css, /--denali-forest-600/);
    assert.match(css, /background: var\(--denali-mist-50/);
    assert.doesNotMatch(css, /var\(--color-accent\)/);
    assert.doesNotMatch(css, /url\(/);
    assert.doesNotMatch(faq, /data-marketing-home-final-cta/);
    assert.doesNotMatch(gallery, /data-marketing-home-final-cta/);
    assert.doesNotMatch(hero, /data-marketing-home-final-cta/);
  });
});
