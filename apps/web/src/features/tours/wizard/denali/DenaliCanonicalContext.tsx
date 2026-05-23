"use client";

import {
  type DenaliCanonicalBasicsSelection,
  type DenaliEventVariant,
  type DenaliTourCategory,
  type DenaliTourDuration,
} from "@repo/types";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

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

import { getDenaliUIFromForm, type DenaliCanonicalUIContext } from "./rules/denaliUIAdapter";

export type DenaliCanonicalContextValue = {
  readonly canonicalModel: DenaliCanonicalTourModel;
  readonly basicsSelection: DenaliCanonicalBasicsSelection;
  readonly ui: DenaliCanonicalUIContext;
  updateCanonical: (patch: DenaliCanonicalPartial) => void;
  updateCanonicalBasics: (patch: Partial<DenaliCanonicalBasicsSelection>) => void;
  resetWizard: () => void;
  /** Re-hydrate canonical UI from current RHF values (e.g. immediately after `reset`). */
  flushCanonicalFromForm: () => void;
  /** Bumped when draft clear forces title input remount (DOM hard-reset). */
  readonly titleInputResetKey: number;
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
  onResetWizard,
  onCanonicalSyncAfterClear,
}: {
  children: ReactNode;
  formMethods: UseFormReturn<DenaliCreateTourWizardForm>;
  /** Increment after RHF `reset` (draft restore) to re-hydrate canonical state from form. */
  syncToken?: number;
  /** Parent clears RHF + step index (no canonical sync token bump). */
  onResetWizard: () => void;
  /** Parent bumps canonical sync token after hard title clear (avoids reactive lag). */
  onCanonicalSyncAfterClear?: () => void;
}) {
  const { control, getValues, setValue } = formMethods;

  const tourTypeWatch = useWatch({ control, name: "basicInfo.tourType" });
  const transportModeWatch = useWatch({ control, name: "transport.transportMode" });
  const requiresPaymentWatch = useWatch({
    control,
    name: "pricingPayment.requiresPayment",
  });

  const [canonicalModel, setCanonicalModel] = useState<DenaliCanonicalTourModel>(() =>
    denaliFormToCanonical(getValues()),
  );
  const [titleInputResetKey, setTitleInputResetKey] = useState(0);

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

  /** Re-resolve rule model when classification or contextual dong/price toggles change. */
  const ui = useMemo(
    () => getDenaliUIFromForm(getValues()),
    [tourTypeWatch, transportModeWatch, requiresPaymentWatch, syncToken],
  );

  const commitCanonical = useCallback(
    (next: DenaliCanonicalTourModel, basics: DenaliCanonicalBasicsSelection) => {
      const currentForm = getValues();
      const nextFormRaw = denaliCanonicalToForm(next, currentForm, { basics });
      const safeForm = applyDenaliInvariantState(nextFormRaw);

      applyCanonicalMvpToForm(next, currentForm, { basics, setValue });

      setCanonicalModel(denaliFormToCanonical(safeForm));
    },
    [getValues, setValue],
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

  const flushCanonicalFromForm = useCallback(() => {
    const form = getValues();
    const next = denaliFormToCanonical(form);
    setCanonicalModel({
      ...next,
      title: form.basicInfo.title?.trim() ?? "",
    });
  }, [getValues]);

  const forceCanonicalTitleEmpty = useCallback(() => {
    const defaults = buildDenaliTourCreateDefaultValues();
    const fromDefaults = denaliFormToCanonical(defaults);
    setCanonicalModel({
      ...fromDefaults,
      title: "",
    });
    setValue("basicInfo.title", "", {
      shouldDirty: false,
      shouldValidate: false,
    });
    setTitleInputResetKey((key) => key + 1);
  }, [setValue]);

  const resetWizard = useCallback(() => {
    onResetWizard();
    forceCanonicalTitleEmpty();
    onCanonicalSyncAfterClear?.();
  }, [forceCanonicalTitleEmpty, onCanonicalSyncAfterClear, onResetWizard]);

  const value = useMemo(
    (): DenaliCanonicalContextValue => ({
      canonicalModel,
      basicsSelection,
      ui,
      updateCanonical,
      updateCanonicalBasics,
      resetWizard,
      flushCanonicalFromForm,
      titleInputResetKey,
    }),
    [
      basicsSelection,
      canonicalModel,
      flushCanonicalFromForm,
      resetWizard,
      titleInputResetKey,
      ui,
      updateCanonical,
      updateCanonicalBasics,
    ],
  );

  return <DenaliCanonicalContext.Provider value={value}>{children}</DenaliCanonicalContext.Provider>;
}

export function useDenaliCanonical(): DenaliCanonicalContextValue {
  const ctx = useContext(DenaliCanonicalContext);
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
