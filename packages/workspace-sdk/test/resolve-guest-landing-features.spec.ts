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
      sections: {
        hero: true,
        latestTours: true,
        latestToursLimit: 6,
        trust: true,
        finalCta: true,
        faq: true,
        footer: true,
        whyDenali: true,
        journey: true,
        testimonials: true,
        featuredTours: true,
        featuredToursLimit: 3,
        categories: true,
        destinations: true,
        heroSearch: true,
        gallery: true,
        equipment: true,
        blogTeaser: false,
      },
      i18nProfile: "full",
    });
  });

  it("SDK-HOME-02 urban minimal landing", () => {
    assert.deepEqual(resolveGuestLandingFeatures("urban"), {
      variant: "minimal",
      sections: {
        hero: false,
        latestTours: false,
        latestToursLimit: 0,
        trust: false,
        finalCta: false,
        faq: false,
        footer: false,
        whyDenali: false,
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
    assert.deepEqual(resolved.sections, manifest.guestLanding?.sections);
  });

  it("SDK-HOME-02b guest-club minimal landing matches manifest", () => {
    const manifest = readManifest("guest-club");
    assert.deepEqual(resolveGuestLandingFeatures("guest-club"), {
      variant: "minimal",
      sections: {
        hero: false,
        latestTours: false,
        latestToursLimit: 0,
        trust: false,
        finalCta: false,
        faq: false,
        footer: false,
        whyDenali: false,
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
    });
    assert.equal(
      resolveGuestLandingFeatures("guest-club").variant,
      manifest.guestLanding?.variant
    );
  });
});
