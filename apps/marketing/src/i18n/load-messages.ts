import type { AppLocale } from "./routing";

export type AppMessages = Record<string, unknown>;

async function loadFaMessages(): Promise<AppMessages> {
  const [{ default: catalog }, { default: catalogRegistration }] = await Promise.all([
    import("../../messages/fa/catalog.json"),
    import("../../messages/fa/catalogRegistration.json"),
  ]);
  return { catalog, catalogRegistration };
}

async function loadEnMessages(): Promise<AppMessages> {
  const [{ default: catalog }, { default: catalogRegistration }] = await Promise.all([
    import("../../messages/en/catalog.json"),
    import("../../messages/en/catalogRegistration.json"),
  ]);
  return { catalog, catalogRegistration };
}

const loaders: Record<AppLocale, () => Promise<AppMessages>> = {
  fa: loadFaMessages,
  en: loadEnMessages,
};

export async function loadAppMessages(locale: AppLocale): Promise<AppMessages> {
  return loaders[locale]();
}
