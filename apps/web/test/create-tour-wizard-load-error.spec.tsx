import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { CreateTourWizardLoadError } from "../src/wizard/create-tour-wizard-chrome";

const messages = {
  wizard: {
    bootstrapError: {
      title: "Wizard failed to load",
      description: "The workspace plugin did not become ready.",
      code: "Error code: {code}",
      retry: "Try again",
    },
  },
};

describe("create tour wizard terminal load error", () => {
  it("replaces loading with a comprehensible error and retry action", () => {
    let retries = 0;
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CreateTourWizardLoadError
          code="WORKSPACE_WIZARD_HOST_READY_TIMEOUT"
          onRetry={() => {
            retries += 1;
          }}
        />
      </NextIntlClientProvider>
    );

    assert.ok(view.getByRole("alert"));
    assert.match(view.getByRole("alert").textContent ?? "", /HOST_READY_TIMEOUT/);
    assert.equal(view.queryByText("Loading tour wizard…"), null);
    fireEvent.click(view.getByRole("button", { name: "Try again" }));
    assert.equal(retries, 1);
  });
});
