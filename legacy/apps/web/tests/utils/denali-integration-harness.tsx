import React, { type ReactNode } from "react";
import { FormProvider, useForm, useFormContext, type UseFormReturn } from "react-hook-form";

import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { DenaliWizardNavigationProvider } from "@/features/tours/wizard/denali/DenaliWizardNavigationContext";
import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { AppTestProviders } from "@/lib/test/AppTestProviders";

export { AppTestProviders } from "@/lib/test/AppTestProviders";

type DenaliNavigationProviderConfig = {
  visibleSteps: readonly DenaliCreateWizardStepId[];
  currentStepIndex: number;
  setCurrentStep: (_updater: (_prev: number) => number) => void;
};

export type DenaliFormHarnessProps = {
  defaultValues: DenaliCreateTourWizardForm;
  /** When false, skips theme/query/auth shell (perf/memlab). Default true. */
  withAppShell?: boolean;
  children: ReactNode | ((ctx: { formMethods: UseFormReturn<DenaliCreateTourWizardForm> }) => ReactNode);
};

function DenaliFormTree({
  formMethods,
  children,
}: {
  formMethods: UseFormReturn<DenaliCreateTourWizardForm>;
  children: ReactNode;
}) {
  return (
    <FormProvider {...formMethods}>
      <DenaliCanonicalProvider formMethods={formMethods}>{children}</DenaliCanonicalProvider>
    </FormProvider>
  );
}

/** App shell + RHF + Denali canonical context. */
export function DenaliFormHarness({
  defaultValues,
  withAppShell = true,
  children,
}: DenaliFormHarnessProps) {
  const formMethods = useForm<DenaliCreateTourWizardForm>({ defaultValues });
  const body = typeof children === "function" ? children({ formMethods }) : children;
  const tree = <DenaliFormTree formMethods={formMethods}>{body}</DenaliFormTree>;

  return withAppShell ? <AppTestProviders>{tree}</AppTestProviders> : tree;
}

export type DenaliNavigationHarnessProps = DenaliNavigationProviderConfig & {
  children: ReactNode;
};

/** App shell + Denali wizard navigation (no form). */
export function DenaliNavigationHarness({
  children,
  ...navigationProps
}: DenaliNavigationHarnessProps) {
  return (
    <AppTestProviders>
      <DenaliWizardNavigationProvider {...navigationProps}>{children}</DenaliWizardNavigationProvider>
    </AppTestProviders>
  );
}

type DenaliFormNavigationHarnessProps = {
  defaultValues: DenaliCreateTourWizardForm;
  navigation: DenaliNavigationProviderConfig;
  children: ReactNode;
};

/** App shell + form + canonical + navigation. */
export function DenaliFormNavigationHarness({
  defaultValues,
  navigation,
  children,
}: DenaliFormNavigationHarnessProps) {
  return (
    <DenaliFormHarness defaultValues={defaultValues}>
      <DenaliWizardNavigationProvider {...navigation}>{children}</DenaliWizardNavigationProvider>
    </DenaliFormHarness>
  );
}

/** RHF field watch helper — must render inside {@link DenaliFormHarness}. */
export function DenaliFormWatchProbe({
  name,
  testId,
}: {
  name: keyof DenaliCreateTourWizardForm | string;
  testId: string;
}) {
  const { watch } = useFormContext<DenaliCreateTourWizardForm>();
  return (
    <span data-testid={testId}>
      {JSON.stringify(watch(name as keyof DenaliCreateTourWizardForm) ?? "")}
    </span>
  );
}
