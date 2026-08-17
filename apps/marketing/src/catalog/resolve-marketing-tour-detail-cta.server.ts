import { sessionTenantMatchesDevCrossSurfaceHost } from "@app-tour/guest-surface-host";

import {
  readMarketingMemberSessionFromCookies,
  readMarketingMemberSessionToken,
} from "@/auth/read-marketing-member-session.server";
import { fetchMarketingMemberSelfRegistrationForTour } from "@/catalog/fetch-marketing-member-self-registration-for-tour.server";
import { resolveWebMemberRegistrationDetailUrl } from "@/portal/resolve-web-registration-url";

import {
  resolveMarketingTourDetailCtaModel,
  type MarketingTourDetailCtaModel,
} from "./resolve-marketing-tour-detail-cta";

export async function resolveMarketingTourDetailCta(input: {
  readonly host: string;
  readonly tenantId: string;
  readonly pluginId: string;
  readonly tourId: string;
  readonly registrationUrl: string | null;
  readonly tourSignInUrl: string | null;
  readonly canRegister: boolean;
}): Promise<MarketingTourDetailCtaModel> {
  const session = await readMarketingMemberSessionFromCookies();
  const memberSessionReadable =
    session !== null &&
    sessionTenantMatchesDevCrossSurfaceHost(session.tenantId, input.host, input.tenantId);

  if (!memberSessionReadable) {
    return resolveMarketingTourDetailCtaModel({
      registrationUrl: input.registrationUrl,
      tourSignInUrl: input.tourSignInUrl,
      canRegister: input.canRegister,
      memberSessionReadable: false,
      selfRegistrationDetailUrl: null,
    });
  }

  const token = await readMarketingMemberSessionToken();
  const self =
    token !== null
      ? await fetchMarketingMemberSelfRegistrationForTour({
          host: input.host,
          tenantId: input.tenantId,
          pluginId: input.pluginId,
          tourId: input.tourId,
          session,
          token,
        })
      : null;

  const selfRegistrationDetailUrl =
    self !== null ? resolveWebMemberRegistrationDetailUrl(input.host, self.id) : null;

  return resolveMarketingTourDetailCtaModel({
    registrationUrl: input.registrationUrl,
    tourSignInUrl: input.tourSignInUrl,
    canRegister: input.canRegister,
    memberSessionReadable: true,
    selfRegistrationDetailUrl,
  });
}
