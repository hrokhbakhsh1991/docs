import type { PaymentScheduleItem } from "../domain/schedule";

export type { PaymentScheduleItem };

export interface FinanceSchedulePort {
  listAllSchedules(tenantId: string): Promise<PaymentScheduleItem[]>;

  getSchedule(tenantId: string, registrationId: string): Promise<PaymentScheduleItem[]>;

  putSchedule(
    tenantId: string,
    registrationId: string,
    items: readonly PaymentScheduleItem[]
  ): Promise<readonly PaymentScheduleItem[]>;
}
