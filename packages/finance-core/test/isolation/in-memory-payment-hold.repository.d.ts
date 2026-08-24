export type PaymentHoldStatus = "open" | "satisfied" | "expired";
export type PaymentHoldRow = {
    readonly id: string;
    readonly tenantId: string;
    readonly registrationId: string;
    readonly status: PaymentHoldStatus;
    readonly dueAt: string;
    readonly policyHours: number;
    readonly extendedCount: number;
    readonly createdAt: string;
    readonly updatedAt: string;
};
export declare function resetInMemoryPaymentHoldRepositoryForTests(): void;
export declare class InMemoryPaymentHoldRepository {
    insertOpenHold(input: {
        readonly tenantId: string;
        readonly registrationId: string;
        readonly dueAt: string;
        readonly policyHours: number;
    }): Promise<PaymentHoldRow>;
    getByRegistrationId(tenantId: string, registrationId: string): Promise<PaymentHoldRow | null>;
    markSatisfied(tenantId: string, registrationId: string): Promise<PaymentHoldRow>;
    markExpired(tenantId: string, registrationId: string): Promise<PaymentHoldRow>;
    extendDueAt(tenantId: string, registrationId: string, dueAt: string): Promise<PaymentHoldRow>;
    listOpenDueBefore(tenantId: string, beforeIso: string): Promise<readonly PaymentHoldRow[]>;
    listAllOpenDueBefore(beforeIso: string): Promise<readonly PaymentHoldRow[]>;
    /** Test helper — seed hold directly. */
    seedHold(row: PaymentHoldRow): void;
}
