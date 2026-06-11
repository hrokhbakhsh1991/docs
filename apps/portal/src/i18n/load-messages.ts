import type { AppLocale } from "./routing";

export type AppMessages = Record<string, unknown>;

async function loadFaMessages(): Promise<AppMessages> {
  const { default: catalogRegistration } = await import(
    "../../messages/fa/catalogRegistration.json"
  );
  return { catalogRegistration };
}

async function loadEnMessages(): Promise<AppMessages> {
  const { default: catalogRegistration } = await import(
    "../../messages/en/catalogRegistration.json"
  );
  return { catalogRegistration };
}

const loaders: Record<AppLocale, () => Promise<AppMessages>> = {
  fa: loadFaMessages,
  en: loadEnMessages,
};

export async function loadAppMessages(locale: AppLocale): Promise<AppMessages> {
  return loaders[locale]();
}
