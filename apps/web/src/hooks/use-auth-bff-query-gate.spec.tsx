import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/lib/test/auth-vitest-mocks";
import { buildTestSessionJwt } from "@/lib/test/session-fixtures";
import { installAuthFetchMock } from "@/lib/test/install-auth-fetch-mock.vitest";
import { AppTestProviders } from "@/lib/test/AppTestProviders";

import { useAuthBffQueryGate, useAuthBffQueryGateForTenant } from "./use-auth-bff-query-gate";

function AuthTestWrapper({ children }: { children: React.ReactNode }) {
  return <AppTestProviders>{children}</AppTestProviders>;
}

describe("useAuthBffQueryGate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts disabled until session hydrate completes", async () => {
    installAuthFetchMock({ sessionType: "unauthenticated" });

    const { result } = renderHook(() => useAuthBffQueryGate(), {
      wrapper: AuthTestWrapper,
    });

    expect(result.current.authBffQueryEnabled).toBe(false);

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.authBffQueryEnabled).toBe(false);
  });
});

describe("useAuthBffQueryGateForTenant", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires tenant id and authenticated hydrate", async () => {
    const sessionToken = buildTestSessionJwt();
    installAuthFetchMock({ sessionToken, sessionType: "authenticated" });

    const { result } = renderHook(
      () => useAuthBffQueryGateForTenant("22222222-2222-4222-8222-222222222222"),
      { wrapper: AuthTestWrapper },
    );

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.authBffQueryEnabled).toBe(true);
  });
});
