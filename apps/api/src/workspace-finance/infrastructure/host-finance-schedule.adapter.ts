/**
 * Host adapter — finance schedule store (Prisma/RLS when prisma; in-memory when memory).
 */

import {
  getSchedule,
  listAllSchedules,
  putSchedule,
} from "../finance-schedule-store";
import type { FinanceSchedulePort } from "../ports/finance-schedule.port";
import type { PaymentScheduleItem } from "../finance-schedule-domain";

export class HostFinanceScheduleAdapter implements FinanceSchedulePort {
  listAllSchedules(tenantId: string): Promise<PaymentScheduleItem[]> {
    return listAllSchedules(tenantId);
  }

  getSchedule(tenantId: string, registrationId: string): Promise<PaymentScheduleItem[]> {
    return getSchedule(tenantId, registrationId);
  }

  putSchedule(
    tenantId: string,
    registrationId: string,
    items: readonly PaymentScheduleItem[]
  ): Promise<readonly PaymentScheduleItem[]> {
    return putSchedule(tenantId, registrationId, items);
  }
}
