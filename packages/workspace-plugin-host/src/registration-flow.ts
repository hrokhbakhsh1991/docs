import type { RegistrationFlowStepProps } from "@app-tour/workspace-sdk";
import type { ComponentType } from "react";

export type { RegistrationFlowStepProps };

export type RegistrationFlowStepMap = Readonly<
  Record<string, ComponentType<RegistrationFlowStepProps>>
>;

const registrationFlowSteps = new Map<string, RegistrationFlowStepMap>();

export function registerWorkspaceRegistrationFlowSteps(
  pluginId: string,
  steps: RegistrationFlowStepMap
): void {
  registrationFlowSteps.set(pluginId, steps);
}

export function getWorkspaceRegistrationFlowSteps(
  pluginId: string
): RegistrationFlowStepMap | null {
  return registrationFlowSteps.get(pluginId) ?? null;
}
