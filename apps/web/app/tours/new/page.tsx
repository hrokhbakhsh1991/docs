import { cookies } from "next/headers";
import { decodeJwtPayload } from "@app-tour/session-client";
import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { getTranslations } from "next-intl/server";

import { fetchOperatorProfileServer } from "@/features/settings/fetch-operator-profile.server";
import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchWizardLocationsServer } from "@/tours/fetch-wizard-locations.server";
import { fetchWizardTemplateServer } from "@/tours/fetch-wizard-template.server";

import { NewTourWizardClient } from "./new-tour-wizard-client";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("wizard");
  return {
    title: t("pageTitle"),
  };
}

export default async function NewTourPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ clone?: string | string[] }>;
}) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const rawSession = (await cookies()).get(SESSION_TOKEN_COOKIE)?.value;
  const claims = rawSession ? decodeJwtPayload(rawSession) : null;
  // The existing Settings BFF is owner-only at the web middleware boundary.
  const candidate =
    session.role === "owner" &&
    claims !== null &&
    claims.platform_impersonation_readonly !== true &&
    (await searchParams).clone === undefined;
  const [initialTemplateResponse, initialLocationsResponse, verifiedProfile] = await Promise.all([
    fetchWizardTemplateServer(),
    fetchWizardLocationsServer(),
    // Cookie claims alone are not enough to expose this new write affordance.
    candidate ? fetchOperatorProfileServer() : Promise.resolve(null),
  ]);
  const canQuickAddCatalog =
    verifiedProfile !== null &&
    verifiedProfile.userId === session.userId &&
    verifiedProfile.tenantId === session.tenantId &&
    verifiedProfile.status === "ACTIVE" &&
    verifiedProfile.role === "owner";

  return (
    <NewTourWizardClient
      key={JSON.stringify([session.tenantId, session.userId, verifiedProfile?.workspaceId ?? null])}
      canQuickAddCatalog={canQuickAddCatalog}
      initialTemplateResponse={initialTemplateResponse}
      initialLocationsResponse={initialLocationsResponse}
    />
  );
}
