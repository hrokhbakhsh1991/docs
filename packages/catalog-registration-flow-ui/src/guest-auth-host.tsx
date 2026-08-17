"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { GuestAuthTransport } from "./guest-auth-transport";

export type GuestAuthHost = {
  readonly transport: GuestAuthTransport;
  readonly onAuthenticated: () => void | Promise<void>;
};

const GuestAuthHostContext = createContext<GuestAuthHost | null>(null);

export function GuestAuthHostProvider({
  transport,
  onAuthenticated,
  children,
}: GuestAuthHost & { readonly children: ReactNode }) {
  return (
    <GuestAuthHostContext.Provider value={{ transport, onAuthenticated }}>
      {children}
    </GuestAuthHostContext.Provider>
  );
}

export function useGuestAuthHost(): GuestAuthHost {
  const host = useContext(GuestAuthHostContext);
  if (host === null) {
    throw new Error("useGuestAuthHost must be used within GuestAuthHostProvider");
  }
  return host;
}
