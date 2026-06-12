"use client";

import { Button } from "@app-tour/ui-primitives/button";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  canNavigateToWizardStepIndex,
  WIZARD_STEP_SHELL_TEST_IDS,
} from "./wizard-step-shell-logic";

export { WIZARD_STEP_SHELL_TEST_IDS };

export type WizardStepDescriptor = {
  readonly stepId: string;
  readonly label: string;
};

type WizardStepShellProps = {
  readonly steps: readonly WizardStepDescriptor[];
  readonly activeIndex: number;
  readonly onActiveIndexChange: (index: number) => void;
  readonly children: ReactNode;
  readonly lastStepFooter?: ReactNode;
  /** When true, block step navigation while draft sync is in flight (11.3-T5). */
  readonly navLocked?: boolean;
  /** Return false to block Continue (11.7 per-step validation). */
  readonly onBeforeNext?: (currentIndex: number) => boolean | Promise<boolean>;
};

export function WizardStepShell({
  steps,
  activeIndex,
  onActiveIndexChange,
  children,
  lastStepFooter,
  navLocked = false,
  onBeforeNext,
}: WizardStepShellProps) {
  const t = useTranslations("wizard.stepShell");
  const format = useFormatter();
  const stepCount = steps.length;
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, stepCount - 1));
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === stepCount - 1;
  const activeStep = steps[safeIndex];

  const jumpToStep = (index: number) => {
    if (navLocked || !canNavigateToWizardStepIndex(index, safeIndex) || index === safeIndex) {
      return;
    }
    onActiveIndexChange(index);
  };

  return (
    <div className="workspace-wizard-shell" data-testid={WIZARD_STEP_SHELL_TEST_IDS.panel}>
      <nav
        className="workspace-wizard-shell__progress"
        aria-label={t("progressAria")}
        data-testid={WIZARD_STEP_SHELL_TEST_IDS.nav}
      >
        <ol className="workspace-wizard-shell__progress-list">
          {steps.map((step, index) => {
            const state =
              index < safeIndex ? "complete" : index === safeIndex ? "current" : "upcoming";
            const canJump = canNavigateToWizardStepIndex(index, safeIndex);
            const content = (
              <>
                <span className="workspace-wizard-shell__progress-index" aria-hidden>
                  {format.number(index + 1)}
                </span>
                <span className="workspace-wizard-shell__progress-label">{step.label}</span>
              </>
            );

            return (
              <li
                key={step.stepId}
                className="workspace-wizard-shell__progress-item"
                data-wizard-step-state={state}
                data-wizard-progress-step={step.stepId}
              >
                {canJump ? (
                  <button
                    type="button"
                    className="workspace-wizard-shell__progress-step-btn"
                    data-testid={WIZARD_STEP_SHELL_TEST_IDS.progressStep(step.stepId)}
                    aria-current={index === safeIndex ? "step" : undefined}
                    aria-label={t("jumpToStep", { label: step.label })}
                    disabled={navLocked || index === safeIndex}
                    onClick={() => jumpToStep(index)}
                  >
                    {content}
                  </button>
                ) : (
                  <span className="workspace-wizard-shell__progress-step-label">{content}</span>
                )}
              </li>
            );
          })}
        </ol>
        <p
          className="workspace-wizard-shell__progress-summary"
          data-testid={WIZARD_STEP_SHELL_TEST_IDS.progress}
        >
          {activeStep
            ? t("stepOfWithLabel", {
                current: safeIndex + 1,
                total: stepCount,
                label: activeStep.label,
              })
            : t("stepOf", { current: safeIndex + 1, total: stepCount })}
        </p>
      </nav>

      <div className="workspace-wizard-shell__body">
        <div className="workspace-wizard-shell__card">{children}</div>
      </div>

      <footer className="workspace-wizard-shell__actions">
        <Button
          type="button"
          variant="secondary"
          disabled={isFirst || navLocked}
          data-testid={WIZARD_STEP_SHELL_TEST_IDS.back}
          onClick={() => onActiveIndexChange(safeIndex - 1)}
        >
          {t("back")}
        </Button>
        {!isLast ? (
          <Button
            type="button"
            variant="primary"
            disabled={navLocked}
            data-testid={WIZARD_STEP_SHELL_TEST_IDS.next}
            onClick={() => {
              void (async () => {
                if (onBeforeNext != null) {
                  const allowed = await onBeforeNext(safeIndex);
                  if (!allowed) {
                    return;
                  }
                }
                onActiveIndexChange(safeIndex + 1);
              })();
            }}
          >
            {t("continue")}
          </Button>
        ) : (
          lastStepFooter
        )}
      </footer>
    </div>
  );
}
