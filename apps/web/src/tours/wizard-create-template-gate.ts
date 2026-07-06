"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import {
  resolveWizardTemplateGateState,
  type WizardTemplateGateState,
} from "./wizard-template-gate-logic";

export function createLoadingWizardTemplateGateState(
  workspaceFormProfile: string
): WizardTemplateGateState {
  return {
    loading: true,
    published: false,
    allowedCanonicalPaths: [],
    templateSteps: [],
    fieldOverlays: new Map(),
    seedLabel: "",
    fieldRulesOverlay: {},
    workspaceFormProfile,
  };
}

export function createUnpublishedWizardTemplateGateState(
  workspaceFormProfile: string
): WizardTemplateGateState {
  return {
    loading: false,
    published: false,
    allowedCanonicalPaths: [],
    templateSteps: [],
    fieldOverlays: new Map(),
    seedLabel: "",
    fieldRulesOverlay: {},
    workspaceFormProfile,
  };
}

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
  const [gate, setGate] = useState<WizardTemplateGateState>(() => {
    if (input.initialTemplateResponse != null) {
      try {
        return resolveWizardTemplateGateState(
          input.initialTemplateResponse,
          input.pluginId
        );
      } catch {
        // fall through to loading state
      }
    }
    return createLoadingWizardTemplateGateState(input.initialWorkspaceFormProfile);
  });

  useEffect(() => {
    if (skipInitialGateFetchRef.current) {
      skipInitialGateFetchRef.current = false;
      return;
    }
    let cancelled = false;
    void (async () => {
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
