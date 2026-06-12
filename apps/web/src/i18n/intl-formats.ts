import type { AppLocale } from "./routing";

/** Shared next-intl number formats (server request + client provider). */
export function intlFormatsForLocale(locale: AppLocale) {
  return {
    number: {
      default: {
        numberingSystem: locale === "fa" ? ("arabext" as const) : ("latn" as const),
      },
    },
  };
}
