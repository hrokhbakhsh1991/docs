/**
 * P4-A shared test helpers — marketing revalidate capture + denali fixtures
 * @see docs/phase-17/platform-club-catalog-publish.mdoc
 */
import type { CanonicalDocument } from "@app-tour/workspace-sdk";

export const P4_CATALOG_TENANT_ID = "00000000-0000-4000-8000-000000000099";
export const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
export const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211";
export const OPERATOR_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
export const OPERATOR_SMOKE_PARTICIPANT_TOUR_ID = "00000000-0000-4000-8000-000000000212";

export function urbanCanonical(publishStatus: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["tour"],
    data: {
      tour: { title: "Urban walk", publishStatus },
    },
  };
}

export function denaliCanonical(publishStatus: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["tour"],
    data: {
      tour: { title: "P4 integration sample" },
      publishStatus,
    },
  };
}

export type MarketingRevalidateEnvSnapshot = {
  url: string | undefined;
  secret: string | undefined;
};

export function snapshotMarketingRevalidateEnv(): MarketingRevalidateEnvSnapshot {
  return {
    url: process.env.MARKETING_REVALIDATE_URL,
    secret: process.env.MARKETING_REVALIDATE_SECRET,
  };
}

export function mockMarketingRevalidateEnv(input: {
  url: string;
  secret: string;
}): MarketingRevalidateEnvSnapshot {
  const prior = snapshotMarketingRevalidateEnv();
  process.env.MARKETING_REVALIDATE_URL = input.url;
  process.env.MARKETING_REVALIDATE_SECRET = input.secret;
  return prior;
}

export function restoreMarketingRevalidateEnv(prior: MarketingRevalidateEnvSnapshot): void {
  if (prior.url === undefined) {
    delete process.env.MARKETING_REVALIDATE_URL;
  } else {
    process.env.MARKETING_REVALIDATE_URL = prior.url;
  }
  if (prior.secret === undefined) {
    delete process.env.MARKETING_REVALIDATE_SECRET;
  } else {
    process.env.MARKETING_REVALIDATE_SECRET = prior.secret;
  }
}

export type CapturedRevalidateRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
};

export function captureMarketingRevalidateFetch(options?: {
  failStatus?: number;
  reject?: boolean;
}): {
  calls: CapturedRevalidateRequest[];
  restore: () => void;
} {
  const calls: CapturedRevalidateRequest[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers: Record<string, string> = {};
    if (init?.headers !== undefined) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          headers[key] = value;
        }
      } else {
        Object.assign(headers, init.headers);
      }
    }
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : "",
    });
    if (options?.reject === true) {
      throw new Error("MARKETING_REVALIDATE_FETCH_REJECTED");
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: options?.failStatus ?? 200,
    });
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

export async function drainScheduledRevalidate(ms = 30): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
