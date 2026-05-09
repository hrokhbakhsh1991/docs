/**
 * Axios HTTP client for Tour-Ops API (see `resolveTourOpsApiBaseUrl` / `tour-ops-api-origin.ts`).
 *
 * Auth transport (browser → Nest):
 * - The HttpOnly `session` cookie is scoped to the **Next.js origin** only, so it is **not** sent to
 *   a different API host/port even with `withCredentials: true`.
 * - The same JWT is mirrored into `sessionStorage` by `persistSessionToken` (`lib/auth/session.ts`).
 *   We attach it as `Authorization: Bearer <token>` so `AuthMiddleware` on Nest receives a token on
 *   the first cross-origin request after login.
 * - Route protection in `middleware.ts` still relies on the Next-only cookie; that stays unchanged.
 *
 * Clears session and redirects on 401 (except login flows).
 */

import axios, { AxiosError, type AxiosInstance } from "axios";

import { clearAuthAndRedirectToLogin } from "./auth/session";
import { getStoredSessionToken } from "./auth/session";
import { emitGlobalApiToast } from "./global-api-toast";
import { resolveTourOpsApiBaseUrl } from "./tour-ops-api-origin";

export { normalizeTourOpsApiOrigin } from "./tour-ops-api-origin";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Do not clear token / redirect when login returns 401 */
    skipAuthRedirectOn401?: boolean;
    /** Do not full-page redirect to `/403` on 403 (caller handles inline) */
    skip403Redirect?: boolean;
    /** Request interceptor sets Idempotency-Key when true */
    attachIdempotency?: boolean;
    /** Skip global interceptor toasts (500 / connection) for this request */
    skipGlobalErrorToast?: boolean;
  }
}

const API_TIMEOUT_MS = 15_000;
const DEFAULT_FETCH_INIT: RequestInit = { credentials: "include" };

function assertNoDoubleApiV2InUrl(resolvedUrl: string): void {
  if (resolvedUrl.includes("/api/v2/api/v2")) {
    throw new Error("Invalid API path: double /api/v2 detected");
  }
}

export class ApiError extends Error {
  code: string;

  status?: number;

  data?: unknown;

  constructor(code: string, message: string, status?: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You are not allowed to perform this action.", data?: unknown) {
    super("FORBIDDEN", message, 403, data);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(
    message: string = "The requested resource was not found.",
    code = "RESOURCE_NOT_FOUND",
    data?: unknown,
  ) {
    super(code, message, 404, data);
    this.name = "NotFoundError";
  }
}

function extractMessage(status: number, data: unknown): string {
  if (data && typeof data === "object") {
    const envelope = data as {
      error?: { message?: string; code?: string };
      message?: unknown;
    };
    if (typeof envelope.error?.message === "string" && envelope.error.message.trim()) {
      return envelope.error.message;
    }
    if (typeof envelope.message === "string" && envelope.message.trim()) {
      return envelope.message;
    }
  }
  return `Request failed with status ${status}`;
}

function extractBackendCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const envelope = data as {
    error?: { code?: unknown };
    code?: unknown;
  };
  if (typeof envelope.error?.code === "string" && envelope.error.code.trim()) {
    return envelope.error.code.trim();
  }
  if (typeof envelope.code === "string" && envelope.code.trim()) {
    return envelope.code.trim();
  }
  return undefined;
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<unknown>;
    const status = ax.response?.status;
    const data = ax.response?.data;
    const requestUrl = String(ax.config?.url ?? "");
    const errCode = String(ax.code ?? "").toUpperCase();
    const msg = typeof ax.message === "string" ? ax.message.toLowerCase() : "";
    const isTimeout = errCode === "ECONNABORTED" || errCode === "ETIMEDOUT" || msg.includes("timeout");
    if (isTimeout) {
      return new ApiError("TIMEOUT", "Request timed out. Please try again.", status, data);
    }
    if (!ax.response) {
      return new ApiError("NETWORK_ERROR", "Connection lost. Please check your network and try again.");
    }
    if (typeof status === "number") {
      const backendCode = extractBackendCode(data);
      if (status === 401) {
        const code = backendCode ?? "UNAUTHORIZED";
        const isLoginPath = requestUrl.includes("/api/v2/auth/web/session/otp");
        if (code === "AUTH_OTP_INVALID") {
          return new ApiError(code, "Invalid OTP code.", status, data);
        }
        if (code === "AUTH_OTP_EXPIRED") {
          return new ApiError(code, "OTP has expired. Request a new code and try again.", status, data);
        }
        if (code === "AUTH_PHONE_INVALID") {
          return new ApiError(code, "Invalid phone number or OTP.", status, data);
        }
        if (isLoginPath && code === "AUTH_UNAUTHENTICATED") {
          return new ApiError(code, "Invalid phone number or OTP.", status, data);
        }
        if (code === "AUTH_TOKEN_REVOKED") {
          return new ApiError(code, "Your session has expired. Please sign in again.", status, data);
        }
        return new ApiError(code, "Your session has expired. Please sign in again.", status, data);
      }
      if (status === 403) {
        return new ForbiddenError("You are not allowed to perform this action.", data);
      }
      if (status === 404) {
        const code = backendCode ?? "RESOURCE_NOT_FOUND";
        return new NotFoundError(extractMessage(status, data), code, data);
      }
      if (status === 500) {
        return new ApiError(backendCode ?? "SERVER_ERROR", "Server error. Please try again later.", status, data);
      }
      return new ApiError(backendCode ?? "REQUEST_FAILED", extractMessage(status, data), status, data);
    }
    return new ApiError("REQUEST_FAILED", "Request failed.");
  }
  if (error instanceof Error) {
    return new ApiError("REQUEST_FAILED", error.message);
  }
  return new ApiError("REQUEST_FAILED", String(error));
}

export type ApiRequestOptions = {
  /** Send Idempotency-Key; use `true` to generate a UUID per request */
  idempotencyKey?: string | boolean;
  /** Set on auth session POST so invalid OTP 401 does not wipe cookies or redirect */
  skipAuthRedirectOn401?: boolean;
  /** When true, 403 responses reject without navigating to `/403` (inline UX) */
  skip403Redirect?: boolean;
  /** Opt out of global 500 / connection-lost toasts for this call */
  skipGlobalErrorToast?: boolean;
  /** Override: use this JWT instead of the token from session storage. */
  authToken?: string;
};

function mergeRequestConfig(options?: ApiRequestOptions) {
  const headers: Record<string, string> = {};
  if (typeof options?.idempotencyKey === "string") {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  if (typeof options?.authToken === "string" && options.authToken.trim()) {
    headers.Authorization = `Bearer ${options.authToken.trim()}`;
  } else {
    const storedToken = getStoredSessionToken();
    if (storedToken) {
      headers.Authorization = `Bearer ${storedToken}`;
    }
  }
  // #region agent log
  fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
    ...DEFAULT_FETCH_INIT,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "770f2e"
    },
    body: JSON.stringify({
      sessionId: "770f2e",
      runId: "initial",
      hypothesisId: "H6",
      location: "lib/api-client.ts:166",
      message: "api_request_config_auth_state",
      data: {
        has_explicit_auth_token:
          typeof options?.authToken === "string" && options.authToken.trim().length > 0,
        has_authorization_header: typeof headers.Authorization === "string",
        skip_auth_redirect_on_401: options?.skipAuthRedirectOn401 === true
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
  return {
    headers,
    attachIdempotency: options?.idempotencyKey === true,
    skipAuthRedirectOn401: options?.skipAuthRedirectOn401,
    skip403Redirect: options?.skip403Redirect,
    skipGlobalErrorToast: options?.skipGlobalErrorToast,
  };
}

export const axiosApi: AxiosInstance = axios.create({
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
});

axiosApi.interceptors.request.use((config) => {
  const base = resolveTourOpsApiBaseUrl().trim();
  if (!base) {
    return Promise.reject(new Error("NEXT_PUBLIC_API_URL is not configured."));
  }
  config.baseURL = base;

  assertNoDoubleApiV2InUrl(axios.getUri({ ...config, baseURL: base }));

  const method = (config.method ?? "get").toUpperCase();
  if (
    (method === "POST" || method === "PATCH") &&
    config.attachIdempotency &&
    config.headers["Idempotency-Key"] === undefined
  ) {
    config.headers["Idempotency-Key"] =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  }

  return config;
});

function isLikelyNetworkOrTimeout(error: AxiosError): boolean {
  if (axios.isCancel(error)) return false;
  if (error.response) return false;
  const code = error.code;
  if (code === "ERR_CANCELED") return false;
  if (code === "ERR_NETWORK" || code === "ECONNABORTED" || code === "ETIMEDOUT") return true;
  const msg = typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (msg.includes("network error") || msg.includes("timeout")) return true;
  return false;
}

function devLogApiFailure(error: AxiosError): void {
  if (process.env.NODE_ENV !== "development") return;
  const status = error.response?.status;
  const code = error.code;
  const method = (error.config?.method ?? "GET").toUpperCase();
  const url = error.config?.url ?? "unknown";
  console.error("[api-client] request failed", {
    method,
    url,
    status,
    code,
    message: error.message,
  });
}

axiosApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window === "undefined") {
      return Promise.reject(error);
    }
    devLogApiFailure(error);

    const cfg = error.config;
    const status = error.response?.status;

    if (status === 401) {
      // #region agent log
      fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
        ...DEFAULT_FETCH_INIT,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "770f2e"
        },
        body: JSON.stringify({
          sessionId: "770f2e",
          runId: "initial",
          hypothesisId: "H6",
          location: "lib/api-client.ts:239",
          message: "api_response_401_interceptor",
          data: {
            url: cfg?.url ?? "",
            method: (cfg?.method ?? "get").toUpperCase(),
            skip_auth_redirect_on_401: cfg?.skipAuthRedirectOn401 === true
          },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
      if (!cfg?.skipAuthRedirectOn401) {
        void clearAuthAndRedirectToLogin();
      }
      return Promise.reject(error);
    }

    if (status === 403) {
      if (!cfg?.skip403Redirect) {
        const path = window.location.pathname;
        if (path !== "/403") {
          window.location.assign("/403");
        }
      }
      return Promise.reject(error);
    }

    if (!cfg?.skipGlobalErrorToast) {
      if (isLikelyNetworkOrTimeout(error)) {
        emitGlobalApiToast({ type: "error", message: "Connection lost. Please try again." });
      } else if (status === 500) {
        emitGlobalApiToast({ type: "error", message: "Server error. Please try again later." });
      }
    }

    return Promise.reject(error);
  }
);

export const apiClient = {
  async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "NEXT_PUBLIC_API_URL is not configured.");
    }
    try {
      const res = await axiosApi.get<T>(path, mergeRequestConfig(options));
      return res.data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "NEXT_PUBLIC_API_URL is not configured.");
    }
    try {
      const res = await axiosApi.post<T>(path, body, mergeRequestConfig(options));
      return res.data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async patch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "NEXT_PUBLIC_API_URL is not configured.");
    }
    try {
      const res = await axiosApi.patch<T>(path, body, mergeRequestConfig(options));
      return res.data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async delete<T = void>(path: string, options?: ApiRequestOptions): Promise<T> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "NEXT_PUBLIC_API_URL is not configured.");
    }
    try {
      const res = await axiosApi.delete<T>(path, mergeRequestConfig(options));
      return res.data as T;
    } catch (e) {
      throw toApiError(e);
    }
  },
};
