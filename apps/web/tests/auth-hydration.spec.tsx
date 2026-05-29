/**
 * Integration: refresh session bridge (cookie hydrated via BFF, sessionStorage empty)
 * and theme persistence while AuthProvider injects session.
 */
import "@/lib/test/auth-vitest-mocks";

import React, { useEffect, useRef } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, axiosApi } from "@/lib/api-client";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { getStoredSessionToken } from "@/lib/auth/session";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-provider";
import {
  buildTestSessionJwt,
  createSessionHydrateResponse,
  DEFAULT_TEST_USER_ID,
  SESSION_TOKEN_STORAGE_KEY,
  setDocumentSessionCookie,
} from "@/lib/test/session-fixtures";

import { installAuthFetchMock, resetAuthTestStorage } from "@/lib/test/install-auth-fetch-mock.vitest";
import { renderWithAuth, ThemeAndAuthProbe } from "./utils/render-with-auth";

function ApiProbeAfterHydrate({
  onAuthorizedRequest,
}: {
  onAuthorizedRequest: (authorization: string | undefined) => void;
}) {
  const { isHydrated, isAuthenticated } = useAuth();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || firedRef.current) {
      return;
    }
    firedRef.current = true;
    void apiClient
      .get("/api/v2/auth/workspaces")
      .catch(() => undefined)
      .finally(() => {
        const token = getStoredSessionToken();
        onAuthorizedRequest(token ? `Bearer ${token}` : undefined);
      });
  }, [isHydrated, isAuthenticated, onAuthorizedRequest]);

  return null;
}

describe("Auth hydration session bridge", () => {
  const sessionToken = buildTestSessionJwt();
  let fetchMock: ReturnType<typeof installAuthFetchMock>;
  let axiosGetSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    resetAuthTestStorage();
    setDocumentSessionCookie(sessionToken);
    fetchMock = installAuthFetchMock({ sessionToken });

    axiosGetSpy = vi.spyOn(axiosApi, "get").mockResolvedValue({
      data: [],
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: {} },
    } as Awaited<ReturnType<typeof axiosApi.get>>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    axiosGetSpy.mockRestore();
    resetAuthTestStorage();
  });

  it("mirrors cookie session into sessionStorage and sends Bearer after isHydrated", async () => {
    expect(sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBeNull();

    let authorizationFromClient: string | undefined;
    const onAuthorizedRequest = vi.fn((auth?: string) => {
      authorizationFromClient = auth;
    });

    const { fetchMock: hydrateFetch } = await renderWithAuth(
      <ApiProbeAfterHydrate onAuthorizedRequest={onAuthorizedRequest} />,
      { sessionToken, seedSessionCookie: true, waitForHydration: false },
    );

    await waitFor(() => {
      expect(sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBe(sessionToken);
    });

    await waitFor(() => {
      expect(onAuthorizedRequest).toHaveBeenCalled();
    });

    expect(authorizationFromClient).toBe(`Bearer ${sessionToken}`);
    expect(getStoredSessionToken()).toBe(sessionToken);

    await waitFor(() => {
      expect(axiosGetSpy).toHaveBeenCalled();
    });

    const axiosConfig = axiosGetSpy.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
    const headerFromAxios =
      axiosConfig?.headers?.Authorization ??
      (axiosConfig?.headers as Headers | undefined)?.get?.("Authorization");
    expect(headerFromAxios).toBe(`Bearer ${sessionToken}`);

    expect(hydrateFetch).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("retains sessionStorage when hydrate aborts before timeout budget (e.g. unmount)", async () => {
    sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, "keep-on-abort");
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    render(
      <AuthProvider>
        <div data-testid="hydrate-probe" />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBe("keep-on-abort");
    });
  });

  it(
    "hydrate timeout keeps state, sets isHydrated, and retries in background",
    async () => {
      vi.useFakeTimers();
      let callCount = 0;
      sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, "keep-on-timeout");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      fetchMock.mockImplementation((_input, init) => {
        callCount += 1;
        if (callCount === 1) {
          return new Promise<Response>((_resolve, reject) => {
            const signal = (init as RequestInit | undefined)?.signal;
            if (signal) {
              signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          });
        }
        return Promise.resolve(createSessionHydrateResponse(sessionToken));
      });

      function HydrateProbe() {
        const { isHydrated, user } = useAuth();
        return (
          <div
            data-testid="hydrate-probe"
            data-hydrated={isHydrated ? "true" : "false"}
            data-user-id={user?.userId ?? ""}
          />
        );
      }

      const { getAllByTestId } = render(
        <AuthProvider>
          <HydrateProbe />
        </AuthProvider>,
      );

      const hydrateProbe = () =>
        getAllByTestId("hydrate-probe").find((el) => el.getAttribute("data-hydrated") === "true") ??
        getAllByTestId("hydrate-probe").at(-1)!;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_100);
      });

      expect(hydrateProbe()?.getAttribute("data-hydrated")).toBe("true");

      expect(
        warnSpy.mock.calls.some((call) =>
          String(call[0]).includes("Auth hydration timed out, keeping previous session state"),
        ),
      ).toBe(true);

      vi.useRealTimers();

      await waitFor(() => {
        expect(callCount).toBeGreaterThanOrEqual(2);
        expect(hydrateProbe()?.getAttribute("data-user-id")).toBe(DEFAULT_TEST_USER_ID);
      });

      expect(sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBe("keep-on-timeout");

      warnSpy.mockRestore();
    },
    10_000,
  );

  it("retains sessionStorage mirror on transient HTTP 503", async () => {
    sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, "keep-on-503");
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/auth/session")) {
        return new Response("upstream unavailable", { status: 503 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    render(<AuthProvider>{null}</AuthProvider>);

    await waitFor(() => {
      expect(sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBe("keep-on-503");
    });
  });

  it("clears sessionStorage mirror when hydration reports unauthenticated", async () => {
    sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, "stale-token");
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/auth/session")) {
        return new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    render(<AuthProvider>{null}</AuthProvider>);

    await waitFor(() => {
      expect(sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });
});

describe("Theme persistence guard", () => {
  const sessionToken = buildTestSessionJwt();

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    resetAuthTestStorage();
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem("theme", "dark");

    if (typeof window.matchMedia !== "function") {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
          matches: query.includes("dark"),
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }),
      });
    }

    installAuthFetchMock({ sessionToken });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthTestStorage();
  });

  it("keeps dark theme from localStorage when AuthProvider hydrates user session", async () => {
    const { getByTestId } = await renderWithAuth(<ThemeAndAuthProbe />, {
      sessionToken,
      seedSessionCookie: false,
    });

    await waitFor(() => {
      expect(getByTestId("theme-auth-probe").getAttribute("data-user-id")).toBe(DEFAULT_TEST_USER_ID);
    });

    expect(getByTestId("theme-auth-probe").getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);
    expect(document.documentElement.classList.contains("theme-light")).toBe(false);
  });
});
