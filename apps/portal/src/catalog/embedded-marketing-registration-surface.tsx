"use client";

import type {
  FlowRuntimeState,
  PublicCatalogTransportSnapshot,
} from "@app-tour/workspace-sdk";

import { PublicCatalogRegistrationFlow } from "@/catalog/public-catalog-registration-flow";

type EmbeddedMarketingRegistrationSurfaceProps = {
  readonly workspace: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly tourPoliciesText?: string | null;
  readonly tourPriceAmount?: number | null;
  readonly tourTransport?: PublicCatalogTransportSnapshot;
  readonly tourNationalIdRequired?: boolean;
  readonly tourFatherNameRequired?: boolean;
  readonly tourBirthDateRequired?: boolean;
  readonly backHref: string;
  readonly memberModuleHref: string | null;
  readonly initialRuntimeState?: FlowRuntimeState;
  readonly existingSelfRegistrationId?: string | null;
  readonly mode: "login-egress" | "resume";
};

function reloadEmbeddedRegistrationRoute(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("auth");
  window.location.replace(`${url.pathname}${url.search}`);
}

export function EmbeddedMarketingRegistrationSurface({
  workspace,
  tenantId,
  tourId,
  tourTitle,
  tourPoliciesText = null,
  tourPriceAmount = null,
  tourTransport,
  tourNationalIdRequired = false,
  tourFatherNameRequired = false,
  tourBirthDateRequired = false,
  backHref,
  memberModuleHref,
  initialRuntimeState,
  existingSelfRegistrationId = null,
  mode,
}: EmbeddedMarketingRegistrationSurfaceProps) {
  if (mode === "login-egress") {
    return (
      <PublicCatalogRegistrationFlow
        workspace={workspace}
        tenantId={tenantId}
        tourId={tourId}
        tourTitle={tourTitle}
        tourPoliciesText={tourPoliciesText}
        tourPriceAmount={tourPriceAmount}
        tourTransport={tourTransport}
        tourNationalIdRequired={tourNationalIdRequired}
        tourFatherNameRequired={tourFatherNameRequired}
        tourBirthDateRequired={tourBirthDateRequired}
        backHref={backHref}
        memberModuleHref={memberModuleHref}
        memberLoginEgress
        memberLoginStayOnPage
        onMemberLoginSessionReady={reloadEmbeddedRegistrationRoute}
      />
    );
  }

  return (
    <PublicCatalogRegistrationFlow
      workspace={workspace}
      tenantId={tenantId}
      tourId={tourId}
      tourTitle={tourTitle}
      tourPoliciesText={tourPoliciesText}
      tourPriceAmount={tourPriceAmount}
      tourTransport={tourTransport}
      tourNationalIdRequired={tourNationalIdRequired}
      tourFatherNameRequired={tourFatherNameRequired}
      tourBirthDateRequired={tourBirthDateRequired}
      backHref={backHref}
      memberModuleHref={memberModuleHref}
      initialRuntimeState={initialRuntimeState}
      existingSelfRegistrationId={existingSelfRegistrationId}
    />
  );
}
