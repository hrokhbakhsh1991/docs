import { getIdentityRepository } from "../identity/create-identity-repository.ts";
import { getSettingsResourcesRepository } from "../settings/create-settings-resources-repository.ts";
import type { CatalogRefAllowlists } from "./assert-catalog-ref-integrity.ts";

const LEADER_ELIGIBILITY_REWARD_LABELS = new Set([
  "admin",
  "leader",
  "لیدر",
  "راهنما",
]);

function isWizardLeaderCandidate(input: {
  readonly role: string;
  readonly isSelectableLeader?: boolean;
  readonly labels?: readonly string[];
}): boolean {
  if (input.isSelectableLeader === true || input.role === "admin" || input.role === "owner") {
    return true;
  }
  for (const label of input.labels ?? []) {
    if (LEADER_ELIGIBILITY_REWARD_LABELS.has(label.trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** P5-B-N-008 — tenant-scoped theme + leader allowlists for server publish gate. */
export async function resolveDenaliCatalogRefAllowlists(
  tenantId: string
): Promise<CatalogRefAllowlists> {
  const settingsRepo = getSettingsResourcesRepository();
  const themes = await settingsRepo.listTourThemes(tenantId);
  const activeThemeIds = themes
    .filter((theme) => theme.isActive !== false)
    .map((theme) => theme.id.trim())
    .filter((id) => id.length > 0);

  const identityRepo = getIdentityRepository();
  const memberships = await identityRepo.listMembershipsByTenant(tenantId);
  const selectableLeaderIds: string[] = [];
  for (const membership of memberships) {
    const user = await identityRepo.findUserById(membership.userId);
    if (user === null) {
      continue;
    }
    const rewards = membership.rewards;
    if (
      !isWizardLeaderCandidate({
        role: membership.role,
        isSelectableLeader: rewards?.isSelectableLeader,
        labels: rewards?.labels,
      })
    ) {
      continue;
    }
    const leaderId = user.id.trim();
    if (leaderId.length > 0) {
      selectableLeaderIds.push(leaderId);
    }
  }

  return { activeThemeIds, selectableLeaderIds };
}
