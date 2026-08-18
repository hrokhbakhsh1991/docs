import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveGuestLandingFeatures,
  UnknownGuestLandingPluginError,
} from "../src/catalog/resolve-guest-landing-features";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readManifest(pluginId: string) {
  const path = join(
    repoRoot,
    "packages/workspaces",
    pluginId,
    "workspace.manifest.json"
  );
  return JSON.parse(readFileSync(path, "utf8")) as {
    guestLanding?: {
      variant: string;
      i18nProfile: string;
      sections: Record<string, boolean | number>;
    };
  };
}

describe("resolve-guest-landing-features", () => {
  it("SDK-HOME-01 denali full landing with latest limit 6", () => {
    assert.deepEqual(resolveGuestLandingFeatures("denali"), {
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
        journey: false,
        testimonials: false,
        featuredTours: true,
        featuredToursLimit: 3,
        categories: true,
        destinations: true,
        heroSearch: true,
        gallery: true,
        equipment: false,
        blogTeaser: false,
      },
      i18nProfile: "full",
      shellChrome: Object.freeze({
        localeSwitcher: false,
        headerToursCta: false,
      }),
    });
  });

  it("SDK-HOME-02 urban minimal landing", () => {
    assert.deepEqual(resolveGuestLandingFeatures("urban"), {
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
        featuredTours: false,
        featuredToursLimit: 0,
        categories: false,
        destinations: false,
        heroSearch: false,
        gallery: false,
        equipment: false,
        blogTeaser: false,
      },
      i18nProfile: "minimal",
      shellChrome: Object.freeze({
        localeSwitcher: false,
        headerToursCta: false,
      }),
    });
  });

  it("SDK-HOME-03 unknown plugin fails closed", () => {
    assert.throws(
      () => resolveGuestLandingFeatures("starter"),
      UnknownGuestLandingPluginError
    );
  });

  it("SDK-HOME-01b resolver matches denali workspace.manifest.json", () => {
    const manifest = readManifest("denali");
    const resolved = resolveGuestLandingFeatures("denali");
    assert.equal(resolved.variant, manifest.guestLanding?.variant);
    assert.equal(resolved.i18nProfile, manifest.guestLanding?.i18nProfile);
    assert.equal(resolved.whySectionAnchor, manifest.guestLanding?.whySectionAnchor ?? "why-us");
    assert.deepEqual(resolved.destinationSlugs, manifest.guestLanding?.destinationSlugs ?? []);
    assert.deepEqual(
      resolved.destinationImageStems,
      manifest.guestLanding?.destinationImageStems ?? {}
    );
    assert.deepEqual(resolved.sections, manifest.guestLanding?.sections);
  });

  it("SDK-HOME-02b guest-club minimal landing matches manifest", () => {
    const manifest = readManifest("guest-club");
    assert.deepEqual(resolveGuestLandingFeatures("guest-club"), {
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
        featuredTours: false,
        featuredToursLimit: 0,
        categories: false,
        destinations: false,
        heroSearch: false,
        gallery: false,
        equipment: false,
        blogTeaser: false,
      },
      i18nProfile: "minimal",
      shellChrome: Object.freeze({
        localeSwitcher: false,
        headerToursCta: false,
      }),
    });
    assert.equal(
      resolveGuestLandingFeatures("guest-club").variant,
      manifest.guestLanding?.variant
    );
  });
});
