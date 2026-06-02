import { BadRequestException, Injectable } from "@nestjs/common";
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from "typeorm";
import {
  assertSafeOutboundUrl,
  EgressUrlForbiddenError,
} from "@repo/security/egress-url";

import { TenantPaymentConfigEntity } from "../entities/tenant-payment-config.entity";

async function assertTenantCallbackUrlSafe(callbackUrl: string | null | undefined): Promise<void> {
  const normalized = (callbackUrl ?? "").trim();
  if (!normalized) {
    return;
  }
  try {
    await assertSafeOutboundUrl(normalized);
  } catch (error) {
    if (error instanceof EgressUrlForbiddenError) {
      throw new BadRequestException({
        error: {
          code: "TENANT_CALLBACK_URL_FORBIDDEN",
          message: "Tenant callback URL targets a blocked or private network destination",
        },
      });
    }
    throw error;
  }
}

@Injectable()
@EventSubscriber()
export class TenantPaymentConfigEgressGuardSubscriber
  implements EntitySubscriberInterface<TenantPaymentConfigEntity>
{
  constructor(dataSource: DataSource) {
    if (dataSource && Array.isArray(dataSource.subscribers)) {
      dataSource.subscribers.push(this);
    }
  }

  listenTo(): typeof TenantPaymentConfigEntity {
    return TenantPaymentConfigEntity;
  }

  async beforeInsert(event: InsertEvent<TenantPaymentConfigEntity>): Promise<void> {
    await assertTenantCallbackUrlSafe(event.entity?.callbackUrl);
  }

  async beforeUpdate(event: UpdateEvent<TenantPaymentConfigEntity>): Promise<void> {
    const entity = event.entity as Partial<TenantPaymentConfigEntity> | undefined;
    if (entity && "callbackUrl" in entity) {
      await assertTenantCallbackUrlSafe(entity.callbackUrl);
    }
  }
}
