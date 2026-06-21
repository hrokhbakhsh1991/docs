import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  BUILDER_COMPOSITE_PALETTE,
  BUILDER_MAX_SIMPLE_RULES,
  createInitialBuilderDraft,
  createInitialBuilderPayload,
  findDuplicateFieldIds,
  reduceBuilderDraft,
} from "../src/platform/workspace-builder/builder-draft-state";
import {
  buildPreviewPluginFromDraft,
  previewPluginUsesStarterValidation,
} from "../src/platform/workspace-builder/build-preview-plugin-from-draft";
import { summarizeBuilderPreview } from "../src/platform/workspace-builder/preview-builder-draft";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("platform-workspace-builder", () => {
  it("BU-01 palette source includes platform.photos marker", () => {
    const palette = readFileSync(
      path.join(webRoot, "src/platform/workspace-builder/field-palette.tsx"),
      "utf8"
    );
    assert.match(palette, /data-palette-item=\{item\.id\}/);
    assert.match(palette, /data-platform-field-palette/);
    assert.ok(BUILDER_COMPOSITE_PALETTE.some((item) => item.id === "platform.photos"));
  });

  it("BU-02 palette does not include denali.photos", () => {
    const source = readFileSync(
      path.join(webRoot, "src/platform/workspace-builder/field-palette.tsx"),
      "utf8"
    );
    assert.doesNotMatch(source, /denali\.photos/);
  });

  it("BU-03 add composite field appends to draft reducer", () => {
    const draft = createInitialBuilderDraft({ definitionId: "test-club", basedOnVersion: null });
    const baseCount = draft.payload.fieldRegistry.fields.length;
    const next = reduceBuilderDraft(draft, {
      type: "addCompositeField",
      rendererId: "platform.photos",
    });
    assert.equal(next.payload.fieldRegistry.fields.length, baseCount + 1);
    assert.equal(next.payload.fieldRegistry.fields.at(-1)?.id, "platform.photos");
  });

  it("BU-04 remove field reduces registry length", () => {
    const draft = reduceBuilderDraft(
      createInitialBuilderDraft({ definitionId: "test-club", basedOnVersion: null }),
      { type: "addPrimitiveField", kind: "text" }
    );
    const fieldId = draft.payload.fieldRegistry.fields.at(-1)?.id;
    assert.ok(fieldId);
    const next = reduceBuilderDraft(draft, { type: "removeField", fieldId });
    assert.equal(
      next.payload.fieldRegistry.fields.length,
      draft.payload.fieldRegistry.fields.length - 1
    );
  });

  it("BU-05 duplicate field id flagged by helper", () => {
    const payload = createInitialBuilderPayload("dup-club");
    const field = payload.fieldRegistry.fields[0];
    assert.ok(field);
    const duplicated = {
      ...payload,
      fieldRegistry: {
        ...payload.fieldRegistry,
        fields: [...payload.fieldRegistry.fields, { ...field }],
      },
    };
    assert.deepEqual(findDuplicateFieldIds(duplicated), [field.id]);
  });

  it("BU-06 build-preview-plugin-from-draft preserves starter validation hook", () => {
    const payload = createInitialBuilderPayload("preview-club");
    const plugin = buildPreviewPluginFromDraft(payload);
    assert.equal(previewPluginUsesStarterValidation(plugin), true);
  });
});

describe("platform-workspace-builder rules", () => {
  it("RM-01 add rule increases simpleRules length", () => {
    const draft = createInitialBuilderDraft({ definitionId: "rules-club", basedOnVersion: null });
    const next = reduceBuilderDraft(draft, {
      type: "addSimpleRule",
      rule: {
        id: "rule.1",
        when: { fieldId: "basics.title", operator: "eq", value: "x" },
        effect: { type: "hidden", targetFieldId: "details.summary" },
      },
    });
    assert.equal(next.simpleRules.length, 1);
  });

  it("RM-02 cap at 20 prevents add", () => {
    let draft = createInitialBuilderDraft({ definitionId: "cap-club", basedOnVersion: null });
    for (let index = 0; index < BUILDER_MAX_SIMPLE_RULES; index += 1) {
      draft = reduceBuilderDraft(draft, {
        type: "addSimpleRule",
        rule: {
          id: `rule.${index}`,
          when: { fieldId: "basics.title", operator: "eq", value: "x" },
          effect: { type: "hidden", targetFieldId: "details.summary" },
        },
      });
    }
    assert.equal(draft.simpleRules.length, BUILDER_MAX_SIMPLE_RULES);
    const capped = reduceBuilderDraft(draft, {
      type: "addSimpleRule",
      rule: {
        id: "rule.overflow",
        when: { fieldId: "basics.title", operator: "eq", value: "x" },
        effect: { type: "hidden", targetFieldId: "details.summary" },
      },
    });
    assert.equal(capped.simpleRules.length, BUILDER_MAX_SIMPLE_RULES);
  });
});

describe("platform-workspace-builder preview + publish", () => {
  it("PV-01 invalid payload yields violation count > 0", () => {
    const payload = createInitialBuilderPayload("invalid-club");
    const bad = { ...payload, id: "" };
    const summary = summarizeBuilderPreview(bad);
    assert.ok(summary.violationCount > 0);
  });

  it("PV-02 publish bar disables for non-owner", () => {
    const source = readFileSync(
      path.join(webRoot, "src/platform/workspace-builder/publish-bar.tsx"),
      "utf8"
    );
    assert.match(source, /data-publish-disabled=\{canPublish \? undefined : isOwner \? "validation" : "role"\}/);
    assert.match(source, /isOwner/);
  });

  it("PV-03 preview helper returns step count > 0 for starter-based draft", () => {
    const summary = summarizeBuilderPreview(createInitialBuilderPayload("valid-club"));
    assert.ok(summary.stepCount > 0);
    assert.equal(summary.violationCount, 0);
  });
});

describe("platform-workspace-builder routes", () => {
  it("RT-01 platform-nav includes workspaces href", () => {
    const source = readFileSync(path.join(webRoot, "src/platform/platform-nav.ts"), "utf8");
    assert.match(source, /\/platform\/workspace-definitions/);
  });

  it("RT-03 builder shell includes data-platform-builder", () => {
    const source = readFileSync(
      path.join(webRoot, "src/platform/workspace-builder/builder-shell.tsx"),
      "utf8"
    );
    assert.match(source, /data-platform-builder/);
  });

  it("RT-04 BFF publish route proxies workspace-definitions versions", () => {
    const source = readFileSync(
      path.join(webRoot, "app/api/platform/workspace-definitions/[id]/versions/route.ts"),
      "utf8"
    );
    assert.match(source, /\/platform\/v1\/workspace-definitions/);
    assert.match(source, /proxyPlatformApi/);
  });
});
