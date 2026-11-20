import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React, { useState } from "react";

import { BookingsDirectoryControls } from "../src/features/bookings/bookings-directory-controls";
import { DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY } from "../src/features/bookings/bookings-command-center-types";
import faMessages from "../messages/fa/bookings.json";
import enMessages from "../messages/en/bookings.json";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(cleanup);

function mount(locale: "fa" | "en", prominentSearch: boolean) {
  const messages = { bookings: locale === "fa" ? faMessages : enMessages };
  const assigned: string[] = [];
  function Harness() {
    const [searchInput, setSearchInput] = useState("");
    return (
      <BookingsDirectoryControls
        prominentSearch={prominentSearch}
        query={DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY}
        searchInput={searchInput}
        onSearchInputChange={(value) => {
          assigned.push(value);
          setSearchInput(value);
        }}
        onReplaceQuery={() => undefined}
      />
    );
  }
  return {
    assigned,
    ...render(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <div dir={locale === "fa" ? "rtl" : "ltr"}>
          <Harness />
        </div>
      </NextIntlClientProvider>
    ),
  };
}

test("standalone Denali bookings search is named in Persian and keeps the controlled input contract", () => {
  const { getByRole, assigned } = mount("fa", true);
  const field = getByRole("searchbox", { name: "جست‌وجوی رزروها" }) as HTMLInputElement;
  assert.equal(field.closest("[dir]")?.getAttribute("dir"), "rtl");
  fireEvent.change(field, { target: { value: "123" } });
  assert.equal(field.value, "123");
  fireEvent.change(field, { target: { value: "" } });
  assert.equal(field.value, "");
  assert.deepEqual(assigned, ["123", ""]);
});

test("standalone Denali bookings search has the English name and does not duplicate the input", () => {
  const { getByRole, queryByRole } = mount("en", true);
  assert.ok(getByRole("searchbox", { name: "Search bookings" }));
  assert.equal(queryByRole("textbox"), null);
});

test("the existing non-Denali controls keep their original textbox", () => {
  const { getByPlaceholderText, queryByRole } = mount("en", false);
  const field = getByPlaceholderText(enMessages.searchPlaceholder) as HTMLInputElement;
  assert.equal(field.type, "text");
  assert.equal(queryByRole("searchbox"), null);
});

test("only the workspace-owned ops manifest can opt a standalone route into prominent search", () => {
  const page = readFileSync(new URL("../app/(app)/bookings/page.tsx", import.meta.url), "utf8");
  const shell = readFileSync(
    new URL("../src/features/bookings/bookings-command-center-shell.tsx", import.meta.url),
    "utf8"
  );
  assert.match(page, /resolveBookingOpsCapabilityForHub\(null, session\.pluginId\)/);
  assert.match(
    page,
    /prominentDirectorySearch=\{opsManifest\?\.directorySearchPresentation === "prominent"\}/
  );
  assert.match(shell, /prominentDirectorySearch = false/);
  assert.match(shell, /<BookingsDirectoryControls\s+prominentSearch=\{prominentDirectorySearch\}/);
  assert.doesNotMatch(shell, /pluginId\s*===\s*["']denali["']/);
});
