import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER } from "../storage/dual-store-role";
import { getIdentityRepository } from "./create-identity-repository";
import { MembershipNotFoundError } from "./in-memory-identity.repository";
import { InMemoryPortalMemberPlanRepository } from "./in-memory-portal-member-plan.repository";
import type {
  ApplyPortalMemberPlanInput,
  ApplyPortalMemberPlanResult,
  PortalMemberPlanRepository,
  UpsertPortalMemberPlanInput,
} from "./portal-member-plan.types";
import { PrismaPortalMemberPlanRepository } from "./prisma-portal-member-plan.repository";

/** PSR-5h — InMemory branch retained as explicit test|dev adapter. */
export const DUAL_STORE_ROLE = DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER;
export class PortalMemberPlanNotFoundError extends Error {
  constructor(planCode: string) {
    super(`PORTAL_MEMBER_PLAN_NOT_FOUND:${planCode}`);
    this.name = "PortalMemberPlanNotFoundError";
  }
}

let planRepositorySingleton: PortalMemberPlanRepository | null = null;
let planRepositoryDriver: ReturnType<typeof resolveStorageDriver> | null = null;

export function getPortalMemberPlanRepository(): PortalMemberPlanRepository {
  assertProductionStorageDriver();
  const driver = resolveStorageDriver();
  if (planRepositorySingleton !== null && planRepositoryDriver === driver) {
    return planRepositorySingleton;
  }
  planRepositorySingleton =
    driver === "prisma"
      ? new PrismaPortalMemberPlanRepository()
      : new InMemoryPortalMemberPlanRepository();
  planRepositoryDriver = driver;
  return planRepositorySingleton;
}

/** Test-only — inject memory repo. */
export function setPortalMemberPlanRepositoryForTests(
  repo: PortalMemberPlanRepository | null
): void {
  planRepositorySingleton = repo;
  planRepositoryDriver = repo === null ? null : "memory";
}

export async function upsertPortalMemberPlan(
  input: UpsertPortalMemberPlanInput,
  plans: PortalMemberPlanRepository = getPortalMemberPlanRepository()
) {
  return plans.upsert(input);
}

export async function applyPortalMemberPlan(
  input: ApplyPortalMemberPlanInput,
  deps: {
    readonly plans?: PortalMemberPlanRepository;
    readonly identity?: ReturnType<typeof getIdentityRepository>;
  } = {}
): Promise<ApplyPortalMemberPlanResult> {
  const plans = deps.plans ?? getPortalMemberPlanRepository();
  const identity = deps.identity ?? getIdentityRepository();
  const plan = await plans.findActiveByCode(input.tenantId, input.planCode);
  if (plan === null) {
    throw new PortalMemberPlanNotFoundError(input.planCode.trim());
  }

  const membership = await identity.findMembership(input.userId, input.tenantId);
  if (membership === null) {
    throw new MembershipNotFoundError(input.userId);
  }

  const nextRevision = (membership.portalEntitlementsRevision ?? 0) + 1;
  const updated = await identity.updateMembershipPortalEntitlements(
    input.tenantId,
    input.userId,
    {
      portalModuleGrants: plan.moduleGrants,
      portalPlanCode: plan.planCode,
      portalCapabilityFlags: plan.capabilityFlags,
      portalEntitlementsRevision: nextRevision,
    }
  );

  return Object.freeze({
    ok: true as const,
    tenantId: input.tenantId,
    userId: input.userId,
    planCode: plan.planCode,
    moduleGrants: updated.portalModuleGrants ?? plan.moduleGrants,
    capabilityFlags: updated.portalCapabilityFlags ?? plan.capabilityFlags,
    entitlementsRevision: updated.portalEntitlementsRevision ?? nextRevision,
  });
}
