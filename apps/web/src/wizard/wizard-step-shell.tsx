"use client";

import { Button } from "@app-tour/ui-primitives/button";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

import {
  canNavigateToWizardStepIndex,
  WIZARD_STEP_SHELL_TEST_IDS,
} from "./wizard-step-shell-logic";
import {
  readWizardStepRailOverflowEdges,
  scrollWizardStepRailItemIntoView,
} from "./wizard-step-rail-scroll";

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
  /** TW-03 — disable Continue until current step validation passes. */
  readonly continueDisabled?: boolean;
  /**
   * Soft attention when step-nav validation issues are open (INV-DENALI-WIZ-018).
   * Does not disable Continue — validate-on-click must remain retryable after edits.
   */
  readonly continueAttention?: boolean;
  /** Return false to block Continue (11.7 per-step validation). */
  readonly onBeforeNext?: (currentIndex: number) => boolean | Promise<boolean>;
};

function WizardNavIcon({ direction }: { readonly direction: "start" | "end" }) {
  return (
    <svg
      className={`workspace-wizard-shell__nav-icon workspace-wizard-shell__nav-icon--${direction}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function WizardProgressCheckIcon() {
  return (
    <svg
      className="workspace-wizard-shell__progress-check"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12l4 4L19 6" />
    </svg>
  );
}

export function WizardStepShell({
  steps,
  activeIndex,
  onActiveIndexChange,
  children,
  lastStepFooter,
  navLocked = false,
  continueDisabled = false,
  continueAttention = false,
  onBeforeNext,
}: WizardStepShellProps) {
  const t = useTranslations("wizard.stepShell");
  const format = useFormatter();
  const stepCount = steps.length;
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, stepCount - 1));
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === stepCount - 1;
  const activeStep = steps[safeIndex];
  const progressRailRef = useRef<HTMLDivElement>(null);
  const progressListRef = useRef<HTMLOListElement>(null);
  const activeStepItemRef = useRef<HTMLLIElement>(null);

  const syncProgressRailOverflow = useCallback(() => {
    const rail = progressRailRef.current;
    const list = progressListRef.current;
    if (rail == null || list == null) {
      return;
    }
    const edges = readWizardStepRailOverflowEdges(list);
    rail.dataset.wizardStepRailOverflowStart = edges.start ? "true" : "false";
    rail.dataset.wizardStepRailOverflowEnd = edges.end ? "true" : "false";
  }, []);

  useEffect(() => {
    syncProgressRailOverflow();
    const list = progressListRef.current;
    if (list == null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      syncProgressRailOverflow();
    });
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, [steps, syncProgressRailOverflow]);

  useEffect(() => {
    const activeItem = activeStepItemRef.current;
    if (activeItem == null) {
      return;
    }
    scrollWizardStepRailItemIntoView(activeItem);
    const frame = window.requestAnimationFrame(() => {
      syncProgressRailOverflow();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [safeIndex, steps.length, syncProgressRailOverflow]);

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
        <div
          ref={progressRailRef}
          className="workspace-wizard-shell__progress-rail"
          data-wizard-step-rail
        >
          <ol
            ref={progressListRef}
            className="workspace-wizard-shell__progress-list"
            onScroll={syncProgressRailOverflow}
          >
          {steps.map((step, index) => {
            const state =
              index < safeIndex ? "complete" : index === safeIndex ? "current" : "upcoming";
            const canJump = canNavigateToWizardStepIndex(index, safeIndex);
            const content = (
              <>
                <span className="workspace-wizard-shell__progress-index" aria-hidden>
                  {state === "complete" ? (
                    <WizardProgressCheckIcon />
                  ) : (
                    format.number(index + 1)
                  )}
                </span>
                <span className="workspace-wizard-shell__progress-label" title={step.label}>
                  {step.label}
                </span>
              </>
            );

            return (
              <li
                key={step.stepId}
                ref={index === safeIndex ? activeStepItemRef : undefined}
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
        </div>
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
        <div className="workspace-wizard-shell__card">
          {children}
          <footer
            className="workspace-wizard-shell__actions"
            data-wizard-step-nav
            {...(isFirst ? { "data-wizard-step-nav-first": "" } : {})}
          >
            <div className="workspace-wizard-shell__actions-group">
              {!isFirst ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={navLocked}
                  data-wizard-nav="back"
                  data-testid={WIZARD_STEP_SHELL_TEST_IDS.back}
                  onClick={() => onActiveIndexChange(safeIndex - 1)}
                >
                  <WizardNavIcon direction="start" />
                  {t("back")}
                </Button>
              ) : null}
              {!isLast ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={navLocked || continueDisabled}
                  data-wizard-nav="continue"
                  {...(continueAttention
                    ? { "data-wizard-nav-continue-attention": "" }
                    : {})}
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
                  <WizardNavIcon direction="end" />
                </Button>
              ) : (
                lastStepFooter
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
