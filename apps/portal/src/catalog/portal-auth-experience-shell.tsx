import type { ReactNode } from "react";

import { PortalRegistrationChrome } from "@/catalog/portal-registration-chrome";
import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

export type PortalAuthExperienceShellProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly backHref: string;
  readonly heroTitle: string;
  readonly heroLede?: string | null;
  readonly sessionBadge?: string | null;
  readonly memberLoginEgress?: boolean;
  readonly pageKind: "login" | "registration";
  readonly workspace: string;
  readonly mainAttributes?: Record<string, string>;
  readonly children: ReactNode;
};

/** Shared Denali auth shell — login + catalog registration OTP steps (PS-VIS / PCMS-03). */
export function PortalAuthExperienceShell({
  branding,
  backHref,
  heroTitle,
  heroLede = null,
  sessionBadge = null,
  memberLoginEgress = false,
  pageKind,
  workspace,
  mainAttributes,
  children,
}: PortalAuthExperienceShellProps) {
  return (
    <main
      data-portal-auth-experience
      data-portal-auth-experience-page={pageKind}
      data-workspace={workspace}
      {...(pageKind === "login"
        ? { "data-portal-member-login-page": "", "data-member-login-egress": "" }
        : { "data-catalog-registration-page": "" })}
      {...mainAttributes}
    >
      <div data-portal-auth-backdrop aria-hidden="true" />
      <div data-portal-auth-layout>
        <PortalRegistrationChrome
          branding={branding}
          backHref={backHref}
          memberLoginEgress={memberLoginEgress}
        />
        <section data-portal-auth-card>
          <header data-portal-auth-hero>
            <h1>{heroTitle}</h1>
            {sessionBadge !== null && sessionBadge.trim().length > 0 ? (
              <p data-portal-auth-session-chip>{sessionBadge}</p>
            ) : null}
            {heroLede !== null && heroLede.trim().length > 0 ? (
              <p data-portal-auth-lede>{heroLede}</p>
            ) : null}
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
