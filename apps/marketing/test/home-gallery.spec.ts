/**
 * HOME-UNIT — Denali Landing Gallery (Slice 5).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("home-gallery.spec.ts", () => {
  it("keeps three static photos, existing title/lead, and no catalog CTA", () => {
    const gallery = readSrc("apps/marketing/src/home/home-gallery.tsx");
    const showcase = readSrc("apps/marketing/src/home/home-gallery-showcase.tsx");
    const derive = readSrc("apps/marketing/src/home/derive-home-gallery-photos.ts");
    const assets = readSrc("apps/marketing/src/home/home-marketing-assets.ts");

    assert.match(gallery, /home\.full\.gallery\.title/);
    assert.match(gallery, /home\.full\.gallery\.lead/);
    assert.match(gallery, /data-marketing-home-gallery-editorial/);
    assert.match(gallery, /HomeGalleryShowcase/);
    assert.doesNotMatch(gallery, /HomeSectionViewAllLink/);
    assert.doesNotMatch(gallery, /home\.full\.gallery\.browseAll/);
    assert.doesNotMatch(gallery, /gallery-view-all/);
    assert.doesNotMatch(gallery, /href=/);
    assert.doesNotMatch(gallery, /\/tours/);
    assert.match(showcase, /CatalogTourDetailPhotoLightbox/);
    assert.match(showcase, /CatalogTourDetailPhotoLightboxTrigger/);
    assert.match(showcase, /HomeGalleryFilmstrip/);
    assert.doesNotMatch(showcase, /resolveMarketingToursListPath/);
    assert.doesNotMatch(showcase, /\/tours/);
    assert.match(derive, /MARKETING_GALLERY_STATIC_ITEMS/);
    assert.match(assets, /\/home\/gallery\/01\.webp/);
    assert.match(assets, /\/home\/gallery\/02\.webp/);
    assert.match(assets, /\/home\/gallery\/03\.webp/);
  });

  it("owns Gallery CSS as a named landing partial and does not restyle locked sections", () => {
    const aggregator = readSrc("packages/workspaces/denali/theme/marketing/home-landing.css");
    const css = readSrc("packages/workspaces/denali/theme/marketing/home/gallery.css");
    const why = readSrc("packages/workspaces/denali/theme/marketing/home/why.css");
    const destinations = readSrc(
      "packages/workspaces/denali/theme/marketing/home/destinations.css"
    );
    const lightbox = readSrc(
      "apps/marketing/src/catalog/catalog-tour-detail-photo-lightbox.tsx"
    );

    assert.match(aggregator, /@import "\.\/home\/hero\.css"/);
    assert.match(aggregator, /@import "\.\/home\/programs\.css"/);
    assert.match(aggregator, /@import "\.\/home\/destinations\.css"/);
    assert.match(aggregator, /@import "\.\/home\/why\.css"/);
    assert.match(aggregator, /@import "\.\/home\/gallery\.css"/);
    assert.match(css, /data-marketing-home-gallery-inner/);
    assert.match(css, /max-height: 22rem/);
    assert.match(css, /scroll-snap-type: none/);
    assert.doesNotMatch(css, /scale\(1\./);
    assert.doesNotMatch(why, /data-marketing-home-gallery/);
    assert.doesNotMatch(destinations, /data-marketing-home-gallery/);
    assert.match(lightbox, /data-marketing-catalog-detail-photo-lightbox/);
  });
});
