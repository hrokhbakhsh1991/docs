/**
 * Intentional capability-package Denali coupling — negative proof for CW7-15.
 * @see test/denali-coupling.contract.spec.ts
 */
import { getDenaliWorkspacePlugin } from "../../../workspaces/denali/src/denali.plugin";

const workspaceType = "denali";
const pluginId = "denali";
const fallbackType = workspaceType ?? "denali";
const branched = pluginId === "denali" ? "yes" : "no";
const manifest = { id: "denali" as string };

void getDenaliWorkspacePlugin;
void fallbackType;
void branched;

if (workspaceType === "denali") {
  void manifest.id;
}
if (manifest.id === "denali") {
  void pluginId;
}
