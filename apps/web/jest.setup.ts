import "@testing-library/jest-dom";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useMessages: () => ({}),
  useNow: () => new Date("2026-01-01T00:00:00.000Z"),
  useTimeZone: () => "UTC",
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));
