export type MarketingTourDetailCtaMode = "guest" | "member-continue" | "member-self";

export type MarketingTourDetailCtaPrimaryKind = "register" | "continue" | "view-self";

export type MarketingTourDetailCtaSecondaryKind = "sign-in" | "register-another";

export type MarketingTourDetailCtaModel = {
  readonly mode: MarketingTourDetailCtaMode;
  readonly primaryHref: string | null;
  readonly primaryKind: MarketingTourDetailCtaPrimaryKind | null;
  readonly secondaryHref: string | null;
  readonly secondaryKind: MarketingTourDetailCtaSecondaryKind | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pure PDP CTA matrix (PCMS §5.3). Fetch/session live in the server wrapper.
 */
export function resolveMarketingTourDetailCtaModel(input: {
  readonly registrationUrl: string | null;
  readonly tourSignInUrl: string | null;
  readonly canRegister: boolean;
  readonly memberSessionReadable: boolean;
  readonly selfRegistrationDetailUrl: string | null;
}): MarketingTourDetailCtaModel {
  const registrationUrl = trimOrNull(input.registrationUrl);
  const tourSignInUrl = trimOrNull(input.tourSignInUrl);
  const selfUrl = trimOrNull(input.selfRegistrationDetailUrl);

  if (input.memberSessionReadable && selfUrl !== null) {
    const canAddAnother = input.canRegister && registrationUrl !== null;
    return Object.freeze({
      mode: "member-self",
      primaryHref: selfUrl,
      primaryKind: "view-self",
      secondaryHref: canAddAnother ? registrationUrl : null,
      secondaryKind: canAddAnother ? "register-another" : null,
    });
  }

  if (input.memberSessionReadable) {
    if (!input.canRegister || registrationUrl === null) {
      return Object.freeze({
        mode: "member-continue",
        primaryHref: null,
        primaryKind: null,
        secondaryHref: null,
        secondaryKind: null,
      });
    }
    return Object.freeze({
      mode: "member-continue",
      primaryHref: registrationUrl,
      primaryKind: "continue",
      secondaryHref: null,
      secondaryKind: null,
    });
  }

  if (!input.canRegister || registrationUrl === null) {
    return Object.freeze({
      mode: "guest",
      primaryHref: null,
      primaryKind: null,
      secondaryHref: null,
      secondaryKind: null,
    });
  }

  return Object.freeze({
    mode: "guest",
    primaryHref: registrationUrl,
    primaryKind: "register",
    secondaryHref: tourSignInUrl,
    secondaryKind: tourSignInUrl !== null ? "sign-in" : null,
  });
}
