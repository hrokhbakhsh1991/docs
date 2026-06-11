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
    { default: nav },
    { default: settings },
    { default: tours },
    { default: users },
    { default: wizard },
    { default: denali },
  ] = await Promise.all([
    import("../../messages/fa/app.json"),
    import("../../messages/fa/auth.json"),
    import("../../messages/fa/bookings.json"),
    import("../../messages/fa/catalogRegistration.json"),
    import("../../messages/fa/common.json"),
    import("../../messages/fa/dashboard.json"),
    import("../../messages/fa/finance.json"),
    import("../../messages/fa/nav.json"),
    import("../../messages/fa/settings.json"),
    import("../../messages/fa/tours.json"),
    import("../../messages/fa/users.json"),
    import("../../messages/fa/wizard.json"),
    import("@app-tour/workspace-denali/messages/fa/wizard.json"),
  ]);

  return {
    app,
    auth,
    bookings,
    catalogRegistration,
    common,
    dashboard,
    denali,
    finance,
    nav,
    settings,
    tours,
    users,
    wizard,
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
    { default: nav },
    { default: settings },
    { default: tours },
    { default: users },
    { default: wizard },
    { default: denali },
  ] = await Promise.all([
    import("../../messages/en/app.json"),
    import("../../messages/en/auth.json"),
    import("../../messages/en/bookings.json"),
    import("../../messages/en/catalogRegistration.json"),
    import("../../messages/en/common.json"),
    import("../../messages/en/dashboard.json"),
    import("../../messages/en/finance.json"),
    import("../../messages/en/nav.json"),
    import("../../messages/en/settings.json"),
    import("../../messages/en/tours.json"),
    import("../../messages/en/users.json"),
    import("../../messages/en/wizard.json"),
    import("@app-tour/workspace-denali/messages/en/wizard.json"),
  ]);

  return {
    app,
    auth,
    bookings,
    catalogRegistration,
    common,
    dashboard,
    denali,
    finance,
    nav,
    settings,
    tours,
    users,
    wizard,
  };
}

const loaders: Record<AppLocale, () => Promise<AppMessages>> = {
  fa: loadFaMessages,
  en: loadEnMessages,
};

/**
 * Hybrid namespaces — shell messages in apps/web; Denali workspace wizard copy merged (W5B).
 * Locale paths are static so Webpack can bundle JSON at build time.
 */
export async function loadAppMessages(locale: AppLocale): Promise<AppMessages> {
  return loaders[locale]();
}
