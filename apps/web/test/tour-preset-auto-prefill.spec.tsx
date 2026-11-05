import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useWizardCreatePresetPrefill } from "../src/tours/wizard-create-prefill-hooks";
import { createLoadingWizardTemplateGateState } from "../src/tours/wizard-template-gate-logic";

const originalFetch = globalThis.fetch;
const registryKey = "app-cloud.wizardHostAdapterSurface";
const registry = globalThis as unknown as Record<string, unknown>;
const originalRegistry = registry[registryKey];
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  registry[registryKey] = originalRegistry;
});
const preset = {
  id: "default",
  tenantId: "qa",
  name: "Preset title",
  description: null,
  themeId: null,
  isActive: true,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
};

it("create wizard consumes enabled default preset without a URL preset", async () => {
  registry[registryKey] = new Map([["denali", { readActiveThemeIds: () => [] }]]);
  const requests: string[] = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).endsWith("/advanced"))
      return Response.json({
        configVersion: 1,
        payload: {
          autoMatchEnabled: true,
          defaultPresetId: "default",
          matchRules: [],
        },
      });
    return Response.json({ items: String(url).endsWith("tour_presets") ? [preset] : [] });
  };
  const initial = { form: { data: {} }, meta: { currentStepIndex: 0 } };
  const ref = { current: initial };
  const writes: (typeof initial)[] = [];
  renderHook(() =>
    useWizardCreatePresetPrefill({
      tenantId: "qa",
      pluginId: "denali",
      presetId: null,
      gate: { ...createLoadingWizardTemplateGateState("test"), loading: false, published: true },
      cloneTourId: null,
      draftSync: {
        data: ref.current,
        status: "IDLE",
        setData: (data) => {
          writes.push(data);
          ref.current = data;
        },
      },
      draftSyncDataRef: ref,
      prepareEnvelope: (form, meta) => ({ form, meta }),
      buildPrefilledForm: () => initial.form,
      buildPresetMeta: () => initial.meta,
      onPresetAppliedChange: () => {},
    })
  );
  await waitFor(() => assert.equal(writes.length, 1));
  assert.equal((writes[0].form.data as Record<string, unknown>).title, "Preset title");
  assert.equal(requests.filter((url) => url.endsWith("/advanced")).length, 1);
});

function harness(
  options: { presetId?: string; clone?: string; status?: string; tenantId?: string } = {}
) {
  registry[registryKey] = new Map([["denali", { readActiveThemeIds: () => [] }]]);
  type Envelope = { form: { data: Record<string, unknown> }; meta: { currentStepIndex: number } };
  const ref = { current: { form: { data: {} }, meta: { currentStepIndex: 0 } } as Envelope };
  const writes: Envelope[] = [];
  const gate = { ...createLoadingWizardTemplateGateState("test"), loading: false, published: true };
  const hook = renderHook(() =>
    useWizardCreatePresetPrefill({
      tenantId: options.tenantId ?? "qa",
      pluginId: "denali",
      presetId: options.presetId ?? null,
      gate,
      cloneTourId: options.clone ?? null,
      draftSync: {
        data: ref.current,
        status: options.status ?? "IDLE",
        setData: (data) => {
          writes.push(data as Envelope);
          ref.current = data as Envelope;
        },
      },
      draftSyncDataRef: ref,
      prepareEnvelope: (form, meta) => ({ form, meta }),
      buildPrefilledForm: () => ({ data: {} }),
      buildPresetMeta: () => ({ currentStepIndex: 0 }),
      onPresetAppliedChange: () => {},
    })
  );
  return { ref, writes, ...hook };
}

it("late optional prefill preserves current input and does not write a no-op", async () => {
  let release!: (response: Response) => void;
  globalThis.fetch = async (url) =>
    String(url).endsWith("tour_presets")
      ? new Promise<Response>((resolve) => {
          release = resolve;
        })
      : Response.json({ items: [] });
  const h = harness({ presetId: "default" });
  await waitFor(() => assert.equal(typeof release, "function"));
  h.ref.current = { form: { data: { title: "User typed this" } }, meta: { currentStepIndex: 2 } };
  await act(async () => {
    release(Response.json({ items: [preset] }));
  });
  assert.equal(h.ref.current.form.data.title, "User typed this");
  assert.equal(h.writes.length, 0);
});

it("clone mode never requests or applies a preset", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ items: [preset] });
  };
  const h = harness({ presetId: "default", clone: "source-tour" });
  await act(async () => {});
  assert.equal(requests, 0);
  assert.equal(h.writes.length, 0);
});

it("failed or malformed advanced settings leave the draft unchanged", async () => {
  for (const response of [
    () => new Response(null, { status: 503 }),
    () => Response.json({ payload: { autoMatchEnabled: true, matchRules: [null] } }),
  ]) {
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return response();
    };
    const h = harness();
    await act(async () => {});
    assert.equal(requests, 1);
    assert.equal(h.writes.length, 0);
    h.unmount();
  }
});

it("syncing drafts wait; applied presets are not repeatedly written", async () => {
  globalThis.fetch = async (url) =>
    Response.json({ items: String(url).endsWith("tour_presets") ? [preset] : [] });
  const options = { presetId: "default", status: "SYNCING" };
  const h = harness(options);
  await act(async () => {});
  assert.equal(h.writes.length, 0);
  options.status = "IDLE";
  h.rerender();
  await waitFor(() => assert.equal(h.writes.length, 1));
  h.ref.current = { form: { data: { title: "" } }, meta: { currentStepIndex: 0 } };
  h.rerender();
  await act(async () => {});
  assert.equal(h.writes.length, 1);
});

it("tenant change discards an in-flight response from the previous tenant", async () => {
  let first!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = async (url) => {
    if (!String(url).endsWith("tour_presets")) return Response.json({ items: [] });
    calls++;
    if (calls === 1)
      return new Promise<Response>((resolve) => {
        first = resolve;
      });
    return Response.json({ items: [{ ...preset, name: "New tenant preset" }] });
  };
  const options = { presetId: "default", tenantId: "old" };
  const h = harness(options);
  await waitFor(() => assert.equal(typeof first, "function"));
  options.tenantId = "new";
  h.rerender();
  await waitFor(() => assert.equal(h.writes.length, 1));
  await act(async () => {
    first(Response.json({ items: [preset] }));
  });
  assert.equal(h.ref.current.form.data.title, "New tenant preset");
  assert.equal(h.writes.length, 1);
});

it("pending remote drafts, conflicts and quarantined data are not rewritten", async () => {
  globalThis.fetch = async (url) =>
    Response.json({ items: String(url).endsWith("tour_presets") ? [preset] : [] });
  for (const status of ["DRAFT_AVAILABLE", "CONFLICT_RESOLVING", "QUARANTINED", "ERROR"]) {
    const h = harness({ presetId: "default", status });
    await act(async () => {});
    assert.equal(h.writes.length, 0, status);
    h.unmount();
  }
});

it("malformed preset resource lists cannot crash or mutate the wizard", async () => {
  globalThis.fetch = async (url) =>
    Response.json({ items: String(url).endsWith("tour_presets") ? [null] : [] });
  const h = harness({ presetId: "default" });
  await act(async () => {});
  assert.equal(h.writes.length, 0);
});

it("rules are reevaluated after category selection without refetching settings", async () => {
  let settingsReads = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/advanced")) {
      settingsReads++;
      return Response.json({
        configVersion: 1,
        payload: {
          autoMatchEnabled: true,
          defaultPresetId: null,
          matchRules: [
            {
              id: "mountain_day",
              tourType: "mountain_day",
              themeId: null,
              presetId: "default",
              enabled: true,
            },
          ],
        },
      });
    }
    return Response.json({ items: String(url).endsWith("tour_presets") ? [preset] : [] });
  };
  const h = harness();
  await act(async () => {});
  assert.equal(h.writes.length, 0);
  h.ref.current = { form: { data: { category: "mountain_day" } }, meta: { currentStepIndex: 1 } };
  h.rerender();
  await waitFor(() => assert.equal(h.writes.length, 1));
  assert.equal(h.ref.current.form.data.title, "Preset title");
  assert.equal(settingsReads, 1);
});
