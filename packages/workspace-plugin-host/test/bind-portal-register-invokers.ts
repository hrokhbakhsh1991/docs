/**
 * Host unit tests — bind runtime-owned registrars (relative path avoids host↔runtime cycle).
 */
import { setWorkspacePluginRegisterInvokers } from "../src/register-safe";
import {
  invokeWorkspaceIntakeRegister,
  invokeWorkspacePluginRegister,
} from "../../guest-workspace-runtime/src/workspace-plugin-register-manifest.generated.ts";

export function bindPortalRegisterInvokersForHostTests(): void {
  setWorkspacePluginRegisterInvokers({
    full: invokeWorkspacePluginRegister,
    intake: invokeWorkspaceIntakeRegister,
  });
}
