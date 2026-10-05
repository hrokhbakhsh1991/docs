import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveTourPublishedPdpUrl } from "./resolve-tour-published-pdp-url";

const previousBaseUrl = process.env.MARKETING_PUBLIC_BASE_URL;
const previousAllowlist = process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST;
const previousNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (previousBaseUrl === undefined) delete process.env.MARKETING_PUBLIC_BASE_URL;
  else process.env.MARKETING_PUBLIC_BASE_URL = previousBaseUrl;
  if (previousAllowlist === undefined) delete process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST;
  else process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST = previousAllowlist;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

describe("resolveTourPublishedPdpUrl", () => {
  it("uses the configured public marketing origin and encodes the tour id", async () => {
    process.env.MARKETING_PUBLIC_BASE_URL = "https://denali.shenski.com/";

    assert.equal(
      await resolveTourPublishedPdpUrl({
        tenantId: "00000000-0000-4000-8000-000000000003",
        tourId: "tour/with spaces",
      }),
      "https://denali.shenski.com/tours/tour%2Fwith%20spaces"
    );
  });

  it("fails closed when the tenant cannot be resolved", async () => {
    process.env.MARKETING_PUBLIC_BASE_URL = "https://denali.shenski.com";

    assert.equal(
      await resolveTourPublishedPdpUrl({
        tenantId: "00000000-0000-4000-8000-000000009999",
        tourId: "tour-1",
      }),
      null
    );
  });

  it("rejects an unallowlisted production marketing origin", async () => {
    process.env.NODE_ENV = "production";
    process.env.MARKETING_PUBLIC_BASE_URL = "https://evil.example.com";
    process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST = "https://denali.shenski.com";

    assert.equal(
      await resolveTourPublishedPdpUrl({
        tenantId: "00000000-0000-4000-8000-000000000003",
        tourId: "tour-1",
      }),
      null
    );
  });
});
