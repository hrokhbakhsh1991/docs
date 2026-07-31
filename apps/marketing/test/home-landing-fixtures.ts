/** Shared guestLanding fixtures for marketing home unit tests. */
import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

export const PR7_SECTIONS_OFF = {
  featuredTours: false,
  featuredToursLimit: 0,
  categories: false,
  destinations: false,
  heroSearch: false,
} as const;

export const PR7_SECTIONS_ON = {
  featuredTours: true,
  featuredToursLimit: 3,
  categories: true,
  destinations: true,
  heroSearch: true,
} as const;

export const PR8_SECTIONS_OFF = {
  gallery: false,
  equipment: false,
  blogTeaser: false,
} as const;

export const PR8_SECTIONS_ON = {
  gallery: true,
  equipment: true,
  blogTeaser: false,
} as const;

export const FULL_LANDING: GuestLandingFeatures = {
  variant: "full",
  whySectionAnchor: "why-us",
  destinationSlugs: ["alborz", "damavand", "zardkuh"],
  destinationImageStems: { zardkuh: "zardkooh" },
  sections: {
    hero: true,
    latestTours: true,
    latestToursLimit: 6,
    trust: true,
    finalCta: true,
    faq: true,
    footer: true,
    whySection: true,
    journey: true,
    testimonials: true,
    ...PR7_SECTIONS_OFF,
    ...PR8_SECTIONS_OFF,
  },
  i18nProfile: "full",
  shellChrome: { localeSwitcher: false, headerToursCta: false },
};

export const MINIMAL_LANDING: GuestLandingFeatures = {
  variant: "minimal",
  whySectionAnchor: "why-us",
  destinationSlugs: [],
  destinationImageStems: {},
  sections: {
    hero: false,
    latestTours: false,
    latestToursLimit: 0,
    trust: false,
    finalCta: false,
    faq: false,
    footer: false,
    whySection: false,
    journey: false,
    testimonials: false,
    ...PR7_SECTIONS_OFF,
    ...PR8_SECTIONS_OFF,
  },
  i18nProfile: "minimal",
  shellChrome: { localeSwitcher: false, headerToursCta: false },
};

export const DISCOVERY_LANDING: GuestLandingFeatures = {
  variant: "full",
  whySectionAnchor: "why-us",
  destinationSlugs: ["alborz", "damavand", "zardkuh"],
  destinationImageStems: { zardkuh: "zardkooh" },
  sections: {
    hero: true,
    latestTours: true,
    latestToursLimit: 6,
    trust: false,
    finalCta: false,
    faq: false,
    footer: false,
    whySection: false,
    journey: false,
    testimonials: false,
    ...PR7_SECTIONS_ON,
    ...PR8_SECTIONS_OFF,
  },
  i18nProfile: "full",
  shellChrome: { localeSwitcher: false, headerToursCta: false },
};

export const PREMIUM_LANDING: GuestLandingFeatures = {
  variant: "full",
  whySectionAnchor: "why-us",
  destinationSlugs: ["alborz", "damavand", "zardkuh"],
  destinationImageStems: { zardkuh: "zardkooh" },
  sections: {
    hero: true,
    latestTours: true,
    latestToursLimit: 6,
    trust: true,
    finalCta: true,
    faq: true,
    footer: true,
    whySection: true,
    journey: true,
    testimonials: true,
    ...PR7_SECTIONS_ON,
    ...PR8_SECTIONS_ON,
  },
  i18nProfile: "full",
  shellChrome: { localeSwitcher: false, headerToursCta: false },
};
