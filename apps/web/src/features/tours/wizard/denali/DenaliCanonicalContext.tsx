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
};

const DenaliCanonicalContext = createContext<DenaliCanonicalContextValue | null>(null);

function basicsSelectionFromTourType(
  tourType: DenaliCreateTourWizardForm["basicInfo"]["tourType"],
): DenaliCanonicalBasicsSelection {
  return (
    readDenaliCanonicalBasics(tourType) ?? {
      category: "mountain",
      duration: "single_day",
    }
  );
}

export function DenaliCanonicalProvider({
  children,
  formMethods,
  syncToken = 0,
  resetWizard,
}: {
  children: ReactNode;
  formMethods: UseFormReturn<DenaliCreateTourWizardForm>;
  /** Increment after RHF `reset` (draft restore) to re-hydrate canonical state from form. */
  syncToken?: number;
  resetWizard: () => void;
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

  useEffect(() => {
    const form = getValues();
    setCanonicalModel(denaliFormToCanonical(form));
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

  const value = useMemo(
    (): DenaliCanonicalContextValue => ({
      canonicalModel,
      basicsSelection,
      ui,
      updateCanonical,
      updateCanonicalBasics,
      resetWizard,
    }),
    [basicsSelection, canonicalModel, ui, updateCanonical, updateCanonicalBasics, resetWizard],
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
