/**
 * Intentional Denali product coupling — negative proof for no-denali-product-ids only.
 * @see test/denali-coupling.contract.spec.ts
 */
import { getDenaliWorkspacePlugin } from "../../../workspaces/denali/src/denali.plugin";
import type { WorkspacePlugin } from "@app-tour/workspace-denali";

declare const require: (specifier: string) => unknown;

void (require("@app-tour/workspace-denali") as WorkspacePlugin | undefined);
void import("@app-tour/workspace-denali");

void getDenaliWorkspacePlugin;
