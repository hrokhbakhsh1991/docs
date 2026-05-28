import { describe, expect, it } from "vitest";

import { handleStatusChange } from "./handleStatusChange";
import {
  hydrateBackendErrorsToWizardTargets,
  type BackendValidationEnvelope,
} from "./hydrateBackendErrorsToWizardTargets";
import { evaluateSyncGuard } from "./syncGuard";

describe("Denali publish flow critical integration cases (Vitest)", () => {
  it("1) blocks active publish and falls back to draft when required fields are missing", () => {
    const issues = [
      {
        code: "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
        message: "missing geo zones",
      },
    ];
    const writes: Array<"draft" | "active"> = [];
    const result = handleStatusChange({
      currentStatus: "draft",
      nextStatus: "active",
      publishIssues: issues as never,
      setStatus: (status) => writes.push(status),
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
    expect(result.appliedStatus).toBe("draft");
    expect(writes[writes.length - 1]).toBe("draft");
  });

  it("2) allows draft -> active when readiness passes", () => {
    const writes: Array<"draft" | "active"> = [];
    const result = handleStatusChange({
      currentStatus: "draft",
      nextStatus: "active",
      publishIssues: [],
      setStatus: (status) => writes.push(status),
    });
    expect(result.blocked).toBe(false);
    expect(result.appliedStatus).toBe("active");
    expect(writes[writes.length - 1]).toBe("active");
  });

  it("3) hydrates backend 422 payload into wizard step navigation targets", () => {
    const payload: BackendValidationEnvelope = {
      error: {
        details: {
          validationErrors: [
            {
              code: "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
              path: "tripDetails.logistics.gatheringPoints",
              message: "geo required",
            },
          ],
        },
      },
    };
    const hydrated = hydrateBackendErrorsToWizardTargets(payload);
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]?.stepId).toBe("denali_logistics");
    expect(hydrated[0]?.formPath).toBe("transport.gatheringPoints");
  });

  it("4) blocks publish when local/server sync diverges", () => {
    const result = evaluateSyncGuard({
      local: {
        publishStatus: "active",
        payloadHash: "local-hash",
        updatedAtMs: 10,
      },
      server: {
        lifecycleStatus: "DRAFT",
        payloadHash: "server-hash",
        updatedAtMs: 20,
      },
    });
    expect(result.consistent).toBe(false);
    expect(result.actions.shouldBlockSubmit).toBe(true);
    expect(result.actions.shouldForceRefetch).toBe(true);
    expect(result.actions.shouldFallbackToDraft).toBe(true);
  });

  it("5) keeps tenant-scoped error hydration isolated", () => {
    const payload: BackendValidationEnvelope = {
      error: {
        fields: [
          {
            code: "VALIDATION_PROFILE_REQUIRED_FIELD",
            path: "tripDetails.logistics.startPoint",
            message: "tenant A only",
            tenantId: "tenant-a",
          },
          {
            code: "VALIDATION_PROFILE_REQUIRED_FIELD",
            path: "tripDetails.logistics.startPoint",
            message: "tenant B only",
            tenantId: "tenant-b",
          },
        ],
      },
    };
    const hydrated = hydrateBackendErrorsToWizardTargets(payload, {
      expectedTenantId: "tenant-a",
    });
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]?.message).toContain("tenant A");
  });
});
