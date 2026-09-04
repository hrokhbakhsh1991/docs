import { loadWorkspaceWizardMessagesForLocale } from "@/bootstrap/workspace-wizard-message-loads.generated";

import type { AppLocale } from "./routing";

export type AppMessages = Record<string, unknown>;

async function loadFaMessages(): Promise<AppMessages> {
  const [
    { default: app },
    { default: auth },
    { default: bookings },
    { default: catalogRegistration },
    { default: common },
    { default: dashboard },
    { default: finance },
    { default: engagement },
    { default: wallet },
    { default: nav },
    { default: settings },
    { default: tickets },
    { default: tours },
    { default: users },
    { default: wizard },
    workspaceWizardMessages,
  ] = await Promise.all([
    import("../../messages/fa/app.json"),
    import("../../messages/fa/auth.json"),
    import("../../messages/fa/bookings.json"),
    import("../../messages/fa/catalogRegistration.json"),
    import("../../messages/fa/common.json"),
    import("../../messages/fa/dashboard.json"),
    import("../../messages/fa/finance.json"),
    import("../../messages/fa/engagement.json"),
    import("../../messages/fa/wallet.json"),
    import("../../messages/fa/nav.json"),
    import("../../messages/fa/settings.json"),
    import("../../messages/fa/tickets.json"),
    import("../../messages/fa/tours.json"),
    import("../../messages/fa/users.json"),
    import("../../messages/fa/wizard.json"),
    loadWorkspaceWizardMessagesForLocale("fa"),
  ]);

  return {
    app,
    auth,
    bookings,
    catalogRegistration,
    common,
    dashboard,
    finance,
    engagement,
    wallet,
    nav,
    settings,
    tickets,
    tours,
    users,
    wizard,
    ...workspaceWizardMessages,
  };
}

async function loadEnMessages(): Promise<AppMessages> {
  const [
    { default: app },
    { default: auth },
    { default: bookings },
    { default: catalogRegistration },
    { default: common },
    { default: dashboard },
    { default: finance },
    { default: engagement },
    { default: wallet },
    { default: nav },
    { default: settings },
    { default: tickets },
    { default: tours },
    { default: users },
    { default: wizard },
    workspaceWizardMessages,
  ] = await Promise.all([
    import("../../messages/en/app.json"),
    import("../../messages/en/auth.json"),
    import("../../messages/en/bookings.json"),
    import("../../messages/en/catalogRegistration.json"),
    import("../../messages/en/common.json"),
    import("../../messages/en/dashboard.json"),
    import("../../messages/en/finance.json"),
    import("../../messages/en/engagement.json"),
    import("../../messages/en/wallet.json"),
    import("../../messages/en/nav.json"),
    import("../../messages/en/settings.json"),
    import("../../messages/en/tickets.json"),
    import("../../messages/en/tours.json"),
    import("../../messages/en/users.json"),
    import("../../messages/en/wizard.json"),
    loadWorkspaceWizardMessagesForLocale("en"),
  ]);

  return {
    app,
    auth,
    bookings,
    catalogRegistration,
    common,
    dashboard,
    finance,
    engagement,
    wallet,
    nav,
    settings,
    tickets,
    tours,
    users,
    wizard,
    ...workspaceWizardMessages,
  };
}

const loaders: Record<AppLocale, () => Promise<AppMessages>> = {
  fa: loadFaMessages,
  en: loadEnMessages,
};

/**
 * Hybrid namespaces — shell messages in apps/web; workspace wizard copy from manifest codegen.
 * Locale paths are static so Webpack can bundle JSON at build time.
 */
export async function loadAppMessages(locale: AppLocale): Promise<AppMessages> {
  return loaders[locale]();
}
