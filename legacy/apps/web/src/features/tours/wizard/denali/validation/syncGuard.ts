export type SyncGuardSnapshot = {
  local: {
    publishStatus: "draft" | "active";
    payloadHash: string;
    updatedAtMs: number;
  };
  server?: {
    lifecycleStatus: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
    payloadHash?: string;
    updatedAtMs?: number;
  };
};

export type SyncGuardIssueCode =
  | "SYNC_SERVER_STALE"
  | "SYNC_LOCAL_STALE"
  | "SYNC_STATUS_DIVERGENCE"
  | "SYNC_PAYLOAD_DIVERGENCE";

export type SyncGuardIssue = {
  code: SyncGuardIssueCode;
  message: string;
  blocking: boolean;
};

export type SyncGuardResult = {
  consistent: boolean;
  issues: SyncGuardIssue[];
  actions: {
    shouldBlockSubmit: boolean;
    shouldForceRefetch: boolean;
    shouldShowConflictBanner: boolean;
    shouldFallbackToDraft: boolean;
  };
};

export function evaluateSyncGuard(snapshot: SyncGuardSnapshot): SyncGuardResult {
  const issues: SyncGuardIssue[] = [];

  if (!snapshot.server) {
    issues.push({
      code: "SYNC_SERVER_STALE",
      message: "Server state is unavailable.",
      blocking: false,
    });
  }

  if (snapshot.server) {
    const localIsActive = snapshot.local.publishStatus === "active";
    const serverIsActive = snapshot.server.lifecycleStatus === "OPEN";
    if (localIsActive !== serverIsActive) {
      issues.push({
        code: "SYNC_STATUS_DIVERGENCE",
        message: "Local publish status differs from server lifecycle status.",
        blocking: true,
      });
    }

    if (snapshot.server.payloadHash && snapshot.server.payloadHash !== snapshot.local.payloadHash) {
      issues.push({
        code: "SYNC_PAYLOAD_DIVERGENCE",
        message: "Local payload differs from latest server payload.",
        blocking: true,
      });
    }

    if (
      snapshot.server.updatedAtMs != null &&
      Number.isFinite(snapshot.server.updatedAtMs) &&
      snapshot.local.updatedAtMs < snapshot.server.updatedAtMs
    ) {
      issues.push({
        code: "SYNC_LOCAL_STALE",
        message: "Local state is older than server state.",
        blocking: true,
      });
    }
  }

  const hasBlocking = issues.some((row) => row.blocking);
  const hasConflict = issues.some(
    (row) => row.code === "SYNC_STATUS_DIVERGENCE" || row.code === "SYNC_PAYLOAD_DIVERGENCE",
  );

  return {
    consistent: !hasBlocking,
    issues,
    actions: {
      shouldBlockSubmit: hasBlocking,
      shouldForceRefetch: hasConflict,
      shouldShowConflictBanner: issues.length > 0,
      shouldFallbackToDraft: issues.some((row) => row.code === "SYNC_STATUS_DIVERGENCE"),
    },
  };
}
