/**
 * DP1-A — in-memory Payment Hold repository (test + memory driver parity).
 */
import { randomUUID } from "node:crypto";
let store = new Map();
function key(tenantId, registrationId) {
    return `${tenantId}:${registrationId}`;
}
export function resetInMemoryPaymentHoldRepositoryForTests() {
    store = new Map();
}
export class InMemoryPaymentHoldRepository {
    async insertOpenHold(input) {
        const existing = store.get(key(input.tenantId, input.registrationId));
        if (existing !== undefined) {
            return existing;
        }
        const now = new Date().toISOString();
        const row = {
            id: randomUUID(),
            tenantId: input.tenantId,
            registrationId: input.registrationId,
            status: "open",
            dueAt: input.dueAt,
            policyHours: input.policyHours,
            extendedCount: 0,
            createdAt: now,
            updatedAt: now,
        };
        store.set(key(input.tenantId, input.registrationId), row);
        return row;
    }
    async getByRegistrationId(tenantId, registrationId) {
        return store.get(key(tenantId, registrationId)) ?? null;
    }
    async markSatisfied(tenantId, registrationId) {
        const row = store.get(key(tenantId, registrationId));
        if (row === undefined) {
            throw new Error("PAYMENT_HOLD_NOT_FOUND");
        }
        if (row.status === "satisfied") {
            return row;
        }
        const updated = {
            ...row,
            status: "satisfied",
            updatedAt: new Date().toISOString(),
        };
        store.set(key(tenantId, registrationId), updated);
        return updated;
    }
    async markExpired(tenantId, registrationId) {
        const row = store.get(key(tenantId, registrationId));
        if (row === undefined) {
            throw new Error("PAYMENT_HOLD_NOT_FOUND");
        }
        if (row.status === "expired") {
            return row;
        }
        const updated = {
            ...row,
            status: "expired",
            updatedAt: new Date().toISOString(),
        };
        store.set(key(tenantId, registrationId), updated);
        return updated;
    }
    async extendDueAt(tenantId, registrationId, dueAt) {
        const row = store.get(key(tenantId, registrationId));
        if (row === undefined) {
            throw new Error("PAYMENT_HOLD_NOT_FOUND");
        }
        const updated = {
            ...row,
            status: "open",
            dueAt,
            extendedCount: row.extendedCount + 1,
            updatedAt: new Date().toISOString(),
        };
        store.set(key(tenantId, registrationId), updated);
        return updated;
    }
    async listOpenDueBefore(tenantId, beforeIso) {
        const beforeMs = Date.parse(beforeIso);
        return [...store.values()].filter((row) => row.tenantId === tenantId &&
            row.status === "open" &&
            Date.parse(row.dueAt) <= beforeMs);
    }
    async listAllOpenDueBefore(beforeIso) {
        const beforeMs = Date.parse(beforeIso);
        return [...store.values()].filter((row) => row.status === "open" && Date.parse(row.dueAt) <= beforeMs);
    }
    /** Test helper — seed hold directly. */
    seedHold(row) {
        store.set(key(row.tenantId, row.registrationId), row);
    }
}
