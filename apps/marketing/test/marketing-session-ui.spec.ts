import { renderSessionUi, PROFILE_HREF } from "./fixtures/render-session-ui";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { describe, it } from "node:test";
import { MarketingHeaderAccount } from "../src/shell/marketing-header-account";
import { MarketingShellFrame } from "../src/shell/marketing-shell-frame";
import { CatalogTourDetailRegisterCta } from "../src/catalog/catalog-tour-detail-register-cta";
import { resolveMarketingTourDetailCtaModel } from "../src/catalog/resolve-marketing-tour-detail-cta";
import type { CatalogTourRegistrationState } from "../src/catalog/resolve-catalog-tour-registration-state";

const registration: CatalogTourRegistrationState = {
  registrationUrl: "https://portal.example.test/catalog/tour/register",
  state: "open",
  canRegister: true,
  canJoinWaitlist: false,
  isSoldOut: false,
};
const selfHref = "https://portal.example.test/me/registrations/self";
function ctaHtml(authenticated: boolean, serverMember: boolean, state = registration) {
  const cta = resolveMarketingTourDetailCtaModel({
    registrationUrl: state.registrationUrl,
    tourSignInUrl: "/login",
    canRegister: state.canRegister,
    canJoinWaitlist: state.canJoinWaitlist,
    memberSessionReadable: serverMember,
    selfRegistrationDetailUrl: serverMember ? selfHref : null,
  });
  return renderSessionUi(
    h(CatalogTourDetailRegisterCta, {
      registration: state,
      cta,
      variant: "primary",
      tourId: "tour",
      tourTitle: "Test tour",
    }),
    authenticated
  );
}

describe("committed portal status overrides stale marketing auth UI", () => {
  it("removes an old member header and name immediately after confirmed logout", () => {
    const html = renderSessionUi(
      h(MarketingShellFrame, {
        initiallyAuthenticated: true,
        children: h(MarketingHeaderAccount, {
          memberHeader: { displayName: "Old SSR name", profileHref: PROFILE_HREF, avatarUrl: null },
          loginHref: "/login",
          variant: "toolbar",
        }),
      }),
      false
    );
    assert.doesNotMatch(html, /data-marketing-member-authenticated|Old SSR name/);
    assert.match(html, /data-marketing-header-sign-in/);
  });
  it("shows the account link when login is confirmed before the server snapshot arrives", () => {
    const html = renderSessionUi(
      h(MarketingShellFrame, {
        initiallyAuthenticated: false,
        children: h(MarketingHeaderAccount, {
          memberHeader: null,
          loginHref: "/login",
          variant: "drawer",
        }),
      }),
      true
    );
    assert.match(html, /data-marketing-member-authenticated/);
    assert.ok(html.includes(`href="${PROFILE_HREF}"`));
    assert.doesNotMatch(html, /data-marketing-header-sign-in/);
  });
  it("replaces stale self-registration actions with guest modal actions after logout", () => {
    const html = ctaHtml(false, true);
    assert.match(html, /data-marketing-tour-detail-cta-mode="guest"/);
    assert.match(html, /data-marketing-tour-sign-in/);
    assert.doesNotMatch(html, /data-marketing-view-registration|data-marketing-register-another/);
    assert.ok(!html.includes(selfHref));
  });
  it("sends a confirmed member to portal intake without a second login", () => {
    const html = ctaHtml(true, false);
    assert.match(html, /data-marketing-tour-detail-cta-mode="member-continue"/);
    assert.ok(html.includes(`href="${registration.registrationUrl}"`));
    assert.doesNotMatch(html, /data-marketing-register-modal|data-marketing-tour-sign-in/);
  });
  it("preserves the current member's self-registration link for a closed tour", () => {
    const html = ctaHtml(true, true, {
      ...registration,
      state: "closed",
      canRegister: false,
      isSoldOut: true,
    });
    assert.match(html, /data-marketing-view-registration/);
    assert.ok(html.includes(selfHref));
    assert.doesNotMatch(html, /data-marketing-catalog-detail-sold-out/);
  });
  it("does not retain private self-registration actions on a closed tour after logout", () => {
    const html = ctaHtml(false, true, {
      ...registration,
      state: "closed",
      canRegister: false,
      isSoldOut: true,
    });
    assert.match(html, /data-marketing-catalog-detail-sold-out/);
    assert.doesNotMatch(html, /data-marketing-view-registration/);
  });
  it("keeps waitlist intake on portal for an authenticated member", () => {
    const state = {
      ...registration,
      state: "waitlist" as const,
      canRegister: false,
      canJoinWaitlist: true,
      isSoldOut: true,
    };
    const html = ctaHtml(true, false, state);
    assert.ok(html.includes(`href="${registration.registrationUrl}"`));
    assert.doesNotMatch(html, /data-marketing-register-modal|data-marketing-tour-sign-in/);
  });
});
