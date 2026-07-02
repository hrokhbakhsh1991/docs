import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createWizardSubmitErrorTranslator } from "../src/wizard/create-wizard-submit-error-translator";

describe("create-wizard-submit-error-translator.spec.ts", () => {
  it("WEB-P11-6-10 uses next-intl has without invoking translate", () => {
    const calls: string[] = [];
    const tWizard = Object.assign(
      (key: string) => {
        calls.push(`translate:${key}`);
        return key;
      },
      {
        has: (key: string) => {
          calls.push(`has:${key}`);
          return key === "submitEdit.lifecycleUnpublishRejected";
        },
      }
    );

    const translator = createWizardSubmitErrorTranslator(tWizard);
    assert.equal(translator.has("submitEdit.lifecycleUnpublishRejected"), true);
    assert.equal(translator.has("submitEdit.missing"), false);
    assert.deepEqual(calls, ["has:submitEdit.lifecycleUnpublishRejected", "has:submitEdit.missing"]);
    assert.equal(translator.translate("submitEdit.lifecycleUnpublishRejected"), "submitEdit.lifecycleUnpublishRejected");
    assert.match(calls[2] ?? "", /^translate:/);
  });
});
