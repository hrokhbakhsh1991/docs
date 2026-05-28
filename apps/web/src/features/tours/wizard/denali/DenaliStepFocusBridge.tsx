"use client";

import { useEffect } from "react";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

import { useDenaliWizardNavigationOptional } from "./DenaliWizardNavigationContext";

/** Consumes pending field focus after navigating to a wizard step. */
export function DenaliStepFocusBridge({ stepId }: { stepId: DenaliCreateWizardStepId }) {
  const navigation = useDenaliWizardNavigationOptional();

  useEffect(() => {
    navigation?.consumePendingFocus(stepId);

    const timer = window.setTimeout(() => {
      // Let step transition/render settle before fallback focus probing.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const stepTestId = resolveStepContainerTestId(stepId);
          const stepContainer = document.querySelector<HTMLElement>(`[data-testid="${stepTestId}"]`);
          if (!stepContainer) {
            if (process.env.NODE_ENV !== "production") {
            }
            return;
          }

          const active = document.activeElement as HTMLElement | null;
          const activeInsideStep = active != null && stepContainer.contains(active);
          if (activeInsideStep) {
            return;
          }

          const fallbackTarget = findFirstInteractableField(stepContainer);
          if (!fallbackTarget) {
            if (process.env.NODE_ENV !== "production") {
            }
            return;
          }

          fallbackTarget.focus();
        });
      });
    }, 60);

    return () => {
      window.clearTimeout(timer);
    };
  }, [navigation, stepId]);

  return null;
}

function resolveStepContainerTestId(stepId: DenaliCreateWizardStepId): string {
  switch (stepId) {
    case "denali_basic":
      return "denali-step-basics";
    case "denali_photos":
      return "denali-step-photos";
    case "denali_program":
      return "denali-step-program";
    case "denali_logistics":
      return "denali-step-logistics";
    case "denali_pricing":
      return "denali-step-pricing";
    case "review":
      return "denali-step-review";
    default:
      return `denali-step-${stepId}`;
  }
}

function isVisibleElement(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") {
    return false;
  }
  return el.getClientRects().length > 0;
}

function findFirstInteractableField(root: HTMLElement): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>("input, select, textarea");
  for (const node of candidates) {
    if (node.matches(":disabled")) continue;
    if (!isVisibleElement(node)) continue;
    return node;
  }
  return null;
}
