import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { memberWalletId } from "../finance/ledger/member-wallet-id";
import { normalizeFinanceTenantId } from "../finance/ledger/ledger-tenant-scope";
import { AccountBalanceEntity } from "../finance/ledger/entities/account-balance.entity";
import { TenantEntity } from "./entities/tenant.entity";

export type MemberWalletBalanceSnapshot = {
  balanceMinor: string;
  currency: string;
};

export const FALLBACK_OPERATING_CURRENCY_CODE = "IRR";

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export function normalizeOperatingCurrencyCode(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw.length === 0 || !CURRENCY_CODE_PATTERN.test(raw)) {
    return FALLBACK_OPERATING_CURRENCY_CODE;
  }
  return raw;
}

@Injectable()
export class UsersMemberWalletBalancesService {
  constructor(
    @InjectRepository(AccountBalanceEntity)
    private readonly accountBalances: Repository<AccountBalanceEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenants: Repository<TenantEntity>
  ) {}

  async resolveOperatingCurrencyCode(tenantId: string): Promise<string> {
    const row = await this.tenants.findOne({
      where: { id: tenantId, deletedAt: IsNull() },
      select: ["id", "operatingCurrencyCode"]
    });
    return normalizeOperatingCurrencyCode(row?.operatingCurrencyCode);
  }

  /**
   * Single batched query (`account IN (...)` + tenant operating currency). Never call per user row.
   */
  async loadBalancesForUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, MemberWalletBalanceSnapshot>> {
    const out = new Map<string, MemberWalletBalanceSnapshot>();
    if (userIds.length === 0) {
      return out;
    }
    const currency = await this.resolveOperatingCurrencyCode(tenantId);
    const tenantNorm = normalizeFinanceTenantId(tenantId);
    const accounts = userIds.map((id) => memberWalletId(id));
    const rows = await this.accountBalances.find({
      where: {
        tenantId: tenantNorm,
        account: In(accounts),
        currency
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
      out.set(userId, {
        balanceMinor: row.balanceMinor?.trim() || "0",
        currency
      });
    }
    for (const userId of userIds) {
      if (!out.has(userId)) {
        out.set(userId, { balanceMinor: "0", currency });
      }
    }
    return out;
  }
}
