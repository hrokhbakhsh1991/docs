import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

function isLocale(value: string): value is (typeof routing.locales)[number] {
  return (routing.locales as readonly string[]).includes(value);
}

/**
 * Request-scoped i18n: loads `fa` messages. `requestLocale` may be unset without a `[locale]` segment — always falls back to `fa`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !isLocale(locale)) {
    locale = routing.defaultLocale;
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
