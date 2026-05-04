/**
 * Axios HTTP client for Tour-Ops API (`NEXT_PUBLIC_API_URL`).
 * Attaches Bearer token from cookie; clears session and redirects on 401 (except login flows).
 */

import axios, { AxiosError, type AxiosInstance } from "axios";

import { AUTH_SESSION_PATHS } from "./api-paths";
import { clearAuthAndRedirectToLogin, getSessionToken } from "./auth/session";
import { emitGlobalApiToast } from "./global-api-toast";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Do not clear token / redirect when login returns 401 */
    skipAuthRedirectOn401?: boolean;
    /** Request interceptor sets Idempotency-Key when true */
    attachIdempotency?: boolean;
    /** Skip global interceptor toasts (500 / connection) for this request */
    skipGlobalErrorToast?: boolean;
  }
}

/**
 * Contract: env should be origin only (`http://localhost:3001`).
 * Trailing `/api/v2` is stripped so legacy configs never yield `/api/v2/api/v2/...` on the wire.
 */
export function normalizeTourOpsApiOrigin(raw: string): string {
  let s = raw.trim().replace(/\/$/, "");
  const suffix = "/api/v2";
  let stripped = false;
  while (s.endsWith(suffix)) {
    s = s.slice(0, -suffix.length).replace(/\/$/, "");
    stripped = true;
  }
  if (stripped && process.env.NODE_ENV === "development") {
    console.warn(
      "[api-client] NEXT_PUBLIC_API_URL ended with /api/v2; using origin only. Prefer setting NEXT_PUBLIC_API_URL=http://localhost:3001 (no path)."
    );
  }
  return s;
}

const API_BASE_URL = normalizeTourOpsApiOrigin(process.env.NEXT_PUBLIC_API_URL ?? "");
const API_TIMEOUT_MS = 15_000;

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
        return new ApiError(backendCode ?? "UNAUTHORIZED", "Your session has expired. Please sign in again.", status, data);
      }
      if (status === 403) {
        return new ForbiddenError("You are not allowed to perform this action.", data);
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
  /** Set on auth session POST so a wrong-password 401 does not wipe cookies or redirect */
  skipAuthRedirectOn401?: boolean;
  /** Opt out of global 500 / connection-lost toasts for this call */
  skipGlobalErrorToast?: boolean;
};

function mergeRequestConfig(options?: ApiRequestOptions) {
  const headers: Record<string, string> = {};
  if (typeof options?.idempotencyKey === "string") {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  return {
    headers,
    attachIdempotency: options?.idempotencyKey === true,
    skipAuthRedirectOn401: options?.skipAuthRedirectOn401,
    skipGlobalErrorToast: options?.skipGlobalErrorToast,
  };
}

export const axiosApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL || undefined,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
});

axiosApi.interceptors.request.use((config) => {
  assertNoDoubleApiV2InUrl(axios.getUri(config));

  const token =
    typeof window !== "undefined" && typeof document !== "undefined" ? getSessionToken() : undefined;
  const relativeUrl = config.url ?? "";
  const isAuthSessionEntry = AUTH_SESSION_PATHS.some((p) => relativeUrl.includes(p));

  if (token && !isAuthSessionEntry && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

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
      if (!cfg?.skipAuthRedirectOn401) {
        clearAuthAndRedirectToLogin();
      }
      return Promise.reject(error);
    }

    if (status === 403) {
      const path = window.location.pathname;
      if (path !== "/403") {
        window.location.assign("/403");
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
    if (!API_BASE_URL) {
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
    if (!API_BASE_URL) {
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
    if (!API_BASE_URL) {
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
    if (!API_BASE_URL) {
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
