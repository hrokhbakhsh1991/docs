import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PresetsAdvancedClient } from "../app/(app)/settings/tour-presets/advanced/presets-advanced-client";
import settings from "../messages/en/settings.json";
import common from "../messages/en/common.json";
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
it("operator can edit rule conditions and destination and save them together", async () => {
  let submitted: { payload: unknown } | undefined;
  const payload = { autoMatchEnabled: false, defaultPresetId: null, matchRules: [] };
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "PUT") {
      submitted = JSON.parse(String(init.body));
      return Response.json(submitted);
    }
    return Response.json({ configVersion: 1, payload: submitted?.payload ?? payload });
  };
  const view = render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ settings, common }}>
      <PresetsAdvancedClient
        session={{
          userId: "test-owner",
          tenantId: "test-tenant",
          role: "owner",
          workspaceType: "denali",
          pluginId: "denali",
        }}
      />
    </NextIntlClientProvider>
  );
  fireEvent.change(await view.findByLabelText("Rule ID"), { target: { value: "mountain" } });
  fireEvent.click(view.getByRole("button", { name: "Add rule" }));
  fireEvent.change(view.getByLabelText("Tour type"), { target: { value: "day" } });
  fireEvent.change(view.getByLabelText("Theme ID"), { target: { value: "mountain-theme" } });
  fireEvent.change(view.getByLabelText("Preset ID"), { target: { value: "mountain-preset" } });
  fireEvent.click(view.getByRole("button", { name: "Save advanced presets" }));
  await waitFor(() =>
    assert.deepEqual(submitted, {
      configVersion: 1,
      payload: {
        ...payload,
        matchRules: [
          {
            id: "mountain",
            tourType: "day",
            themeId: "mountain-theme",
            presetId: "mountain-preset",
            enabled: true,
          },
        ],
      },
    })
  );
  view.unmount();
  const reloaded = render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ settings, common }}>
      <PresetsAdvancedClient
        session={{
          userId: "test-owner",
          tenantId: "test-tenant",
          role: "owner",
          workspaceType: "denali",
          pluginId: "denali",
        }}
      />
    </NextIntlClientProvider>
  );
  assert.equal(
    ((await reloaded.findByLabelText("Preset ID")) as HTMLInputElement).value,
    "mountain-preset"
  );
  assert.equal((reloaded.getByLabelText("Tour type") as HTMLInputElement).value, "day");
});

it("does not allow overwriting configuration when initial load fails", async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const view = render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ settings, common }}>
      <PresetsAdvancedClient
        session={{
          userId: "test-owner",
          tenantId: "test-tenant",
          role: "owner",
          workspaceType: "denali",
          pluginId: "denali",
        }}
      />
    </NextIntlClientProvider>
  );
  await view.findByText("Failed to load advanced presets (HTTP 503).");
  assert.equal(view.queryByRole("button", { name: "Save advanced presets" }) === null, true);
});

it("viewer can inspect saved conditions but cannot change or save rules", async () => {
  globalThis.fetch = async () =>
    Response.json({
      configVersion: 1,
      payload: {
        autoMatchEnabled: true,
        defaultPresetId: null,
        matchRules: [
          { id: "saved", tourType: "day", themeId: "theme", presetId: "preset", enabled: false },
        ],
      },
    });
  const view = render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ settings, common }}>
      <PresetsAdvancedClient
        session={{
          userId: "test-viewer",
          tenantId: "test-tenant",
          role: "viewer",
          workspaceType: "denali",
          pluginId: "denali",
        }}
      />
    </NextIntlClientProvider>
  );
  const preset = (await view.findByLabelText("Preset ID")) as HTMLInputElement;
  assert.equal(preset.value, "preset");
  assert.equal(preset.disabled, true);
  assert.equal((view.getByLabelText("Rule enabled") as HTMLInputElement).checked, false);
  assert.equal((view.getByLabelText("Rule enabled") as HTMLInputElement).disabled, true);
  assert.equal(view.queryByRole("button", { name: "Save advanced presets" }) === null, true);
  assert.equal(view.queryByRole("button", { name: "Add rule" }) === null, true);
});
