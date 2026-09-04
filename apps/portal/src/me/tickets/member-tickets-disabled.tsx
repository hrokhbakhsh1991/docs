import { getTranslations } from "next-intl/server";

type MemberTicketsDisabledProps = {
  readonly reason: "workspace_disabled" | "module_disabled" | "entitlement_denied";
};

export async function MemberTicketsDisabled({ reason }: MemberTicketsDisabledProps) {
  const t = await getTranslations("portalMember.tickets.disabled");
  const messageKey =
    reason === "module_disabled"
      ? "moduleDisabled"
      : reason === "workspace_disabled"
        ? "workspaceDisabled"
        : "entitlementDenied";

  return (
    <main data-portal-member-tickets data-portal-member-tickets-state="disabled">
      <header data-portal-member-page-header>
        <h1>{t("title")}</h1>
        <p role="status" data-portal-member-tickets-disabled>
          {t(messageKey)}
        </p>
      </header>
    </main>
  );
}
