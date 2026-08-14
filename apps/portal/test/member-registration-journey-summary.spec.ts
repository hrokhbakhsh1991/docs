import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MemberRegistrationJourneySummary } from "../src/me/member-registration-journey-summary";

function renderSummary(input: {
  readonly status: string;
  readonly paymentStatus: string;
  readonly translateHint?: (key: string) => string;
}): string {
  return renderToStaticMarkup(
    createElement(MemberRegistrationJourneySummary, {
      status: input.status,
      paymentStatus: input.paymentStatus,
      translateLabel: (key: string) => `label:${key}`,
      translateHint: input.translateHint,
    })
  );
}

describe("MemberRegistrationJourneySummary", () => {
  it("keeps approved registrations distinct by settlement state", () => {
    const unpaid = renderSummary({
      status: "approved",
      paymentStatus: "unpaid",
      translateHint: (key) => `hint:${key}`,
    });
    const partial = renderSummary({
      status: "approved",
      paymentStatus: "partial",
    });

    assert.match(unpaid, /data-journey-state="approved_unpaid"/);
    assert.match(unpaid, />label:approved_unpaid</);
    assert.match(unpaid, />hint:approved_unpaid</);
    assert.match(partial, /data-journey-state="approved_partial"/);
    assert.match(partial, />label:approved_partial</);
  });

  it("omits the summary when the lifecycle state is unknown", () => {
    const html = renderSummary({
      status: "archived",
      paymentStatus: "paid",
    });

    assert.equal(html, "");
  });

  it("omits the summary when approved settlement state is unknown", () => {
    const html = renderSummary({
      status: "approved",
      paymentStatus: "refunded",
    });

    assert.equal(html, "");
  });
});
