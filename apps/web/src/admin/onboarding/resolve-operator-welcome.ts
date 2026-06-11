import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-denali/plugin";

import type { OperatorWelcomeContent } from "./operator-welcome-types";

const DENALI_WELCOME_BULLETS = [
  { id: "dashboard" },
  { id: "wizard" },
  { id: "team" },
] as const;

export function shouldShowOperatorWelcome(pluginId: string, role: string): boolean {
  return pluginId === DENALI_WORKSPACE_PLUGIN_ID && role === "owner";
}

export function resolveOperatorWelcomeContent(pluginId: string): OperatorWelcomeContent {
  if (pluginId !== DENALI_WORKSPACE_PLUGIN_ID) {
    return { active: false, bullets: [] };
  }

  return {
    active: true,
    bullets: DENALI_WELCOME_BULLETS.map((bullet) => ({ id: bullet.id })),
  };
}
