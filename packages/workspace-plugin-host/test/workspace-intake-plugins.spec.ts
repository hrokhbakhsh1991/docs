import { bindPortalRegisterInvokersForHostTests } from "./bind-portal-register-invokers";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureWorkspaceIntakePluginsRegistered } from "../src/register";
import {
  listWorkspaceIntakePluginIds,
  resolveIntakeSchema,
} from "@app-tour/workspace-sdk";

describe("workspace-plugin-host intake bootstrap", () => {
  it("HOST-INT-01 registers denali and urban intake plugins", async () => {
    bindPortalRegisterInvokersForHostTests();
    await ensureWorkspaceIntakePluginsRegistered();
    assert.deepEqual(listWorkspaceIntakePluginIds(), ["denali", "guest-club", "urban"]);
    assert.equal(resolveIntakeSchema("denali").fields.some((field) => field.id === "nationalId"), true);
    assert.equal(resolveIntakeSchema("urban").fields.some((field) => field.id === "email"), true);
  });
});
