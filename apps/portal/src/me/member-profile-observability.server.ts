export type MemberProfileObservabilityBase = {
  readonly traceId: string;
};

export type MemberProfileObservabilityEvent = MemberProfileObservabilityBase &
  (
    | {
        readonly kind: "capability_resolve";
        readonly pluginId: string;
        readonly editableFieldCount: number;
        readonly readOnlyFieldCount: number;
      }
    | {
        readonly kind: "profile_get";
        readonly pluginId: string;
        readonly tenantId: string;
        readonly cache: "hit" | "miss";
      }
    | {
        readonly kind: "profile_patch";
        readonly pluginId: string;
        readonly tenantId: string;
        readonly fieldCount: number;
      }
    | {
        readonly kind: "validation_failure";
        readonly pluginId: string;
        readonly errorCode: string;
        readonly fieldErrorCount: number;
      }
    | {
        readonly kind: "cache_invalidate";
        readonly pluginId: string;
        readonly tenantId: string;
      }
  );

function observabilityEnabled(): boolean {
  return process.env.MEMBER_PROFILE_OBSERVABILITY !== "false";
}

/** Structured, PII-free member profile BFF telemetry. */
export function logMemberProfileEvent(event: MemberProfileObservabilityEvent): void {
  if (!observabilityEnabled()) {
    return;
  }
  console.info(
    JSON.stringify({
      scope: "portal.member-profile.bff",
      at: new Date().toISOString(),
      ...event,
    })
  );
}
