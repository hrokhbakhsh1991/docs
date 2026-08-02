/**
 * Thin Shell Phase 4ap — tourActionSubmit capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { resolveTourActionSubmitCapability } from "@app-tour/workspace-sdk";

import {
  decodeTourActionSubmitError,
  encodeTourActionSubmitErrorForPlugin,
} from "../src/wizard/tour-action-submit-codec";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-tour-action-submit-capability — Phase 4ap", () => {
  it("TS-4AP-01 denali publishes capabilities.tourActionSubmit encode/decode", () => {
    const plugin = getDenaliPlugin();
    const codec = resolveTourActionSubmitCapability(plugin);
    assert.ok(codec);
    const encoded = codec.encode({ status: 500, code: "x", message: "y" });
    assert.match(encoded, /^TOUR_ACTION_ERROR:/);
    assert.equal(codec.decode(encoded)?.code, "x");
  });

  it("TS-4AP-02 binder deleted; warm skips codecs; shell helpers are capability/platform", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-tour-action-submit-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const create = readFileSync(
      resolve(WEB_ROOT, "src/wizard/workspace-create-tour-wizard-client.tsx"),
      "utf8"
    );
    const resolveMsg = readFileSync(
      resolve(WEB_ROOT, "src/wizard/resolve-wizard-submit-error-message.ts"),
      "utf8"
    );

    assert.doesNotMatch(warm, /ensureAllTourActionSubmitCodecs/);
    assert.doesNotMatch(warm, /workspace-tour-action-submit-bindings/);
    assert.match(create, /tour-action-submit-codec/);
    assert.doesNotMatch(create, /ensureTourActionSubmitCodec/);
    assert.doesNotMatch(create, /workspace-tour-action-submit-bindings/);
    assert.match(resolveMsg, /tour-action-submit-codec/);
    assert.doesNotMatch(resolveMsg, /workspace-tour-action-submit-bindings/);
  });

  it("TS-4AP-03 shell encode/decode work with plugin capability and platform fallback", () => {
    const plugin = getDenaliPlugin();
    const encoded = encodeTourActionSubmitErrorForPlugin(plugin, {
      status: 409,
      code: "conflict",
      message: "nope",
    });
    assert.equal(decodeTourActionSubmitError(encoded)?.status, 409);
    assert.equal(decodeTourActionSubmitError(encoded)?.code, "conflict");
    // no plugin — platform fallback
    assert.equal(decodeTourActionSubmitError(encoded)?.message, "nope");
  });
});
