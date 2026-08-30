import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";

import { LocalizedDatePicker } from "../src/localized-date-picker";

const messages = {
  common: {
    calendar: {
      pickDate: "Pick a date",
      today: "Today",
      previousMonth: "Previous month",
      nextMonth: "Next month",
      previousYears: "Previous years",
      nextYears: "Next years",
      pickMonth: "Pick month",
      pickYear: "Pick year",
    },
  },
};

function renderPicker(props: {
  readonly value: string;
  readonly onChange: (iso: string) => void;
  readonly locale?: "fa" | "en";
}) {
  return render(
    <NextIntlClientProvider locale={props.locale ?? "fa"} messages={messages}>
      <LocalizedDatePicker value={props.value} onChange={props.onChange} data-testid="birth-picker" />
    </NextIntlClientProvider>
  );
}

describe("LocalizedDatePicker (LC-PICKER)", () => {
  it("LC-PICKER-01 empty value is safe", () => {
    let latest = "unchanged";
    renderPicker({ value: "", onChange: (iso) => { latest = iso; } });
    assert.match(screen.getByTestId("birth-picker").textContent ?? "", /Pick a date/);
    assert.equal(latest, "unchanged");
    cleanup();
  });

  it("LC-PICKER-02 Jalali selection emits exact Gregorian YYYY-MM-DD", () => {
    let latest = "";
    renderPicker({ value: "1990-05-01", onChange: (iso) => { latest = iso; } });
    fireEvent.click(screen.getByTestId("birth-picker"));
    const day = screen
      .getAllByLabelText("1990-05-20")
      .find((node) => node instanceof HTMLButtonElement && !node.disabled);
    assert.ok(day);
    fireEvent.click(day!);
    assert.equal(latest, "1990-05-20");
    cleanup();
  });

  it("LC-PICKER-03 controlled Gregorian value shows Jalali label", () => {
    const view = renderPicker({ value: "1990-05-20", onChange: () => {} });
    assert.match(view.container.textContent ?? "", /۳۰ اردیبهشت ۱۳۶۹/);
    cleanup();
  });
});
