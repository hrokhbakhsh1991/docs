import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { describe, it } from "node:test";

import {
  resolveCommercialPricingMemberUserId,
  resolveCommercialPricingWorkspace,
  settleWithConcurrency,
} from "./commercial-pricing-preview.routes";

function request(url: string): IncomingMessage {
  return { url } as IncomingMessage;
}

describe("commercial pricing workspace binding", () => {
  it("BUG-STG-022 applies membership discount only to the self participant", () => {
    assert.equal(resolveCommercialPricingMemberUserId("self", "member-1"), "member-1");
    assert.equal(resolveCommercialPricingMemberUserId("other", "member-1"), null);
  });

  it("resolves an omitted workspace from the tenant for both route shapes", async () => {
    const resolver = async () => "denali";

    assert.equal(
      await resolveCommercialPricingWorkspace(
        request("/catalog/pricing-preview"),
        "tenant-denali",
        resolver
      ),
      "denali"
    );
    assert.equal(
      await resolveCommercialPricingWorkspace(
        request("/catalog/pricing-previews"),
        "tenant-denali",
        resolver
      ),
      "denali"
    );
  });

  it("accepts matching and case-variant compatibility queries", async () => {
    const resolver = async () => "denali";

    assert.equal(
      await resolveCommercialPricingWorkspace(
        request("/catalog/pricing-preview?workspace=denali"),
        "tenant-denali",
        resolver
      ),
      "denali"
    );
    assert.equal(
      await resolveCommercialPricingWorkspace(
        request("/catalog/pricing-previews?workspace=%20DeNaLi%20"),
        "tenant-denali",
        resolver
      ),
      "denali"
    );
  });

  it("uses a non-Denali tenant workspace when the query is omitted", async () => {
    const resolver = async () => "urban";

    assert.equal(
      await resolveCommercialPricingWorkspace(
        request("/catalog/pricing-preview"),
        "tenant-urban",
        resolver
      ),
      "urban"
    );
    assert.equal(
      await resolveCommercialPricingWorkspace(
        request("/catalog/pricing-previews"),
        "tenant-urban",
        resolver
      ),
      "urban"
    );
  });

  it("rejects mismatched compatibility queries before binding resolution", async () => {
    let resolverCalls = 0;
    const resolver = async () => {
      resolverCalls += 1;
      return "urban";
    };

    assert.equal(
      await resolveCommercialPricingWorkspace(
        request("/catalog/pricing-preview?workspace=denali"),
        "tenant-urban",
        resolver
      ),
      null
    );
    assert.equal(
      await resolveCommercialPricingWorkspace(
        request("/catalog/pricing-previews?workspace=denali"),
        "tenant-urban",
        resolver
      ),
      null
    );
    assert.equal(resolverCalls, 2);
  });

  it("fails closed for an unknown tenant workspace", async () => {
    await assert.rejects(
      resolveCommercialPricingWorkspace(
        request("/catalog/pricing-preview"),
        "tenant-unknown",
        async () => {
          throw new Error("WORKSPACE_TYPE_UNRESOLVED:tenant-unknown");
        }
      ),
      /WORKSPACE_TYPE_UNRESOLVED/
    );
  });

  it("keeps both handlers tenant-scoped and removes the Denali fallback", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./commercial-pricing-preview.routes.ts", import.meta.url), "utf8")
    );

    assert.match(
      source,
      /handleCatalogCommercialPricingPreview[\s\S]*resolveCommercialPricingWorkspace/
    );
    assert.match(
      source,
      /handleCatalogCommercialPricingPreviews[\s\S]*resolveCommercialPricingWorkspace/
    );
    assert.match(source, /getById\(input\.tourId, input\.tenantId\)/);
    assert.match(source, /tenantId: auth\.tenantId/);
    assert.doesNotMatch(source, /(?:\|\||\?\?)\s*["']denali["']/);
  });

  it("BUG-STG-081 bounds batch pricing resolution to avoid order-dependent preview loss", async () => {
    let active = 0;
    let peak = 0;
    const settled = await settleWithConcurrency(["a", "b", "c", "d", "e"], async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return value.toUpperCase();
    }, 2);

    assert.equal(peak, 2);
    assert.deepEqual(
      settled.map((result) => (result.status === "fulfilled" ? result.value : result.reason)),
      ["A", "B", "C", "D", "E"]
    );

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./commercial-pricing-preview.routes.ts", import.meta.url), "utf8")
    );

    assert.match(source, /settleWithConcurrency/);
    assert.match(source, /concurrency = 4/);
    assert.match(source, /settleWithConcurrency\(tourIds/);
  });
});
