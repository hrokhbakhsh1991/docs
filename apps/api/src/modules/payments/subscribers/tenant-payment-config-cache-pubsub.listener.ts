import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type Redis from "ioredis";

import { LoggerService } from "../../../common/logger/logger.service";
import { REDIS_CLIENT } from "../../../infra/redis/redis.constants";
import {
  parseTenantIdFromPaymentConfigInvalidateChannel,
  TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
} from "../tenant-payment-config-cache.constants";
import { TenantPaymentConfigService } from "../services/tenant-payment-config.service";

const RESUBSCRIBE_BASE_MS = 1_000;
const RESUBSCRIBE_MAX_MS = 30_000;

/**
 * Listens for cross-pod tenant payment config cache invalidations via Redis Pub/Sub.
 * Uses a dedicated Redis connection so subscribe mode never blocks command traffic.
 */
@Injectable()
export class TenantPaymentConfigCachePubSubListener
  implements OnModuleInit, OnModuleDestroy
{
  private subscriber: Redis | null = null;
  private destroyed = false;
  private resubscribeTimer: NodeJS.Timeout | null = null;
  private resubscribeAttempts = 0;
  private resubscribeBackoffMs = RESUBSCRIBE_BASE_MS;
  private isSubscriptionActionPending = false;
  private pendingInvalidationTenants = new Set<string>();
  private microtaskTimer: NodeJS.Immediate | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly tenantPaymentConfigService: TenantPaymentConfigService,
    private readonly logger: LoggerService,
  ) {}

  private logWarn(event: string, meta: Record<string, unknown>): void {
    try {
      this.logger.warn(event, meta);
    } catch {
      /* module teardown race */
    }
  }

  private logInfo(event: string, meta: Record<string, unknown>): void {
    try {
      this.logger.info(event, meta);
    } catch {
      /* module teardown race */
    }
  }

  onModuleInit(): void {
    this.subscriber = this.redis.duplicate();
    this.bindSubscriberLifecycle(this.subscriber);
    void this.ensureSubscribed("module_init").catch(() => undefined);
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.microtaskTimer) {
      clearImmediate(this.microtaskTimer);
      this.microtaskTimer = null;
    }
    this.flushCoalescedInvalidations();
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }

    const connection = this.subscriber;
    this.subscriber = null;
    if (!connection) {
      return;
    }
    const status = connection.status;
    if (status === "end" || status === "close") {
      return;
    }
    void connection
      .punsubscribe(TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN)
      .catch(() => undefined)
      .then(() => connection.quit())
      .catch(() => {
        try {
          connection.disconnect(false);
        } catch {
          /* socket already closed */
        }
      });
  }

  private bindSubscriberLifecycle(subscriber: Redis): void {
    subscriber.on("pmessage", (_pattern, channel, message) => {
      this.enqueueInvalidationTenant(channel, message);
    });

    subscriber.on("ready", () => {
      if (this.destroyed) {
        return;
      }
      void this.ensureSubscribed("ready");
    });

    subscriber.on("reconnecting", (delayMs: number) => {
      if (this.destroyed) {
        return;
      }
      this.logWarn("tenant_payment_config_pubsub_reconnecting", {
        delay_ms: delayMs,
        attempt: this.resubscribeAttempts,
      });
      this.scheduleResubscribe("reconnecting");
    });

    subscriber.on("end", () => {
      if (this.destroyed) {
        return;
      }
      this.logWarn("tenant_payment_config_pubsub_connection_end", {
        attempt: this.resubscribeAttempts,
      });
      this.scheduleResubscribe("end");
    });

    subscriber.on("error", (error) => {
      if (this.destroyed) {
        return;
      }
      this.logWarn("tenant_payment_config_pubsub_subscriber_error", {
        error: error instanceof Error ? error.message : String(error),
        attempt: this.resubscribeAttempts,
      });
      this.scheduleResubscribe("error");
    });
  }

  private scheduleResubscribe(reason: string): void {
    if (this.destroyed || this.resubscribeTimer) {
      return;
    }

    const delayMs = Math.min(this.resubscribeBackoffMs, RESUBSCRIBE_MAX_MS);
    this.resubscribeAttempts += 1;
    this.resubscribeBackoffMs = Math.min(delayMs * 2, RESUBSCRIBE_MAX_MS);

    this.logWarn("tenant_payment_config_pubsub_resubscribe_scheduled", {
      reason,
      delay_ms: delayMs,
      attempt: this.resubscribeAttempts,
    });

    this.resubscribeTimer = setTimeout(() => {
      this.resubscribeTimer = null;
      if (this.destroyed) {
        return;
      }
      void this.ensureSubscribed(reason);
    }, delayMs);
  }

  private async ensureSubscribed(trigger: string): Promise<void> {
    if (this.destroyed || !this.subscriber) {
      return;
    }

    if (this.isSubscriptionActionPending) {
      return Promise.resolve();
    }

    this.isSubscriptionActionPending = true;
    try {
      await this.runSubscribe(trigger);
    } finally {
      this.isSubscriptionActionPending = false;
    }
  }

  private async runSubscribe(trigger: string): Promise<void> {
    const connection = this.subscriber;
    if (!connection || this.destroyed) {
      return;
    }

    try {
      await connection.psubscribe(TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN);
      this.resubscribeAttempts = 0;
      this.resubscribeBackoffMs = RESUBSCRIBE_BASE_MS;
      this.logInfo("tenant_payment_config_pubsub_subscribed", {
        pattern: TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
        trigger,
      });
    } catch (error: unknown) {
      this.logWarn("tenant_payment_config_pubsub_subscribe_failed", {
        pattern: TENANT_PAYMENT_CONFIG_INVALIDATE_CHANNEL_PATTERN,
        trigger,
        error: error instanceof Error ? error.message : String(error),
      });
      this.scheduleResubscribe("subscribe_failed");
    }
  }

  private enqueueInvalidationTenant(channel: string, message: string): void {
    const tenantId =
      parseTenantIdFromPaymentConfigInvalidateChannel(channel) ??
      message.trim().toLowerCase();
    if (!tenantId) {
      return;
    }

    this.pendingInvalidationTenants.add(tenantId);
    if (this.microtaskTimer) {
      return;
    }

    this.microtaskTimer = setImmediate(() => {
      this.flushCoalescedInvalidations();
    });
  }

  private flushCoalescedInvalidations(): void {
    this.microtaskTimer = null;
    if (this.pendingInvalidationTenants.size === 0) {
      return;
    }

    const tenantIds = [...this.pendingInvalidationTenants];
    this.pendingInvalidationTenants.clear();

    for (const tenantId of tenantIds) {
      this.tenantPaymentConfigService.invalidateTenant(tenantId);
    }

    this.logInfo("tenant_payment_config_pubsub_invalidation_batch", {
      tenants_coalesced: tenantIds.length,
      tenant_ids_sample: tenantIds.slice(0, 10),
    });
  }
}
