import { getTranslations } from "next-intl/server";

import { MemberWalletDisabled } from "./member-wallet-disabled";
import { MemberWalletTransactionsPanel } from "./member-wallet-transactions-panel";
import type { MemberWalletFetchResult } from "./fetch-member-wallet.server";

type MemberWalletPageContentProps = {
  readonly pluginId: string;
  readonly walletResult: MemberWalletFetchResult;
};

export async function MemberWalletPageContent({
  pluginId,
  walletResult,
}: MemberWalletPageContentProps) {
  const t = await getTranslations("portalMember.wallet");

  if (walletResult.status === "workspace_disabled") {
    return <MemberWalletDisabled pluginId={pluginId} reason="workspace_disabled" />;
  }
  if (walletResult.status === "module_disabled") {
    return <MemberWalletDisabled pluginId={pluginId} reason="module_disabled" />;
  }
  if (walletResult.status === "entitlement_denied") {
    return <MemberWalletDisabled pluginId={pluginId} reason="entitlement_denied" />;
  }
  if (walletResult.status === "unavailable" || walletResult.status === "api_error") {
    return (
      <main data-portal-member-wallet data-portal-member-wallet-state="error">
        <header data-portal-member-page-header>
          <h1>{t("title")}</h1>
          <p role="alert" data-portal-member-wallet-error>
            {t("loadFailed")}
          </p>
        </header>
      </main>
    );
  }
  if (walletResult.status !== "ok") {
    return null;
  }

  const { balance, history } = walletResult.payload;

  return (
    <main data-portal-member-wallet data-portal-member-wallet-state="ready">
      <header data-portal-member-page-header>
        <h1>{t("title")}</h1>
        <p data-portal-member-wallet-lede>{t("lede")}</p>
      </header>

      <section
        data-portal-member-wallet-balance-card
        aria-labelledby="member-wallet-balance-heading"
      >
        <h2 id="member-wallet-balance-heading" data-portal-member-wallet-sr-only>
          {t("balanceHeading")}
        </h2>
        <p data-portal-member-wallet-balance-label>{t("availableBalance")}</p>
        <p data-portal-member-wallet-balance-amount aria-live="polite">
          {balance.availableLabel}
        </p>
        <p data-portal-member-wallet-currency>
          {t("currencyLabel", { currency: balance.currency })}
        </p>
        <p data-portal-member-wallet-balance-secondary>
          {t("totalBalance", { amount: balance.balanceLabel })}
        </p>
      </section>

      <MemberWalletTransactionsPanel initialHistory={history} />
    </main>
  );
}
