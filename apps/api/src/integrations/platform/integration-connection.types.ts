import type { IntegrationCapability } from "../platform/integration-capability";
import type { IntegrationProviderId } from "../platform/integration-provider.types";
import type { ExposureIntentConnectionPublic } from "../../exposure/exposure-intent-public";

export type IntegrationConnectionStatus = "disabled" | "enabled" | "error";

export type IntegrationConnectionLoadWarning =
  | "POLICIES_UNAVAILABLE"
  | "EXPOSURE_INTENTS_UNAVAILABLE"
  | "TOUR_PUBLISHED_POLICY_DRIFT";

export type IntegrationBackingSource = "integration_connection" | "legacy_workspace_telegram_bot";

export type IntegrationActionsAllowed = {
  readonly enable: boolean;
  readonly disable: boolean;
  readonly test: boolean;
  readonly patch: boolean;
  readonly delete: boolean;
};

export type IntegrationConnectionRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly provider: IntegrationProviderId;
  readonly status: IntegrationConnectionStatus;
  readonly enabled: boolean;
  readonly capabilities: readonly IntegrationCapability[];
  readonly config: Record<string, unknown>;
  readonly secretRef: string | null;
  /** Internal delivery only — never exposed via HTTP. */
  readonly credentials: Record<string, unknown>;
};

export type IntegrationConnectionPublicDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly provider: IntegrationProviderId;
  readonly status: IntegrationConnectionStatus;
  readonly enabled: boolean;
  readonly capabilities: readonly IntegrationCapability[];
  readonly config: Record<string, unknown>;
  readonly hasSecret: boolean;
  readonly secretRefMasked: string | null;
  readonly eventPolicies: readonly {
    readonly eventType: string;
    readonly enabled: boolean;
    readonly deprecated?: boolean;
    readonly supersededBy?: string;
  }[];
  readonly exposureIntents: readonly ExposureIntentConnectionPublic[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly backingSource: IntegrationBackingSource;
  readonly legacySourceId: string | null;
  readonly actionsAllowed: IntegrationActionsAllowed;
  readonly isActiveDeliverySource: boolean;
  /** Legacy row visible but dispatcher prefers integration_connections when present. */
  readonly fallbackSuppressed: boolean;
  /** Present when policy/intent reads degraded during migration drift (GET stays 200). */
  readonly loadWarnings?: readonly IntegrationConnectionLoadWarning[];
};

export type WorkspaceIntegrationsListSummary = {
  readonly integrationConnectionCount: number;
  readonly legacyConnectionCount: number;
  readonly activeDeliverySource: IntegrationBackingSource | null;
};

export type WorkspaceIntegrationsListResponse = {
  readonly items: readonly IntegrationConnectionPublicDto[];
  readonly summary: WorkspaceIntegrationsListSummary;
};

export type IntegrationTestConnectionResult = {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly testedAt: string;
  readonly backingSource: IntegrationBackingSource;
};
