import { isExtendedOperatorWorkspace } from "@/workspace/is-extended-operator-workspace";

import type { OperatorWelcomeContent } from "./operator-welcome-types";

const EXTENDED_OPERATOR_WELCOME_BULLETS = [
  { id: "dashboard" },
  { id: "wizard" },
  { id: "team" },
] as const;

export function shouldShowOperatorWelcome(pluginId: string, role: string): boolean {
  return isExtendedOperatorWorkspace(pluginId) && role === "owner";
}

export function resolveOperatorWelcomeContent(pluginId: string): OperatorWelcomeContent {
  if (!isExtendedOperatorWorkspace(pluginId)) {
    return { active: false, bullets: [] };
  }

  return {
    active: true,
    bullets: EXTENDED_OPERATOR_WELCOME_BULLETS.map((bullet) => ({ id: bullet.id })),
  };
}
