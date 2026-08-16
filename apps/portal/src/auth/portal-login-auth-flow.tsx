"use client";

import { completeMemberLoginEgress } from "@app-tour/catalog-registration-flow-ui";

import {
  PublicCatalogRegistrationFlow,
  type PublicCatalogRegistrationFlowProps,
} from "@/catalog/public-catalog-registration-flow";

type PortalLoginAuthFlowProps = Omit<
  PublicCatalogRegistrationFlowProps,
  "onAuthenticated" | "onMemberLoginSessionReady" | "memberLoginStayOnPage"
>;

/**
 * Client wrapper for `/login` (server page cannot pass `onAuthenticated`).
 * Auth steps already ran `probeSession` — assign `portalReturn` without a second probe.
 */
export function PortalLoginAuthFlow(props: PortalLoginAuthFlowProps) {
  return (
    <PublicCatalogRegistrationFlow
      {...props}
      memberLoginEgress
      onAuthenticated={() => {
        completeMemberLoginEgress({ memberLoginEgress: true });
      }}
    />
  );
}
