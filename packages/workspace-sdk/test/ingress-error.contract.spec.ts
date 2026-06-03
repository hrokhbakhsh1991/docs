import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  explainWorkspacePluginRejection,
  IngressSanitizationError,
  parseCanonicalDocumentFromStorage,
  tryParseCanonicalDocumentFromStorage,
  tryParseWorkspacePluginFromStorage,
  validateWorkspacePlugin,
  WorkspacePluginShapeError,
  isWorkspaceSdkValidationError,
} from "../src/index.js";
import { createFreshStarterPlugin } from "./lib/immutable-harness.js";

const SDK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(SDK_ROOT, "src");

function collectSrcTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) files.push(...collectSrcTsFiles(p));
    else if (ent.isFile() && ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
      files.push(p);
    }
  }
  return files;
}

describe("ingress error taxonomy contract (OF-01 / OF-03–07 / OF-06 / OF-14)", () => {
  it("src has no console.* (ND-ZT-05)", () => {
    const consoleUseRe = /\bconsole\.(log|debug|info|warn|error|trace)\s*\(/;
    const offenders: string[] = [];
    for (const file of collectSrcTsFiles(SRC_ROOT)) {
      const text = fs.readFileSync(file, "utf8");
      if (consoleUseRe.test(text)) {
        offenders.push(path.relative(SDK_ROOT, file));
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("tryParseCanonicalDocumentFromStorage returns ACCESSOR_PROPERTY for polluted getters", () => {
    const payload: Record<string, unknown> = {
      schemaVersion: 1,
      roots: ["basics"],
      data: { basics: {} },
    };
    Object.defineProperty((payload.data as Record<string, unknown>).basics as object, "title", {
      get() {
        return "exfiltrated";
      },
      enumerable: true,
    });

    const result = tryParseCanonicalDocumentFromStorage(payload);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "ACCESSOR_PROPERTY");
      assert.ok(result.error.path?.includes("basics"));
    }
  });

  it("parseCanonicalDocumentFromStorage throws IngressSanitizationError for accessor pollution", () => {
    const payload: Record<string, unknown> = {
      schemaVersion: 1,
      roots: ["basics"],
      data: { basics: {} },
    };
    Object.defineProperty((payload.data as Record<string, unknown>).basics as object, "title", {
      get() {
        return "exfiltrated";
      },
      enumerable: true,
    });

    assert.throws(
      () => parseCanonicalDocumentFromStorage(payload),
      (error: unknown) => {
        assert.ok(error instanceof IngressSanitizationError);
        assert.equal(error.code, "ACCESSOR_PROPERTY");
        return true;
      },
    );
  });

  it("tryParseWorkspacePluginFromStorage rejects embedded functions in stored JSON trees", () => {
    const payload = JSON.parse(JSON.stringify(createFreshStarterPlugin())) as Record<
      string,
      unknown
    >;
    payload.rogueRuntimeHook = () => null;

    const result = tryParseWorkspacePluginFromStorage(payload);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "FUNCTION_NOT_ALLOWED");
    }
  });

  it("tryParseWorkspacePluginFromStorage returns PLUGIN_INVALID_ROOT for null root", () => {
    const result = tryParseWorkspacePluginFromStorage(null);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "PLUGIN_INVALID_ROOT");
    }
  });

  it("explainWorkspacePluginRejection returns typed code for empty object", () => {
    const rejection = explainWorkspacePluginRejection({});
    assert.ok(rejection instanceof WorkspacePluginShapeError);
    assert.equal(rejection.code, "PLUGIN_INVALID_SHAPE");
  });

  it("validateWorkspacePlugin returns SdkResult with stable code", () => {
    const result = validateWorkspacePlugin({});
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "PLUGIN_INVALID_SHAPE");
    }
  });
});
