"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AppSession } from "@/session/app-session";

const AppSessionContext = createContext<AppSession | null>(null);

export function AppSessionProvider({
  session,
  children,
}: {
  readonly session: AppSession;
  readonly children: ReactNode;
}) {
  return (
    <AppSessionContext.Provider value={session}>{children}</AppSessionContext.Provider>
  );
}

export function useAppSession(): AppSession {
  const session = useContext(AppSessionContext);
  if (session === null) {
    throw new Error("APP_SESSION_MISSING");
  }
  return session;
}
