export const MIGRATED_LEGACY_SECRET_REF_PREFIX = "migrated-legacy:telegram:";

export function buildMigratedLegacySecretRef(legacyBotId: string): string {
  return `${MIGRATED_LEGACY_SECRET_REF_PREFIX}${legacyBotId}`;
}

export function isMigratedLegacySecretRef(secretRef: string | null | undefined): boolean {
  if (secretRef === null || secretRef === undefined) {
    return false;
  }
  return secretRef.startsWith(MIGRATED_LEGACY_SECRET_REF_PREFIX);
}
