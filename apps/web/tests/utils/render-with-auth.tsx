import React, { type ReactElement } from "react";
import {
  render,
  waitFor,
  within,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { expect } from "vitest";

import { useAuth } from "@/lib/auth/auth-context";
import { useTheme } from "@/lib/theme/theme-provider";
import {
  buildTestSessionJwt,
  setDocumentSessionCookie,
} from "@/lib/test/session-fixtures";

import { AppTestProviders } from "@/lib/test/AppTestProviders";
import {
  installAuthFetchMock,
  type InstallAuthFetchMockOptions,
} from "@/lib/test/install-auth-fetch-mock.vitest";

function AuthHydrationMarker() {
  const { isHydrated } = useAuth();
  return (
    <div
      data-testid="auth-hydration-marker"
      data-hydrated={isHydrated ? "true" : "false"}
      aria-hidden
    />
  );
}

export function ThemeAndAuthProbe() {
  const { theme } = useTheme();
  const { isHydrated, user } = useAuth();
  return (
    <div
      data-testid="theme-auth-probe"
      data-theme={theme}
      data-hydrated={isHydrated ? "true" : "false"}
      data-user-id={user?.userId ?? ""}
    />
  );
}

/** RTL / renderHook wrapper — pair with {@link installAuthFetchMock} in beforeEach. */
export function AuthTestWrapper({ children }: { children: React.ReactNode }) {
  return <AppTestProviders>{children}</AppTestProviders>;
}

export type RenderWithAuthSessionType = "authenticated" | "unauthenticated";

export type RenderWithAuthOptions = InstallAuthFetchMockOptions & {
  sessionType?: RenderWithAuthSessionType;
  /** When true (default for authenticated), seeds HttpOnly-shaped `document.cookie`. */
  seedSessionCookie?: boolean;
  waitForHydration?: boolean;
  renderOptions?: Omit<RenderOptions, "wrapper">;
};

export type RenderWithAuthResult = RenderResult & {
  fetchMock: ReturnType<typeof installAuthFetchMock>;
};

export async function waitForAuthHydrated(container: HTMLElement): Promise<void> {
  await waitFor(() => {
    const marker = within(container).getByTestId("auth-hydration-marker");
    expect(marker.getAttribute("data-hydrated")).toBe("true");
  });
}

/**
 * Renders `ui` inside {@link AppTestProviders}, stubs auth `fetch`, and optionally waits for `isHydrated`.
 */
export async function renderWithAuth(
  ui: ReactElement,
  options: RenderWithAuthOptions = {},
): Promise<RenderWithAuthResult> {
  const sessionType = options.sessionType ?? "authenticated";
  const sessionToken = options.sessionToken ?? buildTestSessionJwt();
  const seedCookie = options.seedSessionCookie ?? sessionType === "authenticated";

  if (seedCookie && sessionType === "authenticated") {
    setDocumentSessionCookie(sessionToken);
  }

  const fetchMock = installAuthFetchMock({
    sessionType,
    sessionToken,
    handler: options.handler,
  });

  const result = render(
    <AppTestProviders>
      <AuthHydrationMarker />
      {ui}
    </AppTestProviders>,
    options.renderOptions,
  );

  if (options.waitForHydration !== false) {
    await waitForAuthHydrated(result.container);
  }

  return { ...result, fetchMock };
}
