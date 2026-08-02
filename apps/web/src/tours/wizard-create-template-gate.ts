"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import {
  createLoadingWizardTemplateGateState,
  createUnpublishedWizardTemplateGateState,
  resolveWizardTemplateGateState,
  type WizardTemplateGateState,
} from "./wizard-template-gate-logic";

export {
  createLoadingWizardTemplateGateState,
  createUnpublishedWizardTemplateGateState,
};

type UseWizardTemplateGateInput = {
  readonly pluginId: string;
  readonly loadPlugin: () => Promise<WorkspacePlugin>;
  readonly initialWorkspaceFormProfile: string;
  readonly unresolvedWorkspaceFormProfile: (plugin: WorkspacePlugin) => string;
  readonly initialTemplateResponse?: unknown | null;
};

/** Phase 15.2 P15-W-B1a — shared tour-wizard-template fetch + gate state. */
export function useWizardTemplateGate(input: UseWizardTemplateGateInput): WizardTemplateGateState {
  const skipInitialGateFetchRef = useRef(input.initialTemplateResponse != null);
  const [gate, setGate] = useState<WizardTemplateGateState>(() =>
    createLoadingWizardTemplateGateState(input.initialWorkspaceFormProfile)
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (skipInitialGateFetchRef.current) {
        skipInitialGateFetchRef.current = false;
        if (input.initialTemplateResponse != null) {
          try {
            const plugin = await input.loadPlugin();
            if (cancelled) {
              return;
            }
            setGate(
              resolveWizardTemplateGateState(
                input.initialTemplateResponse,
                input.pluginId,
                plugin
              )
            );
            return;
          } catch {
            // fall through to network fetch
          }
        }
      }

      try {
        const plugin = await input.loadPlugin();
        const response = await fetch("/api/settings/tour-wizard-template", { cache: "no-store" });
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setGate(createUnpublishedWizardTemplateGateState(input.unresolvedWorkspaceFormProfile(plugin)));
          return;
        }
        const payload = (await response.json()) as unknown;
        setGate(resolveWizardTemplateGateState(payload, input.pluginId, plugin));
      } catch {
        if (!cancelled) {
          try {
            const plugin = await input.loadPlugin();
            setGate(createUnpublishedWizardTemplateGateState(input.unresolvedWorkspaceFormProfile(plugin)));
          } catch {
            setGate(createUnpublishedWizardTemplateGateState(input.initialWorkspaceFormProfile));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    input.pluginId,
    input.loadPlugin,
    input.initialWorkspaceFormProfile,
    input.unresolvedWorkspaceFormProfile,
    input.initialTemplateResponse,
  ]);

  return gate;
}
