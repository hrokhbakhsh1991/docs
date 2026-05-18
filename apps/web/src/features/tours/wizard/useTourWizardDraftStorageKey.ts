"use client";

import { useMemo } from "react";

import { useWorkspaceDraftScope } from "@/hooks/use-workspace-query-scope";

import { wizardDraftStorageKey } from "./tourWizardDraftEnvelope";

export function useTourWizardDraftStorageKey(): string {
  const scope = useWorkspaceDraftScope();
  return useMemo(() => wizardDraftStorageKey(scope ?? ""), [scope]);
}
