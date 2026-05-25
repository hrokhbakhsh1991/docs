"use client";

import {
  type DenaliCanonicalBasicsSelection,
  type DenaliEventVariant,
  type DenaliTourCategory,
  type DenaliTourDuration,
} from "@repo/types";
import type { TourFormProfile } from "@repo/types";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import {
  applyCanonicalMvpToForm,
  applyDenaliInvariantState,
  basicsDurationToCanonicalDuration,
  denaliCanonicalToForm,
  denaliFormToCanonical,
  mergeDenaliCanonicalPartial,
  type DenaliCanonicalPartial,
} from "./denaliCanonicalFormAdapter";
import {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "./denaliCanonicalBasicsControl";
import { createDenaliWizardUploadTour } from "./createDenaliWizardUploadTour";
import {
  collectDenaliUnpersistedPhotoBlobIssues,
  formatDenaliPhotoPersistenceWarning,
  type DenaliPhotoPersistenceIssue,
} from "./denaliPhotoPersistence";

import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import { getDenaliUIFromForm, type DenaliCanonicalUIContext } from "./rules/denaliUIAdapter";
import { resolveDenaliRuleSetFromTemplate } from "./validation/denaliRuleAccess";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

export type DenaliPhotoPersistenceCheck = {
  ok: boolean;
  issues: readonly DenaliPhotoPersistenceIssue[];
  message: string;
};

export type DenaliCanonicalContextValue = {
  readonly canonicalModel: DenaliCanonicalTourModel;
  readonly basicsSelection: DenaliCanonicalBasicsSelection;
  readonly ruleSet: DenaliRuleSet;
  readonly ui: DenaliCanonicalUIContext;
  /** Tour id used for `POST /api/tours/:tourId/photos` (edit mode or create staging shell). */
  readonly uploadTourId: string | null;
  readonly photoPersistenceWarning: string | null;
  updateCanonical: (patch: DenaliCanonicalPartial) => void;
  updateCanonicalBasics: (patch: Partial<DenaliCanonicalBasicsSelection>) => void;
  /** Ensures a draft tour exists for gallery upload in create mode. */
  ensureUploadTourId: () => Promise<string>;
  /** Run before submit — surfaces blob: URLs instead of silent strip. */
  checkPhotoPersistence: (form?: DenaliCreateTourWizardForm) => DenaliPhotoPersistenceCheck;
  clearPhotoPersistenceWarning: () => void;
};

const DenaliCanonicalContext = createContext<DenaliCanonicalContextValue | null>(null);

function basicsSelectionFromTourType(
  tourType: DenaliCreateTourWizardForm["basicInfo"]["tourType"],
): DenaliCanonicalBasicsSelection {
  const fromType = readDenaliCanonicalBasics(tourType);
  if (fromType) {
    return fromType;
  }
  return {
    category: "" as DenaliTourCategory,
    duration: "" as DenaliTourDuration,
  };
}

export function DenaliCanonicalProvider({
  children,
  formMethods,
  syncToken = 0,
  wizardTemplate,
  uploadTourId: uploadTourIdProp = null,
  workspaceFormProfile,
}: {
  children: ReactNode;
  formMethods: UseFormReturn<DenaliCreateTourWizardForm>;
  /** Increment after RHF `reset` (e.g. clone/preset hydrate) to re-hydrate canonical state from form. */
  syncToken?: number;
  /** Workspace template; overlay merged into {@link ruleSet}. */
  wizardTemplate?: TenantWizardTemplate | null;
  /** When set (edit mode), gallery uploads target this tour. */
  uploadTourId?: string | null;
  /** Required for lazy draft-tour creation on first gallery upload in create mode. */
  workspaceFormProfile?: TourFormProfile;
}) {
  const { control, getValues, setValue } = formMethods;

  const tourTypeWatch = useWatch({ control, name: "basicInfo.tourType" });
  const transportModeWatch = useWatch({ control, name: "transport.transportMode" });
  const adminCapacityApprovalWatch = useWatch({
    control,
    name: "transport.adminCapacityApproval",
  });
  const allowPersonalCarWatch = useWatch({ control, name: "transport.allowPersonalCar" });
  const requiresPaymentWatch = useWatch({
    control,
    name: "pricingPayment.requiresPayment",
  });

  const [canonicalModel, setCanonicalModel] = useState<DenaliCanonicalTourModel>(() =>
    denaliFormToCanonical(getValues()),
  );
  const [uploadTourIdState, setUploadTourIdState] = useState<string | null>(
    uploadTourIdProp?.trim() || null,
  );
  const [photoPersistenceWarning, setPhotoPersistenceWarning] = useState<string | null>(null);
  const uploadTourIdRef = useRef<string | null>(uploadTourIdProp?.trim() || null);
  const ensureUploadPromiseRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    const next = uploadTourIdProp?.trim() || null;
    uploadTourIdRef.current = next;
    setUploadTourIdState(next);
  }, [uploadTourIdProp]);

  useEffect(() => {
    const form = getValues();
    const next = denaliFormToCanonical(form);
    setCanonicalModel({
      ...next,
      title: form.basicInfo.title?.trim() ?? "",
    });
  }, [syncToken, getValues]);

  const basicsSelection = useMemo(
    () => basicsSelectionFromTourType(tourTypeWatch ?? getValues().basicInfo.tourType),
    [tourTypeWatch, syncToken],
  );

  const ruleSet = useMemo(
    () => resolveDenaliRuleSetFromTemplate(wizardTemplate),
    [wizardTemplate],
  );

  const ui = useMemo(
    () => getDenaliUIFromForm(getValues(), ruleSet),
    [tourTypeWatch, transportModeWatch, adminCapacityApprovalWatch, allowPersonalCarWatch, requiresPaymentWatch, syncToken, ruleSet, getValues],
  );

  const commitCanonical = useCallback(
    (next: DenaliCanonicalTourModel, basics: DenaliCanonicalBasicsSelection) => {
      const currentForm = getValues();
      const nextFormRaw = denaliCanonicalToForm(next, currentForm, { basics });
      const safeForm = applyDenaliInvariantState(nextFormRaw, undefined, ruleSet);

      applyCanonicalMvpToForm(next, currentForm, { basics, setValue, ruleSet });

      setCanonicalModel(denaliFormToCanonical(safeForm));
    },
    [getValues, ruleSet, setValue],
  );

  const updateCanonical = useCallback(
    (patch: DenaliCanonicalPartial) => {
      const merged = mergeDenaliCanonicalPartial(canonicalModel, patch);
      commitCanonical(merged, basicsSelection);
    },
    [basicsSelection, canonicalModel, commitCanonical],
  );

  const updateCanonicalBasics = useCallback(
    (patch: Partial<DenaliCanonicalBasicsSelection>) => {
      const nextKind = patchDenaliCanonicalBasics(getValues().basicInfo.tourType, patch);
      const mergedBasics = basicsSelectionFromTourType(nextKind);
      const merged = mergeDenaliCanonicalPartial(canonicalModel, {
        category: mergedBasics.category as DenaliCanonicalTourModel["category"],
        duration: basicsDurationToCanonicalDuration(mergedBasics.duration),
      });
      commitCanonical(merged, mergedBasics);
    },
    [canonicalModel, commitCanonical, getValues],
  );

  const ensureUploadTourId = useCallback(async (): Promise<string> => {
    const existing = uploadTourIdRef.current;
    if (existing) {
      return existing;
    }
    if (ensureUploadPromiseRef.current) {
      return ensureUploadPromiseRef.current;
    }
    if (!workspaceFormProfile) {
      throw new Error("DenaliCanonicalProvider: workspaceFormProfile is required for gallery upload");
    }
    const promise = createDenaliWizardUploadTour({ workspaceFormProfile }).then((id) => {
      uploadTourIdRef.current = id;
      setUploadTourIdState(id);
      return id;
    });
    ensureUploadPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      ensureUploadPromiseRef.current = null;
    }
  }, [workspaceFormProfile]);

  const checkPhotoPersistence = useCallback(
    (form?: DenaliCreateTourWizardForm): DenaliPhotoPersistenceCheck => {
      const target = form ?? getValues();
      const issues = collectDenaliUnpersistedPhotoBlobIssues(target);
      const message = formatDenaliPhotoPersistenceWarning(issues);
      if (message) {
        setPhotoPersistenceWarning(message);
      }
      return {
        ok: issues.length === 0,
        issues,
        message,
      };
    },
    [getValues],
  );

  const clearPhotoPersistenceWarning = useCallback(() => {
    setPhotoPersistenceWarning(null);
  }, []);

  const value = useMemo(
    (): DenaliCanonicalContextValue => ({
      canonicalModel,
      basicsSelection,
      ruleSet,
      ui,
      uploadTourId: uploadTourIdState,
      photoPersistenceWarning,
      updateCanonical,
      updateCanonicalBasics,
      ensureUploadTourId,
      checkPhotoPersistence,
      clearPhotoPersistenceWarning,
    }),
    [
      basicsSelection,
      canonicalModel,
      checkPhotoPersistence,
      clearPhotoPersistenceWarning,
      ensureUploadTourId,
      photoPersistenceWarning,
      ruleSet,
      ui,
      updateCanonical,
      updateCanonicalBasics,
      uploadTourIdState,
    ],
  );

  return <DenaliCanonicalContext.Provider value={value}>{children}</DenaliCanonicalContext.Provider>;
}

export function useDenaliCanonicalOptional(): DenaliCanonicalContextValue | null {
  return useContext(DenaliCanonicalContext);
}

export function useDenaliCanonical(): DenaliCanonicalContextValue {
  const ctx = useDenaliCanonicalOptional();
  if (ctx == null) {
    throw new Error("useDenaliCanonical must be used within DenaliCanonicalProvider");
  }
  return ctx;
}

/** Map canonical basics to legacy duration select tokens. */
export function denaliBasicsDurationFromCanonical(
  duration: DenaliCanonicalTourModel["duration"],
): DenaliTourDuration {
  return duration === "multi" ? "multi_day" : "single_day";
}

export type { DenaliTourCategory, DenaliTourDuration, DenaliEventVariant };
