import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveDenaliOptionalEmptyReason } from "../src/ui/logic/denali-optional-empty";
import { filterIdsToAllowedCatalog } from "../src/wizard/denali-wizard-catalog-sanitize";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");
const MESSAGES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../messages");

describe("denali-optional-empty.spec.ts (ED-EMPTY-OPT-01)", () => {
  it("DN-EMPTY-OPT-01 degraded catalog and operator skip show optional empty", () => {
    assert.equal(
      resolveDenaliOptionalEmptyReason({
        loading: true,
        error: null,
        catalogItemCount: 0,
        selectedCount: 0,
      }),
      null
    );
    assert.equal(
      resolveDenaliOptionalEmptyReason({
        loading: false,
        error: "GUIDE_LANGUAGES_HTTP_503",
        catalogItemCount: 0,
        selectedCount: 0,
      }),
      "degraded"
    );
    assert.equal(
      resolveDenaliOptionalEmptyReason({
        loading: false,
        error: "GUIDE_LANGUAGES_HTTP_404",
        catalogItemCount: 0,
        selectedCount: 0,
      }),
      null
    );
    assert.equal(
      resolveDenaliOptionalEmptyReason({
        loading: false,
        error: null,
        catalogItemCount: 0,
        selectedCount: 0,
      }),
      "catalog_empty"
    );
    assert.equal(
      resolveDenaliOptionalEmptyReason({
        loading: false,
        error: null,
        catalogItemCount: 3,
        selectedCount: 0,
      }),
      "operator_skip"
    );
    assert.equal(
      resolveDenaliOptionalEmptyReason({
        loading: false,
        error: null,
        catalogItemCount: 3,
        selectedCount: 1,
      }),
      null
    );
  });

  it("DN-EMPTY-OPT-02 optional empty notice is status, never alert", () => {
    const notice = readFileSync(
      join(SRC_ROOT, "ui/components/denali-optional-empty-notice.tsx"),
      "utf8"
    );
    assert.match(notice, /role="status"/);
    assert.equal(/role="alert"/.test(notice), false);
    assert.match(notice, /data-operator-optional-empty/);

    const gear = readFileSync(join(SRC_ROOT, "ui/fields/denali-gear-field.tsx"), "utf8");
    const languages = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-guide-language-ids-field.tsx"),
      "utf8"
    );
    assert.match(gear, /DenaliOptionalEmptyNotice/);
    assert.match(gear, /DENALI_GEAR_TEST_IDS\.optionalEmpty/);
    assert.match(languages, /DenaliOptionalEmptyNotice/);
    assert.match(languages, /DENALI_GUIDE_LANGUAGES_TEST_IDS\.optionalEmpty/);
  });

  it("DN-EMPTY-OPT-03 empty arrays survive catalog-miss sanitize (save not blocked)", () => {
    assert.deepEqual(filterIdsToAllowedCatalog([], undefined), []);
    assert.deepEqual(filterIdsToAllowedCatalog(["kept"], undefined), ["kept"]);
  });

  it("ED-EMPTY-OPT-01 i18n says skip does not block save", () => {
    const fa = JSON.parse(readFileSync(join(MESSAGES_ROOT, "fa/wizard.json"), "utf8")) as {
      composites: {
        catalog: { optionalEmpty: string };
        gear: { optionalEmpty: string };
        guideLanguages: { optionalEmpty: string };
        tourServices: { emptyBucket: string };
      };
      review: { optionalEmpty: string };
    };
    const en = JSON.parse(readFileSync(join(MESSAGES_ROOT, "en/wizard.json"), "utf8")) as {
      composites: {
        catalog: { optionalEmpty: string };
        gear: { optionalEmpty: string };
        guideLanguages: { optionalEmpty: string };
        tourServices: { emptyBucket: string };
      };
      review: { optionalEmpty: string };
    };
    assert.match(fa.composites.catalog.optionalEmpty, /اختیاری/);
    assert.match(fa.composites.catalog.optionalEmpty, /ذخیره/);
    assert.match(fa.composites.gear.optionalEmpty, /اختیاری/);
    assert.match(fa.composites.guideLanguages.optionalEmpty, /اختیاری/);
    assert.match(fa.composites.tourServices.emptyBucket, /مسدود نمی‌کند/);
    assert.match(fa.review.optionalEmpty, /اختیاری/);
    assert.match(en.composites.catalog.optionalEmpty, /optional/i);
    assert.match(en.composites.catalog.optionalEmpty, /save/i);
    assert.match(en.review.optionalEmpty, /optional/i);
  });
});
