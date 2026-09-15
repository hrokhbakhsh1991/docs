import type { ReactNode } from "react";
import type { MemberPortalModuleRendererProps } from "@app-tour/workspace-sdk";

import { redirectDeadMemberSession } from "@/me/redirect-dead-member-session.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { fetchMemberWallet } from "./fetch-member-wallet.server";
import { MemberWalletPageContent } from "./member-wallet-page-content";

export async function renderMemberWalletPortalModule(
  _props: MemberPortalModuleRendererProps,
): Promise<ReactNode> {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const walletResult = await fetchMemberWallet(host);

  if (
    walletResult.status === "missing_cookie" ||
    walletResult.status === "unauthenticated"
  ) {
    redirectDeadMemberSession("/me/wallet");
  }

  return (
    <MemberWalletPageContent pluginId={bootstrap.pluginId} walletResult={walletResult} />
  );
}
