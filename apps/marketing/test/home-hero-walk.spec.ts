/**
 * HOME-UNIT — Walk / Trail Scale Hero runtime contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveMarketingHomeHeroMedia } from "../src/home/resolve-marketing-home-hero-media";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

function readCatalog(locale: "en" | "fa"): {
  home: { full: { hero: Record<string, string> } };
} {
  return JSON.parse(readSrc(`apps/marketing/messages/${locale}/catalog.json`)) as {
    home: { full: { hero: Record<string, string> } };
  };
}

describe("home-hero-walk.spec.ts", () => {
  it("renders one H1, support, and a single /tours CTA with Walk media", () => {
    const hero = readSrc("apps/marketing/src/home/home-hero.tsx");
    const full = readSrc("apps/marketing/src/home/guest-home-full.tsx");

    assert.match(hero, /data-marketing-home-hero-walk/);
    assert.match(hero, /data-marketing-home-title/);
    assert.match(hero, /home\.full\.hero\.lead/);
    assert.match(hero, /data-marketing-home-hero-support/);
    assert.match(hero, /home\.full\.hero\.support/);
    assert.match(hero, /home\.full\.hero\.ctaPrimary/);
    assert.match(hero, /resolveMarketingToursListPath\(locale\)/);
    assert.match(hero, /<picture data-marketing-home-hero-media>/);
    assert.match(hero, /media="\(max-width: 48rem\)"/);
    assert.equal((hero.match(/<h1 /g) ?? []).length, 1);
    assert.equal((hero.match(/<Link /g) ?? []).length, 1);
    assert.doesNotMatch(hero, /data-marketing-home-hero-cinematic/);
    assert.doesNotMatch(hero, /data-marketing-home-hero-peak-margin/);
    assert.doesNotMatch(hero, /HomeHeroDestinationStage/);
    assert.doesNotMatch(hero, /HomeHeroStaticParallax/);
    assert.doesNotMatch(hero, /HomeHeroCarouselMedia/);
    assert.doesNotMatch(hero, /data-marketing-home-search/);
    assert.doesNotMatch(hero, /data-marketing-home-cta-secondary/);
    assert.doesNotMatch(hero, /data-marketing-home-hero-eyebrow/);
    assert.doesNotMatch(hero, /role="radiogroup"/);
    assert.doesNotMatch(hero, /#why-us/);
    assert.match(full, /resolveMarketingHomeHeroMedia/);
    assert.match(full, /heroImageUrl/);
    assert.doesNotMatch(full, /whySectionHref/);
  });

  it("uses FA/EN Walk copy and keeps obsolete Hero keys", () => {
    const fa = readCatalog("fa").home.full.hero;
    const en = readCatalog("en").home.full.hero;

    assert.equal(fa.lead, "بیا به کوه");
    assert.equal(fa.support, "برنامه‌های طبیعت‌گردی برای پیوستن.");
    assert.equal(fa.ctaPrimary, "دیدن برنامه‌ها");
    assert.equal(en.lead, "Come to the mountain");
    assert.equal(en.support, "Nature programs you can join.");
    assert.equal(en.ctaPrimary, "See programs");
    assert.ok(fa.eyebrow.trim().length > 0);
    assert.ok(en.ctaSecondary.trim().length > 0);
  });

  it("resolves desktop + mobile sources without inventing dimensions", () => {
    const empty = {
      displayName: null,
      primaryColor: null,
      logoUrl: null,
      defaultLocale: null,
    };
    const media = resolveMarketingHomeHeroMedia(empty);
    assert.equal(media.desktopSrc, "/home/hero-walk.webp");
    assert.equal(media.mobileSrc, "/home/hero-walk-mobile.webp");
    assert.equal(media.desktopWidth, 1536);
    assert.equal(media.desktopHeight, 1024);
    assert.equal(media.mobileWidth, 1024);
    assert.equal(media.mobileHeight, 1536);

    const overridden = resolveMarketingHomeHeroMedia({
      ...empty,
      marketingHeroUrl: "https://cdn.example/custom-hero.jpg",
    });
    assert.equal(overridden.desktopSrc, "https://cdn.example/custom-hero.jpg");
    assert.equal(overridden.mobileSrc, "https://cdn.example/custom-hero.jpg");
    assert.equal(overridden.desktopWidth, undefined);
  });

  it("owns Walk CSS in the existing Hero partial", () => {
    const css = readSrc("packages/workspaces/denali/theme/marketing/home/hero.css");
    assert.match(css, /data-marketing-home-hero-walk/);
    assert.match(css, /data-marketing-header-overlay/);
    assert.match(css, /gap: 5px/);
    assert.match(css, /width: 1\.25rem;/);
    assert.doesNotMatch(css, /data-marketing-nav-link-id="tours"/);
    assert.match(
      css,
      /summary\[data-marketing-nav-drawer-toggle\] \{[\s\S]*?border-radius: 0;/,
    );
    assert.doesNotMatch(css, /data-marketing-home-hero-peak-margin/);
    assert.doesNotMatch(css, /data-marketing-home-hero-selector/);
    assert.doesNotMatch(css, /Ken Burns|ken-burns|mkt-hero-cinematic-ken-burns/);
    assert.doesNotMatch(css, /data-marketing-home-final-cta/);
    assert.doesNotMatch(css, /data-marketing-home-why/);
  });
});
