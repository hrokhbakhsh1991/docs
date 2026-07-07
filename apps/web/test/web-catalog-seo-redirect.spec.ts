import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("web catalog SEO redirect (SMK-WEB-SEO-01)", () => {
  it("WEB-SEO-01 catalog list and detail use permanentRedirect", () => {
    const listPage = readFileSync(
      join(REPO_ROOT, "apps/web/app/(public)/catalog/page.tsx"),
      "utf8"
    );
    const detailPage = readFileSync(
      join(REPO_ROOT, "apps/web/app/(public)/catalog/[tourId]/page.tsx"),
      "utf8"
    );
    assert.match(listPage, /permanentRedirect/);
    assert.match(detailPage, /permanentRedirect/);
    assert.doesNotMatch(listPage, /\bredirect\(/);
    assert.doesNotMatch(detailPage, /\bredirect\(/);
  });
});
