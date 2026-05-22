import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { memberWalletId } from "../finance/ledger/member-wallet-id";
import { normalizeFinanceTenantId } from "../finance/ledger/ledger-tenant-scope";
import { AccountBalanceEntity } from "../finance/ledger/entities/account-balance.entity";

export type MemberWalletBalanceSnapshot = {
  balanceMinor: string;
  currency: string;
};

const DEFAULT_MEMBER_WALLET_CURRENCY = "IRR";

@Injectable()
export class UsersMemberWalletBalancesService {
  constructor(
    @InjectRepository(AccountBalanceEntity)
    private readonly accountBalances: Repository<AccountBalanceEntity>
  ) {}

  async loadBalancesForUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, MemberWalletBalanceSnapshot>> {
    const out = new Map<string, MemberWalletBalanceSnapshot>();
    if (userIds.length === 0) {
      return out;
    }
    const tenantNorm = normalizeFinanceTenantId(tenantId);
    const accounts = userIds.map((id) => memberWalletId(id));
    const rows = await this.accountBalances.find({
      where: {
        tenantId: tenantNorm,
        account: In(accounts)
      }
    });
    for (const row of rows) {
      const prefix = "member:";
      if (!row.account.startsWith(prefix)) {
        continue;
      }
      const userId = row.account.slice(prefix.length);
      if (!userId) {
        continue;
      }
      const existing = out.get(userId);
      if (!existing) {
        out.set(userId, {
          balanceMinor: row.balanceMinor?.trim() || "0",
          currency: row.currency?.trim() || DEFAULT_MEMBER_WALLET_CURRENCY
        });
        continue;
      }
      if (row.currency === DEFAULT_MEMBER_WALLET_CURRENCY) {
        out.set(userId, {
          balanceMinor: row.balanceMinor?.trim() || "0",
          currency: row.currency
        });
      }
    }
    for (const userId of userIds) {
      if (!out.has(userId)) {
        out.set(userId, { balanceMinor: "0", currency: DEFAULT_MEMBER_WALLET_CURRENCY });
      }
    }
    return out;
  }
}
