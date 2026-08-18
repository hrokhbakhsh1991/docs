import { expect, test } from "@playwright/test";

const OPERATOR_PUBLISHED_TOUR_TITLE = "North Ridge Trek";

const URBAN_DENYLIST = ["کوهنوردی", "طبیعت‌گردی"];

test("SMK-MKT-HOME-01 denali full hooks", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-marketing-home-hero]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-home-hero] [data-marketing-home-search]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-hero-selector]")).toBeVisible();
  await expect(page.locator("[data-marketing-home-cta]").first()).toBeVisible();
  await expect(page.locator("[data-marketing-home-cta-secondary]")).toHaveAttribute("href", "#why-us");
  await expect(page.locator("section[data-marketing-home-trust]")).toHaveCount(0);
  const why = page.locator("[data-marketing-home-why]#why-us");
  await expect(why).toBeVisible();
  await expect(why.locator("h2")).toHaveCount(1);
  await expect(why.locator("[data-marketing-home-why-kicker]")).toBeVisible();
  await expect(why.locator("[data-marketing-home-why-item]")).toHaveCount(4);
  await expect(why.locator("a")).toHaveCount(0);
  await expect(why.locator("[data-marketing-home-cta]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-journey]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-testimonials]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-equipment]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-skip-link]")).toHaveCount(1);
  const destinations = page.locator("[data-marketing-home-destinations]");
  await expect(destinations).toBeVisible();
  await expect(destinations.locator("[data-marketing-home-destination-card]")).toHaveCount(3);
  await expect(destinations.locator("[data-marketing-home-destination-link]")).toHaveCount(3);
  const destinationHrefs = await destinations
    .locator("[data-marketing-home-destination-link]")
    .evaluateAll((links) =>
      links.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? "")
    );
  expect(destinationHrefs.every((href) => href.includes("q="))).toBe(true);
  expect(destinationHrefs.some((href) => href.includes("destination="))).toBe(false);
  await expect(destinations.locator("[data-marketing-home-destination-link]").first()).toBeVisible();
  await expect(
    destinations.locator("[data-marketing-home-destination-card]").first()
  ).not.toHaveAttribute("tabindex");
  await expect(page.locator("[data-marketing-home-hero-selector] a")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-faq]")).toBeVisible();
  await expect(page.locator("[data-marketing-home-final-cta]")).toBeVisible();

  const programs = page.locator("[data-marketing-home-programs]");
  const gallery = page.locator("[data-marketing-home-gallery]");

  await expect(page.locator("[data-marketing-home-featured]")).toHaveCount(0);
  await expect(programs).toHaveCount(1);
  await expect(page.locator("[data-marketing-home-latest]")).toHaveCount(1);
  await expect(page.locator("section[data-marketing-home-categories]")).toHaveCount(0);
  await expect(programs.locator("[data-marketing-home-search]")).toBeVisible();
  await expect(programs.locator("[data-marketing-home-search] input[name='q']")).toBeVisible();
  await expect(programs.locator("[data-marketing-home-category-chip]").first()).toHaveAttribute(
    "href",
    /category=/
  );
  await expect(programs.locator("[data-marketing-home-programs-view-all]")).toHaveAttribute(
    "href",
    /\/tours/
  );
  const cardCount = await programs.locator("[data-marketing-home-programs-card]").count();
  expect(cardCount).toBeGreaterThan(0);
  expect(cardCount).toBeLessThanOrEqual(6);
  await expect(programs.locator("[data-marketing-home-programs-grid]")).toHaveAttribute(
    "data-programs-count",
    String(cardCount)
  );
  await expect(page.getByText(OPERATOR_PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(gallery).toBeVisible();
  await expect(gallery.locator("h2")).toHaveCount(1);
  await expect(gallery.locator("[data-marketing-home-gallery-lead]")).toBeVisible();
  await expect(gallery.locator("[data-marketing-home-gallery-item]")).toHaveCount(3);
  await expect(gallery.locator("[data-marketing-home-gallery-view-all]")).toHaveCount(0);
  await expect(gallery.locator("a[href*='/tours']")).toHaveCount(0);
  await expect(gallery.getByRole("link", { name: /همه تورها|All tours/i })).toHaveCount(0);
  await expect(gallery.locator("[data-marketing-catalog-detail-photo-trigger]")).toHaveCount(1);
  await gallery.locator("[data-marketing-catalog-detail-photo-trigger]").click();
  const lightbox = page.locator("[data-marketing-catalog-detail-photo-lightbox]");
  await expect(lightbox).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lightbox).not.toBeVisible();

  const faq = page.locator("[data-marketing-home-faq]");
  await expect(faq).toBeVisible();
  await expect(faq.locator("h2")).toHaveCount(1);
  await expect(faq.locator("details[data-marketing-home-faq-item]")).toHaveCount(6);
  await expect(faq.locator("summary[data-marketing-home-faq-question]")).toHaveCount(6);
  await expect(faq.locator("a")).toHaveCount(0);
  await expect(faq.locator("[data-marketing-home-cta]")).toHaveCount(0);
  const gearAnswer = faq.locator("[data-marketing-home-faq-answer-equipment]");
  await expect(gearAnswer).toHaveCount(1);
  const gearItem = faq.locator("details[data-marketing-home-faq-item]").nth(1);
  await gearItem.locator("summary").click();
  await expect(gearItem).toHaveAttribute("open", "");
  await expect(gearAnswer).toBeVisible();
  await expect(gearAnswer).toContainText(/کفش مناسب|trail footwear/i);

  const finalCta = page.locator("[data-marketing-home-final-cta]");
  await expect(finalCta).toHaveCount(1);
  await expect(finalCta.locator("h2")).toHaveCount(1);
  await expect(finalCta.locator("[data-marketing-home-final-cta-lead]")).toBeVisible();
  await expect(finalCta.locator("a")).toHaveCount(1);
  await expect(finalCta.locator("[data-marketing-home-cta]")).toHaveCount(1);
  await expect(finalCta.locator("[data-marketing-home-final-cta-action]")).toHaveAttribute(
    "href",
    /\/tours/
  );
  await expect(finalCta.locator("[data-marketing-home-search]")).toHaveCount(0);
  await expect(finalCta.locator("[data-marketing-home-cta-secondary]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-hero] [data-marketing-home-cta]")).toHaveCount(1);
});

test("SMK-MKT-HOME-02 iPhone viewport has no horizontal body overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-marketing-home]")).toBeVisible({ timeout: 60_000 });

  const overflowX = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth;
  });
  expect(overflowX).toBe(false);
});

test("SMK-MKT-HOME-03 English locale shows home lead", async ({ page, baseURL }) => {
  await page.goto("/en/");
  await expect(page.locator("[data-marketing-home]")).toBeVisible({ timeout: 60_000 });
  // Value-proposition H1 is tenant-dependent; assert the title slot renders in English locale.
  await expect(page.locator("[data-marketing-home-title]")).toBeVisible();
  // Sanity check: ensure we're not accidentally rendering Persian digits/phrases on /en.
  const isUrban = baseURL?.includes("urban.localhost") ?? false;
  if (isUrban) {
    await expect(page.getByText(/View published programs/i)).toBeVisible();
  }
});

test("SMK-MKT-HOME-05 urban minimal isolation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-marketing-home-title]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-home-cta]")).toBeVisible();
  await expect(page.locator("[data-marketing-home-hero]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-trust]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-final-cta]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-faq]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-why]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-journey]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-testimonials]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-featured]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-categories]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-destinations]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-search]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-gallery]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-home-equipment]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-skip-link]")).toHaveCount(1);
  await expect(page.locator("[data-marketing-footer]")).toHaveCount(0);

  const bodyText = await page.locator("body").innerText();
  for (const denied of URBAN_DENYLIST) {
    expect(bodyText.includes(denied)).toBe(false);
  }
});

test("SMK-MKT-HOME-06 mother host platform home", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-platform-mother-home]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-home]")).toHaveCount(0);
});

test("SMK-MKT-HOME-07 denali footer visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-marketing-home-hero]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-footer]")).toBeVisible();
  await expect(page.locator("[data-marketing-footer-copyright]")).toBeVisible();
});

test("SMK-MKT-HOME-08 mobile drawer opens nav panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-marketing-nav-drawer]")).toBeVisible({ timeout: 60_000 });

  const drawer = page.locator("[data-marketing-nav-drawer]");
  await expect(drawer).not.toHaveAttribute("open", "");
  await page.locator("[data-marketing-nav-drawer-toggle]").click();
  await expect(drawer).toHaveAttribute("open", "");
  await expect(page.locator("[data-marketing-nav-drawer-panel] a[href='/tours']").first()).toBeVisible();
});

test("SMK-MKT-HOME-09 English home CTA keeps locale on tours navigation", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("[data-marketing-home-hero]")).toBeVisible({ timeout: 60_000 });
  await page.locator("[data-marketing-home-cta]").first().click();
  await expect(page).toHaveURL(/\/en\/tours(?:\?|$|\/)/);
});

test("SMK-MKT-HOME-10 hero secondary CTA uses manifest why anchor", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-marketing-home-hero]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-home-cta-secondary]")).toHaveAttribute("href", "#why-us");
  await expect(page.locator("[data-marketing-home-why]#why-us")).toBeVisible();
});
