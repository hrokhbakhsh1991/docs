"use client";

import type { ReactNode } from "react";

import type {
  DenaliFlatEditPageCoreState,
  DenaliFlatEditTourDetail,
} from "./use-flat-edit-page-core";

export type DenaliFlatEditPageReadyRenderProps = {
  readonly core: DenaliFlatEditPageCoreState;
  readonly detail: DenaliFlatEditTourDetail;
  readonly tourId: string;
};

export type DenaliFlatEditPageViewSlots = {
  readonly renderLoading: () => ReactNode;
  readonly renderNotConfigured: () => ReactNode;
  readonly renderNotFound: () => ReactNode;
  readonly renderReady: (props: DenaliFlatEditPageReadyRenderProps) => ReactNode;
};

export type DenaliFlatEditPageViewProps = {
  readonly core: DenaliFlatEditPageCoreState;
  readonly tourId: string;
  readonly slots: DenaliFlatEditPageViewSlots;
};

/** Phase 14 PR-5e — Denali flat-edit page screen tree (shell injects platform chrome + form). */
export function DenaliFlatEditPageView({ core, tourId, slots }: DenaliFlatEditPageViewProps) {
  switch (core.screen) {
    case "gate-loading":
    case "tour-loading":
      return slots.renderLoading();
    case "not-configured":
      return slots.renderNotConfigured();
    case "not-found":
      return slots.renderNotFound();
    case "ready":
      if (core.detail == null) {
        return slots.renderNotFound();
      }
      return slots.renderReady({ core, detail: core.detail, tourId });
  }
}
