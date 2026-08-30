import type { AppLocale } from "./routing";

export type AppMessages = Record<string, unknown>;

async function loadFaMessages(): Promise<AppMessages> {
  const { default: catalogRegistration } = await import(
    "../../messages/fa/catalogRegistration.json"
  );
  const { default: portalMember } = await import("../../messages/fa/portalMember.json");
  const { default: common } = await import("../../messages/fa/common.json");
  return { catalogRegistration, portalMember, common };
}

async function loadEnMessages(): Promise<AppMessages> {
  const { default: catalogRegistration } = await import(
    "../../messages/en/catalogRegistration.json"
  );
  const { default: portalMember } = await import("../../messages/en/portalMember.json");
  const { default: common } = await import("../../messages/en/common.json");
  return { catalogRegistration, portalMember, common };
}

const loaders: Record<AppLocale, () => Promise<AppMessages>> = {
  fa: loadFaMessages,
  en: loadEnMessages,
};

export async function loadAppMessages(locale: AppLocale): Promise<AppMessages> {
  return loaders[locale]();
}
