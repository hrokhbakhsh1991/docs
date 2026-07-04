import { getTranslations } from "next-intl/server";

export type CatalogTourDetailJumpNavProps = {
  readonly showReadiness: boolean;
  readonly showItinerary: boolean;
  readonly showLogistics: boolean;
  readonly showGear: boolean;
  readonly showGallery: boolean;
  readonly showPolicies: boolean;
  readonly showRegisterPreview: boolean;
  readonly showFaq: boolean;
};

export async function CatalogTourDetailJumpNav({
  showReadiness,
  showItinerary,
  showLogistics,
  showGear,
  showGallery,
  showPolicies,
  showRegisterPreview,
  showFaq,
}: CatalogTourDetailJumpNavProps) {
  if (
    !showReadiness &&
    !showItinerary &&
    !showLogistics &&
    !showGear &&
    !showGallery &&
    !showPolicies &&
    !showRegisterPreview &&
    !showFaq
  ) {
    return null;
  }

  const t = await getTranslations("catalog");
  const items: { readonly href: string; readonly label: string }[] = [];

  if (showReadiness) {
    items.push({ href: "#catalog-detail-readiness", label: t("detail.jumpNav.readiness") });
  }
  if (showItinerary) {
    items.push({ href: "#catalog-detail-itinerary", label: t("detail.jumpNav.itinerary") });
  }
  if (showLogistics) {
    items.push({ href: "#catalog-detail-logistics", label: t("detail.jumpNav.logistics") });
  }
  if (showGear) {
    items.push({ href: "#catalog-detail-gear", label: t("detail.jumpNav.gear") });
  }
  if (showGallery) {
    items.push({ href: "#catalog-detail-gallery", label: t("detail.jumpNav.gallery") });
  }
  if (showPolicies) {
    items.push({ href: "#catalog-detail-policies", label: t("detail.jumpNav.policies") });
  }
  if (showRegisterPreview) {
    items.push({
      href: "#catalog-detail-register-preview",
      label: t("detail.jumpNav.registerPreview"),
    });
  }
  if (showFaq) {
    items.push({ href: "#catalog-detail-faq", label: t("detail.jumpNav.faq") });
  }

  return (
    <nav data-marketing-catalog-detail-jump-nav aria-label={t("detail.jumpNav.label")}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
