import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMarketingTourDetailCtaModel } from "../src/catalog/resolve-marketing-tour-detail-cta";

const registerUrl = "http://portal.denali.club:3003/catalog/tour-1/register";
const signInUrl = `${registerUrl}?auth=login`;
const selfUrl = "http://portal.denali.club:3003/me/registrations/reg-1";

describe("resolveMarketingTourDetailCtaModel — Phase 3 PDP matrix", () => {
  it("MKT-PCMS-P3-01 guest keeps register + sign-in", () => {
    assert.deepEqual(
      resolveMarketingTourDetailCtaModel({
        registrationUrl: registerUrl,
        tourSignInUrl: signInUrl,
        canRegister: true,
        memberSessionReadable: false,
        selfRegistrationDetailUrl: null,
      }),
      {
        mode: "guest",
        primaryHref: registerUrl,
        primaryKind: "register",
        secondaryHref: signInUrl,
        secondaryKind: "sign-in",
      }
    );
  });

  it("MKT-PCMS-P3-02 member without self hides sign-in", () => {
    const cta = resolveMarketingTourDetailCtaModel({
      registrationUrl: registerUrl,
      tourSignInUrl: signInUrl,
      canRegister: true,
      memberSessionReadable: true,
      selfRegistrationDetailUrl: null,
    });
    assert.equal(cta.mode, "member-continue");
    assert.equal(cta.primaryKind, "continue");
    assert.equal(cta.primaryHref, registerUrl);
    assert.equal(cta.secondaryKind, null);
    assert.equal(cta.secondaryHref, null);
  });

  it("MKT-PCMS-P3-03 member with self views detail and may register another", () => {
    const cta = resolveMarketingTourDetailCtaModel({
      registrationUrl: registerUrl,
      tourSignInUrl: signInUrl,
      canRegister: true,
      memberSessionReadable: true,
      selfRegistrationDetailUrl: selfUrl,
    });
    assert.equal(cta.mode, "member-self");
    assert.equal(cta.primaryKind, "view-self");
    assert.equal(cta.primaryHref, selfUrl);
    assert.equal(cta.secondaryKind, "register-another");
    assert.equal(cta.secondaryHref, registerUrl);
    assert.doesNotMatch(cta.secondaryHref ?? "", /auth=login/);
  });

  it("MKT-PCMS-P3-04 sold-out member-self omits register-another", () => {
    const cta = resolveMarketingTourDetailCtaModel({
      registrationUrl: registerUrl,
      tourSignInUrl: signInUrl,
      canRegister: false,
      memberSessionReadable: true,
      selfRegistrationDetailUrl: selfUrl,
    });
    assert.equal(cta.mode, "member-self");
    assert.equal(cta.primaryHref, selfUrl);
    assert.equal(cta.secondaryKind, null);
  });

  it("MKT-PCMS-P3-05 guest sold-out has no hrefs", () => {
    const cta = resolveMarketingTourDetailCtaModel({
      registrationUrl: registerUrl,
      tourSignInUrl: signInUrl,
      canRegister: false,
      memberSessionReadable: false,
      selfRegistrationDetailUrl: null,
    });
    assert.equal(cta.mode, "guest");
    assert.equal(cta.primaryHref, null);
    assert.equal(cta.secondaryKind, null);
  });
});
