"use client";

import dynamic from "next/dynamic";
import React, { type ReactNode } from "react";

import type { WizardCompositeFieldRenderProps, WizardCompositeSurface } from "@/wizard/wizard-surface-types";

const PlatformCompositeField = dynamic(
  () => import("./platform-composite-field").then((mod) => mod.PlatformCompositeField),
  {
    ssr: false,
    loading: () => <p data-platform-wizard-composite-loading aria-busy="true" />,
  }
);

/** P3-B — platform composite surface factory for wizard-surface-bindings codegen. */
export function createPlatformCompositeSurface(): WizardCompositeSurface {
  return Object.freeze({
    renderCompositeField: (props: WizardCompositeFieldRenderProps): ReactNode => (
      <PlatformCompositeField
        compositeId={props.compositeId}
        field={props.field}
        draft={props.draft}
        onDraftChange={props.onDraftChange}
        wizardSessionId={props.wizardSessionId}
        workspaceFormProfile={props.workspaceFormProfile}
      />
    ),
  });
}
