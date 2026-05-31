import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { TenantPaymentConfigEntity } from "../entities/tenant-payment-config.entity";

@Injectable()
export class TenantPaymentConfigRepository {
  constructor(
    @InjectRepository(TenantPaymentConfigEntity)
    private readonly repository: Repository<TenantPaymentConfigEntity>,
  ) {}

  async findActiveByTenantAndProvider(
    tenantId: string,
    provider: string,
  ): Promise<TenantPaymentConfigEntity | null> {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    const normalizedProvider = provider.trim().toLowerCase();
    if (!normalizedTenantId || !normalizedProvider) {
      return null;
    }
    return this.repository
      .createQueryBuilder("cfg")
      .where("cfg.tenant_id = :tenantId", { tenantId: normalizedTenantId })
      .andWhere("lower(cfg.provider) = :provider", { provider: normalizedProvider })
      .andWhere("cfg.is_active = true")
      .getOne();
  }
}
