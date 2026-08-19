/**
 * Phase 5 regression — hydration-safe price, participant identity, success styling,
 * sticky/responsive contracts, and tablet composition.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const denaliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stepsPath = join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx");
const cssPath = join(denaliRoot, "theme/portal/registration-ledger.css");

describe("Phase 5 regression", () => {
  const steps = readFileSync(stepsPath, "utf8");
  const css = readFileSync(cssPath, "utf8");

  it("P5-HYD-01 price uses explicit locale, never bare toLocaleString()", () => {
    assert.doesNotMatch(
      steps,
      /\.toLocaleString\(\s*\)/,
      "bare toLocaleString() without locale arg causes SSR/client hydration mismatch"
    );
    assert.match(steps, /toLocaleString\(priceLocale\)/);
    assert.match(steps, /useLocale/);
  });

  it("P5-ID-01 unnamed guest always renders h3 with guestCardTitle", () => {
    assert.match(
      steps,
      /guestCardTitle.*index:\s*guestIdx\s*\+\s*1/s,
      "unnamed guest heading must use guestCardTitle with 1-indexed label"
    );
    assert.doesNotMatch(
      steps,
      /guestName\.length > 0 \?\s*\n\s*<h3[^>]*>{guestName}<\/h3>\s*\n\s*\) : null/,
      "must not conditionally hide h3 when guestName is empty"
    );
  });

  it("P5-ID-02 self section renders myselfTag", () => {
    assert.match(steps, /data-denali-self-tag/);
    assert.match(steps, /myselfTag/);
  });

  it("P5-ID-03 summary rail uses guestCardTitle for unnamed guests, not unnamedPerson", () => {
    const summarySection = steps.slice(steps.indexOf("data-denali-ledger-people"));
    assert.match(summarySection, /guestCardTitle/);
  });

  it("P5-PROG-01 progress indicator renders stageEyebrow + partyCount", () => {
    assert.match(steps, /data-denali-intake-progress/);
    assert.match(steps, /stageEyebrow/);
    assert.match(steps, /partyCount/);
  });

  it("P5-SUC-01 success primary CTA uses forest !important to beat cascade", () => {
    const successPrimary = css.includes("[data-denali-success-primary]");
    assert.ok(successPrimary, "success-primary selector must exist in ledger CSS");
    assert.match(css, /data-denali-success-primary[\s\S]*?background:\s*var\(--denali-ledger-forest\)\s*!important/);
    assert.match(css, /data-denali-success-primary[\s\S]*?color:\s*#fff\s*!important/);
  });

  it("P5-RSP-01 tablet stacks at 768, not 700", () => {
    assert.match(css, /@media\s*\(max-width:\s*768px\)/);
    assert.doesNotMatch(css, /@media\s*\(max-width:\s*700px\)/);
  });

  it("P5-RSP-02 cascade lock grid at min-width 769", () => {
    assert.match(css, /@media\s*\(min-width:\s*769px\)/);
    assert.doesNotMatch(css, /@media\s*\(min-width:\s*701px\)/);
  });

  it("P5-STK-01 scroll-padding-bottom set for mobile sticky reservation", () => {
    assert.match(css, /scroll-padding-bottom/);
  });

  it("P5-STK-02 focusin keyboard hide is wired into form effect", () => {
    assert.match(steps, /focusin/);
    assert.match(steps, /focusout/);
    assert.match(steps, /data-denali-keyboard-open/);
  });

  it("P5-PRC-01 price chip cascade lock removes login-page chrome", () => {
    assert.match(css, /data-registration-price-hint[\s\S]*?background:\s*none\s*!important/);
    assert.match(css, /data-registration-price-hint[\s\S]*?border:\s*0\s*!important/);
  });
});
