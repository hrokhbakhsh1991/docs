/**
 * Intentional Denali product coupling — negative proof for no-denali-product-ids only.
 * @see test/denali-coupling.contract.spec.ts
 */
import { getDenaliWorkspacePlugin } from "../../../workspaces/denali/src/denali.plugin";

void getDenaliWorkspacePlugin;
