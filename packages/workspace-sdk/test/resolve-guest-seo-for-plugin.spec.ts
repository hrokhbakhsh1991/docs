import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GuestSeoNotConfiguredError,
  resolveGuestSeoForPlugin,
} from "../src/catalog/resolve-guest-seo-for-plugin";

describe("resolveGuestSeoForPlugin", () => {
  it("SDK-SEO-10 resolves denali guest SEO policy from manifest codegen", () => {
    const config = resolveGuestSeoForPlugin("denali");
    assert.equal(config.marketing.jsonLd.required, true);
    assert.deepEqual(config.marketing.jsonLd.schemaTypes, ["TouristTrip"]);
    assert.equal(config.marketing.jsonLd.builderExport, "buildDenaliTouristTripJsonLd");
    assert.equal(config.marketing.pagination?.noindexQueryParams?.includes("cursor"), true);
  });

  it("SDK-SEO-11 resolves urban Event JSON-LD policy", () => {
    const config = resolveGuestSeoForPlugin("urban");
    assert.deepEqual(config.marketing.jsonLd.schemaTypes, ["Event"]);
    assert.equal(config.marketing.jsonLd.builderExport, "buildUrbanEventJsonLd");
  });

  it("SDK-SEO-12 fails closed for unknown plugin id", () => {
    assert.throws(
      () => resolveGuestSeoForPlugin("starter"),
      (error: unknown) => error instanceof GuestSeoNotConfiguredError
    );
  });
});
