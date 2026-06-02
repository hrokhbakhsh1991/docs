import { randomUUID } from "node:crypto";

/** Reserved tenant UUIDs for auth e2e personas (do not collide with finance TEST_* ids). */
export const AUTH_TEST_TENANT_A_ID = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
export const AUTH_TEST_TENANT_B_ID = "b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2";

export const AUTH_TEST_SUBDOMAIN_A = "auth-e2e-a";
export const AUTH_TEST_SUBDOMAIN_B = "auth-e2e-b";

/** Base E.164 prefix for generated auth e2e phones (`+155590` + 5 digits). */
export const AUTH_TEST_PHONE_PREFIX = "+155590";

let phoneSequence = 0;

export function allocateAuthTestPhone(): string {
  phoneSequence += 1;
  const suffix = String((process.pid % 100) * 1000 + phoneSequence).padStart(5, "0");
  return `${AUTH_TEST_PHONE_PREFIX}${suffix}`;
}

export function authTestEmailForPhone(phone: string): string {
  const local = phone.replace(/\D/g, "").slice(-12);
  return `auth-e2e-${local}@auth-e2e.test`;
}

export function authTestTenantId(label: "a" | "b" | "custom", customId?: string): string {
  if (label === "a") return AUTH_TEST_TENANT_A_ID;
  if (label === "b") return AUTH_TEST_TENANT_B_ID;
  return customId ?? randomUUID();
}
