import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, before, describe, it } from "node:test";

import {
  clearWorkspaceIntakePluginRegistryForTests,
  listWorkspaceIntakePluginIds,
} from "@app-tour/workspace-sdk";
import {
  invokeWorkspaceIntakeRegister,
  invokeWorkspacePluginRegister,
} from "../../guest-workspace-runtime/src/workspace-plugin-register-manifest.generated.ts";
import { bindPortalRegisterInvokersForHostTests } from "./bind-portal-register-invokers";
import {
  resetWorkspacePluginBootstrapTelemetryForTests,
  setWorkspacePluginBootstrapTelemetrySink,
  type WorkspacePluginBootstrapTelemetryEvent,
} from "../src/workspace-plugin-bootstrap-telemetry";

const HOST_SRC = path.join(import.meta.dirname, "..", "src");
const WORKSPACE_PACKAGE_PATTERN =
  /^import\s+.*from\s+["']@app-tour\/workspace-(denali|urban|starter|guest-club)/;

function captureBootstrapTelemetry(): {
  readonly events: WorkspacePluginBootstrapTelemetryEvent[];
  readonly restore: () => void;
} {
  const events: WorkspacePluginBootstrapTelemetryEvent[] = [];
  setWorkspacePluginBootstrapTelemetrySink((event) => {
    events.push(event);
  });
  return {
    events,
    restore: () => {
      resetWorkspacePluginBootstrapTelemetryForTests();
    },
  };
}

afterEach(async () => {
  resetWorkspacePluginBootstrapTelemetryForTests();
  clearWorkspaceIntakePluginRegistryForTests();

  const { resetWorkspacePluginBootstrapStateForTests } = await import("../src/register-safe");
  resetWorkspacePluginBootstrapStateForTests();
  bindPortalRegisterInvokersForHostTests();
});

before(() => {
  bindPortalRegisterInvokersForHostTests();
});

describe("workspace plugin bootstrap — import graph audit", () => {
  it("HOST-AUDIT-01 register orchestration has no static workspace package imports", () => {
    const orchestrationFiles = [
      "register.ts",
      "register-safe.ts",
      "intake-register.ts",
      "workspace-plugin-register-manifest.generated.ts",
    ];

    for (const fileName of orchestrationFiles) {
      const content = fs.readFileSync(path.join(HOST_SRC, fileName), "utf8");
      const lines = content.split("\n");
      for (const [index, line] of lines.entries()) {
        assert.equal(
          WORKSPACE_PACKAGE_PATTERN.test(line.trim()),
          false,
          `${fileName}:${index + 1} must not statically import workspace packages: ${line.trim()}`,
        );
      }
    }
  });

  it("HOST-AUDIT-02 generated per-plugin registrars use dynamic import() for workspace packages", () => {
    const RUNTIME_SRC = path.join(
      import.meta.dirname,
      "..",
      "..",
      "guest-workspace-runtime",
      "src",
    );
    const generated = fs
      .readdirSync(RUNTIME_SRC)
      .filter((name) => name.startsWith("register-") && name.endsWith(".generated.ts"));

    assert.ok(generated.length > 0, "expected register-*.generated.ts under guest-workspace-runtime");

    for (const fileName of generated) {
      const content = fs.readFileSync(path.join(RUNTIME_SRC, fileName), "utf8");
      const lines = content.split("\n");
      for (const [index, line] of lines.entries()) {
        assert.equal(
          WORKSPACE_PACKAGE_PATTERN.test(line.trim()),
          false,
          `${fileName}:${index + 1} must not statically import workspace packages`,
        );
      }

      assert.match(
        content,
        /await import\("@app-tour\/workspace-/,
        `${fileName} must lazy-load workspace packages via await import()`,
      );
      assert.doesNotMatch(
        content,
        /ensureWorkspacePluginsRegistered\(\)/,
        `${fileName} must not trigger import-time registration`,
      );
    }
  });
});

describe("workspace plugin bootstrap — fault injection chaos", () => {
  it("HOST-CHAOS-01 denali import failure isolates siblings and emits bootstrap telemetry", async () => {
    const telemetry = captureBootstrapTelemetry();
    const {
      __test_setWorkspacePluginRegisterInvokers,
      registerAllWorkspacePluginsSafe,
      registerWorkspaceIntakeSafe,
      getWorkspacePluginBootstrapStatus,
    } = await import("../src/register-safe");

    __test_setWorkspacePluginRegisterInvokers({
      full: async (pluginId) => {
        if (pluginId === "denali") {
          throw new Error("WORKSPACE_PLUGIN_LOAD_FAILED:denali:CHAOS_INJECTION");
        }
        await invokeWorkspacePluginRegister(pluginId);
      },
      intake: async (pluginId) => {
        if (pluginId === "denali") {
          throw new Error("WORKSPACE_PLUGIN_LOAD_FAILED:denali:CHAOS_INJECTION");
        }
        await invokeWorkspaceIntakeRegister(pluginId);
      },
    });

    const results = await registerAllWorkspacePluginsSafe();

    const denaliResult = results.find((result) => result.pluginId === "denali");
    assert.equal(denaliResult?.status, "failed");

    assert.equal(getWorkspacePluginBootstrapStatus("denali")?.status, "failed");

    const urbanIntake = await registerWorkspaceIntakeSafe("urban");
    assert.equal(urbanIntake.status, "ready");
    const denaliIntake = await registerWorkspaceIntakeSafe("denali");
    assert.equal(denaliIntake.status, "failed");
    assert.ok(listWorkspaceIntakePluginIds().includes("urban"));
    assert.ok(!listWorkspaceIntakePluginIds().includes("denali"));

    const denaliFailureEvents = telemetry.events.filter(
      (event) =>
        event.kind === "workspacePluginBootstrapStatus" &&
        event.pluginId === "denali" &&
        event.status === "failed",
    );
    assert.ok(denaliFailureEvents.length >= 1);
    assert.equal(denaliFailureEvents[0]?.code, "WORKSPACE_PLUGIN_LOAD_FAILED");
    assert.match(denaliFailureEvents[0]?.message ?? "", /CHAOS_INJECTION/);

    telemetry.restore();
  });

  it("HOST-CHAOS-02 registerAllWorkspacePluginsSafe never throws when one plugin is broken", async () => {
    const { __test_setWorkspacePluginRegisterInvokers, registerAllWorkspacePluginsSafe } =
      await import("../src/register-safe");

    __test_setWorkspacePluginRegisterInvokers({
      full: async (pluginId) => {
        if (pluginId === "denali") {
          throw new Error("WORKSPACE_PLUGIN_LOAD_FAILED:denali:CHAOS_INJECTION");
        }
        await invokeWorkspacePluginRegister(pluginId);
      },
    });

    await assert.doesNotReject(() => registerAllWorkspacePluginsSafe());
  });
});
