/**
 * MAT-001 — workspace/profile/capability versioning (integer revisions).
 */

export type WorkspaceProfilePin = {
  readonly id: string;
  readonly profileVersion: number;
};

export type WorkspaceCapabilityPin = {
  readonly revision: number;
};

export type WorkspaceVersionPins = {
  readonly profilePin?: WorkspaceProfilePin;
  readonly capabilityPins?: Readonly<Record<string, WorkspaceCapabilityPin>>;
};

export type WorkspaceVersioningErrorCode =
  | "WORKSPACE_VERSION_UNKNOWN_CAPABILITY"
  | "WORKSPACE_VERSION_UNSUPPORTED_REVISION"
  | "WORKSPACE_VERSION_UNKNOWN_PROFILE"
  | "WORKSPACE_VERSION_UNSUPPORTED_PROFILE";

export type WorkspaceVersioningViolation = {
  readonly code: WorkspaceVersioningErrorCode;
  readonly message: string;
};

export const DEFAULT_CAPABILITY_REVISION = 1 as const;

/** Profile catalog entry uses `version` as monotonic profileVersion. */
export function readProfileCatalogVersion(profile: { readonly version?: unknown }): number {
  const raw = profile.version;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1) {
    return raw;
  }
  return 1;
}

export function readCapabilityBlockRevision(block: { readonly capabilityRevision?: unknown } | undefined): number {
  if (block === undefined) {
    return DEFAULT_CAPABILITY_REVISION;
  }
  const raw = block.capabilityRevision;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1) {
    return raw;
  }
  return DEFAULT_CAPABILITY_REVISION;
}

export function resolveEffectiveCapabilityRevision(input: {
  readonly capabilityId: string;
  readonly manifestRevision: number;
  readonly supportedRevisions: readonly number[];
  readonly pin?: WorkspaceCapabilityPin;
}): { readonly revision: number } | WorkspaceVersioningViolation {
  const pinned = input.pin?.revision;
  const revision = pinned ?? input.manifestRevision;

  if (!input.supportedRevisions.includes(revision)) {
    return {
      code: "WORKSPACE_VERSION_UNSUPPORTED_REVISION",
      message: `${input.capabilityId} revision ${revision} is not supported (available: ${input.supportedRevisions.join(", ")})`,
    };
  }

  return { revision };
}

export function resolveEffectiveProfileVersion(input: {
  readonly profileId: string;
  readonly catalogVersion: number;
  readonly supportedVersions: readonly number[];
  readonly pin?: WorkspaceProfilePin;
}): { readonly profileVersion: number } | WorkspaceVersioningViolation {
  const pinned = input.pin?.profileVersion;
  const profileVersion = pinned ?? input.catalogVersion;

  if (input.pin != null && input.pin.id !== input.profileId) {
    return {
      code: "WORKSPACE_VERSION_UNKNOWN_PROFILE",
      message: `profile pin id "${input.pin.id}" does not match catalog profile "${input.profileId}"`,
    };
  }

  if (!input.supportedVersions.includes(profileVersion)) {
    return {
      code: "WORKSPACE_VERSION_UNSUPPORTED_PROFILE",
      message: `profile ${input.profileId} version ${profileVersion} is not supported (available: ${input.supportedVersions.join(", ")})`,
    };
  }

  return { profileVersion };
}

export type WorkspaceUpgradePreflightInput = {
  readonly workspaceType: string;
  readonly currentPins: WorkspaceVersionPins;
  readonly targetPins: WorkspaceVersionPins;
  readonly capabilityCatalog: Readonly<
    Record<string, Readonly<Record<string, readonly number[]>>>
  >;
  readonly profileCatalog: Readonly<Record<string, readonly number[]>>;
};

export type WorkspaceUpgradePreflightResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly violations: readonly WorkspaceVersioningViolation[] };

/** Staged upgrade preflight — fail closed on unknown revisions; no silent profile drift. */
export function runWorkspaceUpgradePreflight(
  input: WorkspaceUpgradePreflightInput
): WorkspaceUpgradePreflightResult {
  const violations: WorkspaceVersioningViolation[] = [];

  const targetProfilePin = input.targetPins.profilePin;
  if (targetProfilePin != null) {
    const supported = input.profileCatalog[targetProfilePin.id];
    if (supported === undefined) {
      violations.push({
        code: "WORKSPACE_VERSION_UNKNOWN_PROFILE",
        message: `unknown profile id "${targetProfilePin.id}" for workspace ${input.workspaceType}`,
      });
    } else {
      const resolved = resolveEffectiveProfileVersion({
        profileId: targetProfilePin.id,
        catalogVersion: supported[supported.length - 1] ?? 1,
        supportedVersions: supported,
        pin: targetProfilePin,
      });
      if ("code" in resolved) {
        violations.push(resolved);
      }
    }
  }

  const targetCapabilityPins = input.targetPins.capabilityPins ?? {};
  const workspaceCapabilities = input.capabilityCatalog[input.workspaceType] ?? {};
  for (const [capabilityId, pin] of Object.entries(targetCapabilityPins)) {
    const supported = workspaceCapabilities[capabilityId];
    if (supported === undefined) {
      violations.push({
        code: "WORKSPACE_VERSION_UNKNOWN_CAPABILITY",
        message: `capability "${capabilityId}" is not registered for workspace ${input.workspaceType}`,
      });
      continue;
    }
    const resolved = resolveEffectiveCapabilityRevision({
      capabilityId,
      manifestRevision: supported[supported.length - 1] ?? DEFAULT_CAPABILITY_REVISION,
      supportedRevisions: supported,
      pin,
    });
    if ("code" in resolved) {
      violations.push(resolved);
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}

/** Parse tenant theme JSON version pins (MAT-001 runtime binding). */
export function parseWorkspaceVersionPinsFromTheme(theme: unknown): WorkspaceVersionPins | null {
  if (theme === null || typeof theme !== "object") {
    return null;
  }
  const root = theme as Record<string, unknown>;
  const raw = root.versionPins;
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const pins = raw as Record<string, unknown>;

  let profilePin: WorkspaceProfilePin | undefined;
  const rawProfile = pins.profilePin;
  if (rawProfile !== null && typeof rawProfile === "object") {
    const profile = rawProfile as Record<string, unknown>;
    if (typeof profile.id === "string" && typeof profile.profileVersion === "number") {
      profilePin = { id: profile.id, profileVersion: profile.profileVersion };
    }
  }

  const capabilityPins: Record<string, WorkspaceCapabilityPin> = {};
  const rawCaps = pins.capabilityPins;
  if (rawCaps !== null && typeof rawCaps === "object") {
    for (const [capId, value] of Object.entries(rawCaps as Record<string, unknown>)) {
      if (value !== null && typeof value === "object") {
        const revision = (value as Record<string, unknown>).revision;
        if (typeof revision === "number" && Number.isInteger(revision) && revision >= 1) {
          capabilityPins[capId] = { revision };
        }
      }
    }
  }

  if (profilePin === undefined && Object.keys(capabilityPins).length === 0) {
    return null;
  }

  return {
    ...(profilePin !== undefined ? { profilePin } : {}),
    ...(Object.keys(capabilityPins).length > 0 ? { capabilityPins } : {}),
  };
}
