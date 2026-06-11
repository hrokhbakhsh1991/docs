import { getRequestConfig } from "next-intl/server";

import { loadAppMessages } from "./load-messages";
import { resolveRequestLocale } from "./resolve-locale";
import { isAppLocale, routing, type AppLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: AppLocale = routing.defaultLocale;
  if (requested !== undefined && isAppLocale(requested)) {
    locale = requested;
  } else {
    locale = await resolveRequestLocale();
  }

  return {
    locale,
    messages: await loadAppMessages(locale),
    formats: {
      number: {
        default: {
          numberingSystem: locale === "fa" ? "arabext" : "latn",
        },
      },
    },
  };
});
