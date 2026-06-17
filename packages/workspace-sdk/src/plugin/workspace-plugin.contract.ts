import type { WorkspaceFieldRegistry } from "../registry/field-registry";
import type { WorkspaceRuleSet } from "../registry/rule-set";
import type { WorkspaceLifecycleContract } from "./workspace-lifecycle";
import type { WorkspacePluginId } from "./workspace-plugin-id";
import type { WorkspaceTypeId } from "./workspace-type-id";
import type { WorkspaceValidationHooks } from "./workspace-validation";
import type { WorkspaceThemeContract } from "../theme/workspace-theme.contract";
import type { WorkspaceWizardSurface } from "./workspace-wizard-surface";
import type { OperatorRegistrationOpsSurface } from "../operator/bookings/registration-ops-manifest";
import type { OperatorSettingsSurface } from "../operator/settings/settings-module-manifest";
import type { OperatorTourListSurface } from "../tour/tour-list-projection.contract";
import type { PublicCatalogSurface } from "../tour/public-catalog.contract";
import type { TourCloneHydrator } from "../tour/tour-clone-hydrator.contract";
import type { WorkspaceWizardHostHooks } from "./workspace-wizard-host-hooks";
import type { WorkspaceDraftTombstoneBinding } from "../draft/workspace-draft-tombstone-binding";

/**
 * Workspace plugin contract.
 *
 * Platform code depends on this interface; concrete workspaces implement it
 * under `packages/workspaces/*` without coupling core to a business model.
 */
export interface WorkspacePlugin {
  readonly id: WorkspacePluginId;
  readonly version: number;
  /** SDK major — bump when `WorkspacePlugin` shape breaks (MAP §8). */
  readonly contractVersion: 1;
  readonly supportedWorkspaceTypes: readonly WorkspaceTypeId[];
  readonly fieldRegistry: WorkspaceFieldRegistry;
  readonly ruleSet: WorkspaceRuleSet;
  readonly wizard: WorkspaceWizardSurface;
  readonly validation: WorkspaceValidationHooks;
  readonly lifecycle: WorkspaceLifecycleContract;
  /** Optional workspace brand tokens (`--ws-*` CSS variables). */
  readonly theme?: WorkspaceThemeContract;
  /** Phase 9.5 — Registration Command Center manifest (DEC-P9-011). */
  readonly registrationOps?: OperatorRegistrationOpsSurface;
  /** Phase 9.6 — Settings module registry (DEC-P9-009). */
  readonly operatorSettings?: OperatorSettingsSurface;
  /** Phase 9.3 — Operator list projection extractor (DEC-P9-014). */
  readonly tourList?: OperatorTourListSurface;
  /** Marketing public catalog — publish gate + egress card (ADR-MKT-003). */
  readonly publicCatalog?: PublicCatalogSurface;
  /** Phase 11.6 — `?clone=tourId` wizard draft hydrator (DEC-P11-007). */
  readonly tourClone?: TourCloneHydrator;
  /** Phase 12.0 — generic web wizard host behavior (DEC-P12-001). Denali first implementer. */
  readonly wizardHost?: WorkspaceWizardHostHooks;
  /** Phase 11 Track A — server PATCH tombstone diff (workspace-specific root set). */
  readonly draftTombstone?: WorkspaceDraftTombstoneBinding;
}
