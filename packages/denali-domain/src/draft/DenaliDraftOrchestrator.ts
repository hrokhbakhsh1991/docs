import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { migrateDenaliDraftStepIndex, DENALI_WIZARD_RAIL_LAYOUT_VERSION } from "./denaliRailLayout";
import type {
  DenaliDraftHydrateResult,
  DenaliDraftSyncPayload,
  DenaliDraftSyncWarningHandler,
} from "./denaliDraftSync.types";
import { DENALI_REGISTRY_LAYOUT_VERSION } from "./denaliRegistryLayout";
import { pruneDenaliWizardFormToRegistry } from "./pruneDenaliWizardFormToRegistry";
import { resetWizardToRegistryDefaults } from "./resetWizardToRegistryDefaults";

export type DenaliDraftOrchestratorOptions = {
  readonly registryLayoutVersion?: number;
  readonly onWarning?: DenaliDraftSyncWarningHandler;
};

function mergeOntoRegistryDefaults(
  prunedRemote: DenaliCreateTourWizardForm,
): DenaliCreateTourWizardForm {
  const baseline = resetWizardToRegistryDefaults();
  const overlay = pruneDenaliWizardFormToRegistry(prunedRemote);
  const baselineRecord = baseline as unknown as Record<string, unknown>;
  const overlayRecord = overlay as unknown as Record<string, unknown>;
  for (const key of Object.keys(overlayRecord)) {
    if (overlayRecord[key] !== undefined) {
      baselineRecord[key] = overlayRecord[key];
    }
  }
  return pruneDenaliWizardFormToRegistry(baseline);
}

/**
 * Multi-device draft sync: prune, version, hydrate, and reset for Denali create wizard.
 */
export class DenaliDraftOrchestrator {
  readonly registryLayoutVersion: number;

  private readonly onWarning?: DenaliDraftSyncWarningHandler;

  constructor(options: DenaliDraftOrchestratorOptions = {}) {
    this.registryLayoutVersion = options.registryLayoutVersion ?? DENALI_REGISTRY_LAYOUT_VERSION;
    this.onWarning = options.onWarning;
  }

  private warn(message: string): void {
    this.onWarning?.(message);
  }

  resetWizardToRegistryDefaults(): DenaliCreateTourWizardForm {
    return resetWizardToRegistryDefaults();
  }

  prepareDraftForSync(
    formData: DenaliCreateTourWizardForm,
    meta: { currentStepIndex: number; registryLayoutVersion?: number },
  ): DenaliDraftSyncPayload {
    return {
      form: pruneDenaliWizardFormToRegistry(formData),
      currentStepIndex: meta.currentStepIndex,
      railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
      registryLayoutVersion: meta.registryLayoutVersion ?? this.registryLayoutVersion,
    };
  }

  hydrateDraftFromSync(
    remoteData: Partial<DenaliDraftSyncPayload> & { form: DenaliCreateTourWizardForm },
    currentRegistryVersion: number = this.registryLayoutVersion,
  ): DenaliDraftHydrateResult {
    const warnings: string[] = [];
    const remoteRegistryVersion = remoteData.registryLayoutVersion ?? 1;
    const remoteRailVersion = remoteData.railLayoutVersion ?? 1;

    if (remoteRegistryVersion > currentRegistryVersion) {
      const message =
        `Remote registry layout v${remoteRegistryVersion} is newer than client v${currentRegistryVersion}; discarding remote draft form.`;
      warnings.push(message);
      this.warn(message);
      return {
        status: "discarded",
        warnings,
        snapshot: {
          form: this.resetWizardToRegistryDefaults(),
          currentStepIndex: 0,
          railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
          registryLayoutVersion: currentRegistryVersion,
        },
      };
    }

    let status: DenaliDraftHydrateResult["status"] = "ok";
    let form = pruneDenaliWizardFormToRegistry(remoteData.form);

    if (remoteRegistryVersion < currentRegistryVersion) {
      const message = `Migrating draft from registry layout v${remoteRegistryVersion} to v${currentRegistryVersion}.`;
      warnings.push(message);
      this.warn(message);
      form = mergeOntoRegistryDefaults(form);
      status = "migrated";
    }

    const currentStepIndex = migrateDenaliDraftStepIndex(
      remoteData.currentStepIndex ?? 0,
      remoteRailVersion,
    );

    return {
      status,
      warnings,
      snapshot: {
        form,
        currentStepIndex,
        railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
        registryLayoutVersion: currentRegistryVersion,
      },
    };
  }
}

export const denaliDraftOrchestrator = new DenaliDraftOrchestrator();

export function prepareDraftForSync(
  formData: DenaliCreateTourWizardForm,
  meta: { currentStepIndex: number; registryLayoutVersion?: number },
): DenaliDraftSyncPayload {
  return denaliDraftOrchestrator.prepareDraftForSync(formData, meta);
}

export function hydrateDraftFromSync(
  remoteData: Partial<DenaliDraftSyncPayload> & { form: DenaliCreateTourWizardForm },
  currentRegistryVersion?: number,
): DenaliDraftHydrateResult {
  return denaliDraftOrchestrator.hydrateDraftFromSync(remoteData, currentRegistryVersion);
}
