import { getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "@/catalog/catalog-types";
import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import { resolveMarketingHeroImageUrl } from "@/tenant/resolve-marketing-hero-image-url";

import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import { deriveHomeCategories } from "./derive-home-categories";
import { deriveHomeGalleryPhotos } from "./derive-home-gallery-photos";
import { HomeBlogTeaser } from "./home-blog-teaser";
import { HomeCategories } from "./home-categories";
import { HomeDestinations } from "./home-destinations";
import { HomeEquipment } from "./home-equipment";
import { HomeFinalCta } from "./home-final-cta";
import { HomeFaq } from "./home-faq";
import { HomeGallery } from "./home-gallery";
import { HomeHero } from "./home-hero";
import { HomeJourney } from "./home-journey";
import { HomePageJsonLd } from "./home-page-jsonld";
import { HomePublishedPrograms, PUBLISHED_PROGRAMS_MAX } from "./home-published-programs";
import { resolveHomeSectionVisibility } from "./home-section-gates";
import { HomeTestimonials } from "./home-testimonials";
import { HomeTrust } from "./home-trust";
import { HomeWhy } from "./home-why";
import { resolveHomeWhySectionAnchor, resolveHomeWhySectionHref } from "./resolve-home-why-section-anchor";

export type GuestHomeFullProps = {
  readonly landing: GuestLandingFeatures;
  readonly branding: PublicTenantBrandingSnapshot;
  readonly catalogItems: readonly MarketingCatalogCard[];
  readonly pluginId: string;
  readonly host: string;
};

export async function GuestHomeFull({
  landing,
  branding,
  catalogItems,
  pluginId,
  host,
}: GuestHomeFullProps) {
  const t = await getTranslations("catalog");
  const categories = deriveHomeCategories(catalogItems);
  const galleryPhotos = deriveHomeGalleryPhotos((key) => t(key));
  const sections = resolveHomeSectionVisibility(
    landing,
    catalogItems.length,
    categories.length,
    galleryPhotos.length
  );
  const showPrograms = sections.featured || sections.latest;
  const programsLimit = Math.min(
    PUBLISHED_PROGRAMS_MAX,
    Math.max(
      sections.featured ? landing.sections.featuredToursLimit : 0,
      sections.latest ? landing.sections.latestToursLimit : 0
    )
  );
  const programsItems = showPrograms ? catalogItems.slice(0, programsLimit) : [];
  const nestCategoriesInPrograms = showPrograms && sections.categories;
  const heroImageUrl = resolveMarketingHeroImageUrl(branding);
  const whySectionAnchor = resolveHomeWhySectionAnchor(landing);
  const whySectionHref = resolveHomeWhySectionHref(landing);
  const jsonLdItems = programsItems.map((item) => ({
    tourId: item.id,
    title: item.title?.trim() || t("detail.defaultTourTitle"),
  }));

  return (
    <div data-marketing-home data-slot="page-home">
      {sections.hero ? (
        <HomeHero
          branding={branding}
          showSearch={sections.heroSearch}
          heroImageUrl={heroImageUrl}
          whySectionHref={sections.whySection ? whySectionHref : undefined}
          destinationSlugs={landing.destinationSlugs}
          destinationImageStems={landing.destinationImageStems}
        />
      ) : null}
      {showPrograms ? (
        <HomePublishedPrograms
          items={programsItems}
          pluginId={pluginId}
          showSearch={sections.heroSearch}
          categories={nestCategoriesInPrograms ? categories : []}
        />
      ) : null}
      {sections.categories && !nestCategoriesInPrograms ? (
        <HomeCategories categories={categories} />
      ) : null}
      {sections.destinations ? (
        <HomeDestinations
          destinationSlugs={landing.destinationSlugs}
          destinationImageStems={landing.destinationImageStems}
        />
      ) : null}
      {sections.trust ? <HomeTrust branding={branding} /> : null}
      {sections.whySection ? (
        <HomeWhy branding={branding} whySectionAnchor={whySectionAnchor} />
      ) : null}
      {sections.journey ? <HomeJourney /> : null}
      {sections.testimonials ? <HomeTestimonials /> : null}
      {sections.gallery ? <HomeGallery photos={galleryPhotos} /> : null}
      {sections.faq ? <HomeFaq /> : null}
      {sections.equipment ? <HomeEquipment /> : null}
      {sections.blogTeaser ? <HomeBlogTeaser /> : null}
      {sections.finalCta ? <HomeFinalCta /> : null}
      {showPrograms ? <HomePageJsonLd host={host} items={jsonLdItems} /> : null}
    </div>
  );
}
