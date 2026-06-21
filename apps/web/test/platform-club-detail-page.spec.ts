import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform club detail page", () => {
  it("loads detail client", () => {
    const page = readFileSync(
      new URL("../app/(platform)/platform/clubs/[id]/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(page, /PlatformClubDetailClient/);
    assert.match(page, /proxyPlatformApi/);
    assert.match(page, /notFound/);
  });

  it("detail client has tabs", () => {
    const client = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail-client.tsx", import.meta.url),
      "utf8"
    );
    assert.match(client, /overview/);
    assert.match(client, /sites/);
    assert.match(client, /owner/);
    assert.match(client, /actions/);
    assert.match(client, /patchStatus/);
    assert.match(client, /resendInvite/);
    assert.match(client, /data-tab-button/);
    assert.match(client, /data-action-suspend/);
    assert.match(client, /data-client-ready/);
  });
});
