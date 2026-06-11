import type { AppLocale } from "./routing";

export type AppMessages = Record<string, unknown>;

async function loadFaMessages(): Promise<AppMessages> {
  const { default: catalog } = await import("../../messages/fa/catalog.json");
  return { catalog };
}

async function loadEnMessages(): Promise<AppMessages> {
  const { default: catalog } = await import("../../messages/en/catalog.json");
  return { catalog };
}

const loaders: Record<AppLocale, () => Promise<AppMessages>> = {
  fa: loadFaMessages,
  en: loadEnMessages,
};

export async function loadAppMessages(locale: AppLocale): Promise<AppMessages> {
  return loaders[locale]();
}
