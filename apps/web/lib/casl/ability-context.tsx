"use client";

import { createContext } from "react";

import type { AppAbility } from "@repo/shared-rbac";
import { defineAbilityFor } from "@repo/shared-rbac";

/** Stable guest ability for SSR / pre-hydration (no mutations). */
export const GUEST_APP_ABILITY: AppAbility = defineAbilityFor({
  id: "00000000-0000-4000-8000-000000000000",
  role: "none",
  status: "SUSPENDED"
});

export const AbilityContext = createContext<AppAbility>(GUEST_APP_ABILITY);
