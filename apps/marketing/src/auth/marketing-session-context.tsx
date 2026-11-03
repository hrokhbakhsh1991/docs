"use client";

import { createContext, useContext } from "react";

export const MarketingSessionContext = createContext<{
  readonly authenticated: boolean;
  readonly profileHref: string | null;
} | null>(null);

export function useMarketingSession() {
  return useContext(MarketingSessionContext);
}
