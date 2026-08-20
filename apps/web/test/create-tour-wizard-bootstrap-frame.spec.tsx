import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import {
  CreateTourWizardBootstrapFrame,
  CreateTourWizardLoadingMessage,
} from "../src/wizard/create-tour-wizard-chrome";

const messages = {
  wizard: {
    loading: "Loading tour wizard…",
    pageTitle: "Create tour",
    pageSubtitle: "Build and publish a new tour",
  },
};

describe("CreateTourWizardBootstrapFrame", () => {
  it("keeps page chrome visible while loading body renders", () => {
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CreateTourWizardBootstrapFrame>
          <CreateTourWizardLoadingMessage />
        </CreateTourWizardBootstrapFrame>
      </NextIntlClientProvider>
    );

    assert.equal(view.getByRole("heading", { level: 1 }).textContent, "Create tour");
    assert.match(view.getByText("Build and publish a new tour").textContent ?? "", /publish/);
    assert.ok(view.container.querySelector("[data-workspace-wizard-loading]"));
    assert.match(
      view.container.querySelector("[data-workspace-wizard-loading]")?.textContent ?? "",
      /Loading tour wizard/
    );
    assert.ok(view.container.querySelector(".new-tour-wizard-page"));
  });
});
