/**
 * Operator panel i18n — locale + RTL routing (W0)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadAppMessages } from "../src/i18n/load-messages";
import {
  formatLocalizedNumber,
  normalizeNumericInputValue,
  toAsciiDigits,
  toLocalizedDigits,
} from "../src/i18n/format-localized-digits";
import { resolveCodedErrorMessage } from "../src/i18n/resolve-coded-error-message";
import {
  LOCALE_COOKIE_NAME,
  resolveLocaleFromCookieValue,
} from "../src/i18n/resolve-locale";
import { isAppLocale, resolveTextDirection, routing } from "../src/i18n/routing";

describe("i18n-routing.spec.ts", () => {
  it("WEB-I18N-01 defaults to fa without URL prefix", () => {
    assert.equal(routing.defaultLocale, "fa");
    assert.equal(routing.localePrefix, "never");
    assert.deepEqual([...routing.locales], ["fa", "en"]);
  });

  it("WEB-I18N-02 resolves RTL for Persian", () => {
    assert.equal(resolveTextDirection("fa"), "rtl");
    assert.equal(resolveTextDirection("en"), "ltr");
  });

  it("WEB-I18N-03 validates locale cookie values", () => {
    assert.equal(LOCALE_COOKIE_NAME, "NEXT_LOCALE");
    assert.equal(resolveLocaleFromCookieValue("fa"), "fa");
    assert.equal(resolveLocaleFromCookieValue("bogus"), null);
  });

  it("WEB-I18N-04 loads fa message namespaces", async () => {
    const messages = await loadAppMessages("fa");
    assert.equal(isAppLocale("fa"), true);
    assert.equal((messages.nav as { dashboard: string }).dashboard, "داشبورد");
    assert.equal((messages.app as { newTour: string }).newTour, "تور جدید");
    assert.equal((messages.settings as { hub: { title: string } }).hub.title, "تنظیمات");
  });

  it("WEB-I18N-06 app shell messages include Persian workspace labels", async () => {
    const messages = await loadAppMessages("fa");
    const app = messages.app as {
      workspaces: { denali: string };
      themeLight: string;
    };
    assert.equal(app.workspaces.denali, "دنالی");
    assert.equal(app.themeLight, "روشن");
  });

  it("WEB-I18N-07 resolves bookings error codes in Persian", async () => {
    const messages = await loadAppMessages("fa");
    const errors = (messages.bookings as { errors: Record<string, string> }).errors;
    const t = (key: string, values?: Record<string, string | number>) => {
      const template = errors[key];
      if (template === undefined) {
        throw new Error(`missing key: ${key}`);
      }
      if (values?.status !== undefined) {
        return template.replace("{status}", String(values.status));
      }
      return template;
    };
    assert.equal(
      resolveCodedErrorMessage(t, "BOOKINGS_OPS_FORBIDDEN"),
      "دسترسی به صف عملیات رزروها مجاز نیست."
    );
    assert.match(
      resolveCodedErrorMessage(t, "BOOKINGS_LIST_HTTP_503"),
      /503/
    );
  });

  it("WEB-I18N-08 resolves settings error codes in Persian", async () => {
    const messages = await loadAppMessages("fa");
    const errors = (messages.settings as { errors: Record<string, string> }).errors;
    const t = (key: string, values?: Record<string, string | number>) => {
      const template = errors[key];
      if (template === undefined) {
        throw new Error(`missing key: ${key}`);
      }
      if (values?.status !== undefined) {
        return template.replace("{status}", String(values.status));
      }
      return template;
    };
    assert.equal(
      resolveCodedErrorMessage(t, "PROFILE_DISPLAY_NAME_INVALID"),
      "نام نمایشی باید بین ۱ تا ۱۲۰ کاراکتر باشد."
    );
    assert.match(
      resolveCodedErrorMessage(t, "EQUIPMENT_HTTP_500"),
      /500/
    );
  });

  it("WEB-I18N-09 formats and normalizes Persian digits for fa locale", () => {
    assert.equal(toLocalizedDigits("503", "fa"), "۵۰۳");
    assert.equal(toLocalizedDigits("503", "en"), "503");
    assert.match(formatLocalizedNumber(1234, "fa"), /۱/);
    assert.match(formatLocalizedNumber(1234, "en"), /1/);
    assert.equal(toAsciiDigits("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
    assert.equal(normalizeNumericInputValue("۱۲۳۴", "digits"), "1234");
    assert.equal(normalizeNumericInputValue("+۹۸۹۱۲", "phone"), "+98912");
  });

  it("WEB-I18N-05 merges denali workspace wizard messages", async () => {
    const fa = await loadAppMessages("fa");
    const en = await loadAppMessages("en");
    const faDenali = fa.denali as { fields: { title: string } };
    const enDenali = en.denali as { fields: { title: string } };
    assert.equal(faDenali.fields.title, "نام تور");
    assert.equal(enDenali.fields.title, "Tour name");
  });
});
