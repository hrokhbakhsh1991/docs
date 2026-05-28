import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";

import { createDenaliDraftAdapter, isMeaningfulDenaliDraftSnapshot } from "./denali-adapter";
import { DENALI_WIZARD_RAIL_LAYOUT_VERSION } from "./sanitizeDenaliWizardDraftSnapshot";

test("isMeaningfulDenaliDraftSnapshot returns false for empty baseline draft", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(
    isMeaningfulDenaliDraftSnapshot({
      form,
      currentStepIndex: 0,
    }),
    false,
  );
});

test("isMeaningfulDenaliDraftSnapshot returns true for progressed step", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(
    isMeaningfulDenaliDraftSnapshot({
      form,
      currentStepIndex: 1,
    }),
    true,
  );
});

test("isMeaningfulDenaliDraftSnapshot returns true for meaningful form data", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Denali test title";
  assert.equal(
    isMeaningfulDenaliDraftSnapshot({
      form,
      currentStepIndex: 0,
    }),
    true,
  );
});

test("isMeaningfulDenaliDraftSnapshot returns true for relocated program content at step 0", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.programNature.shortDescription = "Draft content on photos step";
  assert.equal(
    isMeaningfulDenaliDraftSnapshot({
      form,
      currentStepIndex: 0,
    }),
    false,
    "programNature alone is not in hasMeaningfulDenaliFormData key paths",
  );
  form.basicInfo.title = "Draft title";
  assert.equal(
    isMeaningfulDenaliDraftSnapshot({
      form,
      currentStepIndex: 0,
    }),
    true,
  );
});

test("draft step index 1 maps to denali_photos on phase 3 rail", () => {
  const steps = getDenaliWizardSteps();
  assert.equal(steps[1], "denali_photos");
  assert.notEqual(steps[1], "denali_program");
});

test("createDenaliDraftAdapter merge keeps local currentStepIndex", () => {
  const adapter = createDenaliDraftAdapter({
    workspaceId: "w1",
    getCurrentStepIndex: () => 4,
  });
  const local = {
    form: buildDenaliTourCreateTestValues(),
    currentStepIndex: 4,
    railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  };
  const server = {
    form: buildDenaliTourCreateTestValues(),
    currentStepIndex: 1,
    railLayoutVersion: 1,
  };

  const merged = adapter.merge!(local, server);
  assert.equal(merged.currentStepIndex, 4);
  assert.equal(getDenaliWizardSteps()[4], "denali_pricing");
});

test("createDenaliDraftAdapter merge preserves relocated program content from local form", () => {
  const adapter = createDenaliDraftAdapter({
    workspaceId: "w1",
    getCurrentStepIndex: () => 2,
  });

  const base = buildDenaliTourCreateTestValues();
  const server = {
    form: {
      ...base,
      programNature: { ...base.programNature, shortDescription: "Server short copy" },
    },
    currentStepIndex: 1,
  };
  const local = {
    form: {
      ...base,
      basicInfo: { ...base.basicInfo, title: "Merged tour title" },
      programNature: { ...base.programNature, shortDescription: "Local short copy" },
    },
    currentStepIndex: 2,
  };

  const merged = adapter.merge!(local, server);

  assert.equal(merged.form.basicInfo.title, "Merged tour title");
  assert.equal(merged.form.programNature.shortDescription, "Local short copy");
  assert.equal(merged.railLayoutVersion, DENALI_WIZARD_RAIL_LAYOUT_VERSION);
});

test("createDenaliDraftAdapter merge remaps legacy photos step index to new rail", () => {
  const adapter = createDenaliDraftAdapter({
    workspaceId: "w1",
    getCurrentStepIndex: () => 1,
  });

  const base = buildDenaliTourCreateTestValues();
  const merged = adapter.merge!(
    {
      form: base,
      currentStepIndex: 4,
      railLayoutVersion: 1,
    },
    {
      form: base,
      currentStepIndex: 0,
      railLayoutVersion: 1,
    },
  );

  assert.equal(merged.currentStepIndex, getDenaliWizardSteps().indexOf("denali_photos"));
  assert.equal(merged.railLayoutVersion, DENALI_WIZARD_RAIL_LAYOUT_VERSION);
});

test("createDenaliDraftAdapter scopes draft id and fetch path to workspaceId", async () => {
  const fetchUrls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    fetchUrls.push(String(input));
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  };

  try {
    const adapterA = createDenaliDraftAdapter({
      workspaceId: "ws-tenant-a",
      getCurrentStepIndex: () => 0,
    });
    assert.equal(adapterA.id, "denali-create:ws-tenant-a");
    await adapterA.onFetch!();
    assert.ok(
      fetchUrls.some((url) => url.includes("/api/workspaces/ws-tenant-a/draft-engine/denali-create")),
    );

    fetchUrls.length = 0;
    const adapterB = createDenaliDraftAdapter({
      workspaceId: "ws-tenant-b",
      getCurrentStepIndex: () => 0,
    });
    assert.equal(adapterB.id, "denali-create:ws-tenant-b");
    await adapterB.onFetch!();
    assert.ok(
      fetchUrls.some((url) => url.includes("/api/workspaces/ws-tenant-b/draft-engine/denali-create")),
    );
    assert.ok(!fetchUrls.some((url) => url.includes("ws-tenant-a")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createDenaliDraftAdapter onPush rejects empty workspace scope", async () => {
  const adapter = createDenaliDraftAdapter({
    workspaceId: "",
    getCurrentStepIndex: () => 0,
  });

  await assert.rejects(
    () =>
      adapter.onPush!({
        data: {
          form: buildDenaliTourCreateTestValues(),
          currentStepIndex: 0,
        },
        version: 0,
        schemaVersion: 1,
        lastModified: Date.now(),
      }),
    /Cannot push Denali draft without workspace scope/,
  );
});
