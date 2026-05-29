import { Inject, Injectable } from "@nestjs/common";

import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type MemberWalletBalanceSnapshot,
  type WorkspaceIdentityRepositoryPort
} from "./domain/ports/workspace-identity-repository.port";

export type { MemberWalletBalanceSnapshot };

export const FALLBACK_OPERATING_CURRENCY_CODE = "IRR";

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export function normalizeOperatingCurrencyCode(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw.length === 0 || !CURRENCY_CODE_PATTERN.test(raw)) {
    return FALLBACK_OPERATING_CURRENCY_CODE;
  }
  return raw;
}

/** @deprecated Use {@link WorkspaceIdentityRepositoryPort.loadMemberWalletBalances} via port injection. */
@Injectable()
export class UsersMemberWalletBalancesService {
  constructor(
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort
  ) {}

  async resolveOperatingCurrencyCode(tenantId: string): Promise<string> {
    return this.identityRepository.resolveOperatingCurrencyCode(tenantId);
  }

  async loadBalancesForUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, MemberWalletBalanceSnapshot>> {
    return this.identityRepository.loadMemberWalletBalances(tenantId, userIds);
  }
}
