import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  fetchDenaliCatalogJsonWithSoftRetry,
  isDenaliCatalogHttpSoftFail,
  isDenaliCatalogSoftFail,
} from "../src/ui/adapters/catalog-soft-fail.ts";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("catalog-soft-fail (ED-UX-01 / ED-UX-02)", () => {
  it("DN-CAT-SOFT-01 treats 5xx and 429 as soft-fail", () => {
    assert.equal(isDenaliCatalogHttpSoftFail("TOUR_THEMES_HTTP_503"), true);
    assert.equal(isDenaliCatalogHttpSoftFail("USERS_HTTP_500"), true);
    assert.equal(isDenaliCatalogHttpSoftFail("EQUIPMENT_HTTP_429"), true);
  });

  it("DN-CAT-SOFT-02 leaves 4xx (except 429) hard", () => {
    assert.equal(isDenaliCatalogHttpSoftFail("TOUR_THEMES_HTTP_404"), false);
    assert.equal(isDenaliCatalogHttpSoftFail(null), false);
    assert.equal(isDenaliCatalogHttpSoftFail(""), false);
  });

  it("ED-UX-02 treats network and *_LOAD_FAILED as soft-fail", () => {
    assert.equal(isDenaliCatalogSoftFail("TOUR_THEMES_LOAD_FAILED"), true);
    assert.equal(isDenaliCatalogSoftFail("Failed to fetch"), true);
    assert.equal(isDenaliCatalogSoftFail("TypeError: Failed to fetch"), true);
    assert.equal(isDenaliCatalogSoftFail("NetworkError when attempting to fetch resource."), true);
  });

  it("soft-retries once on 503 then succeeds", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("busy", { status: 503 });
      }
      return Response.json({ ok: true });
    }) as unknown as typeof fetch;
    const payload = await fetchDenaliCatalogJsonWithSoftRetry<{ ok: boolean }>(
      "/api/settings/resources/tour_themes",
      "TOUR_THEMES",
      fetchImpl
    );
    assert.equal(payload.ok, true);
    assert.equal(calls, 2);
  });

  it("does not soft-retry hard 404", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("missing", { status: 404 });
    }) as unknown as typeof fetch;
    await assert.rejects(
      () =>
        fetchDenaliCatalogJsonWithSoftRetry(
          "/api/settings/resources/tour_themes",
          "TOUR_THEMES",
          fetchImpl
        ),
      /TOUR_THEMES_HTTP_404/
    );
    assert.equal(calls, 1);
  });

  it("ED-CAT-RETRY-01 degraded notice exposes retry control", () => {
    const src = readFileSync(join(SRC_ROOT, "ui/components/denali-catalog-load-notice.tsx"), "utf8");
    assert.match(src, /denali-catalog-soft-fail-retry/);
    assert.match(src, /onRetry/);
    assert.match(src, /composites\.catalog\.retry/);
  });

  it("ED-CAT-RETRY-01 catalog pickers pass onRetry={reload}", () => {
    const files = [
      "ui/fields/denali-leader-user-ids-field.tsx",
      "ui/fields/denali-destination-field.tsx",
      "ui/fields/denali-gear-field.tsx",
      "ui/fields/denali-guide-language-ids-field.tsx",
      "ui/fields/denali-program-content-field.tsx",
      "ui/components/denali-itinerary-segment-destination-field.tsx",
    ];
    for (const relative of files) {
      const src = readFileSync(join(SRC_ROOT, relative), "utf8");
      assert.match(src, /onRetry=\{reload\}/, relative);
    }
  });
});

describe("ED-PHOTO-A11Y-01", () => {
  it("upload error alert is outside the file input label", () => {
    const src = readFileSync(join(SRC_ROOT, "ui/fields/denali-photos-field.tsx"), "utf8");
    assert.match(src, /role="alert"/);
    assert.equal(
      /<label[\s\S]*type="file"[\s\S]*role="alert"[\s\S]*<\/label>/.test(src),
      false
    );
  });
});
