import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("bookings-list-server-prefetch.spec.ts", () => {
  it("BOOKINGS-01 bookings page prefetches list on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/bookings/page.tsx"), "utf8");
    assert.match(pageSource, /fetchBookingsServerPrefetch/);
    assert.match(pageSource, /initialPrefetch/);
  });

  it("BOOKINGS-02 bookings client skips first fetch when initialPrefetch is provided", () => {
    const entrySource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/bookings/bookings-page-client.tsx"),
      "utf8"
    );
    assert.match(entrySource, /bookings-command-center-shell/);
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/bookings-command-center-shell.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialPrefetch/);
    assert.match(clientSource, /skipInitialFetchRef/);
  });
});
