import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { DataSource, IsNull, type Repository } from "typeorm";

import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";

import {
  AUTH_TEST_SUBDOMAIN_A,
  AUTH_TEST_SUBDOMAIN_B,
  AUTH_TEST_TENANT_A_ID,
  AUTH_TEST_TENANT_B_ID,
  allocateAuthTestPhone,
  authTestEmailForPhone,
} from "./auth-test-ids";

export type AuthTestPersona = {
  userId: string;
  tenantId: string;
  phone: string;
  email: string;
  role: UserRole;
  subdomain: string;
  membershipStatus: MembershipStatus;
};

export type SeedTenantInput = {
  id?: string;
  subdomain?: string;
  name?: string;
  description?: string;
};

export type SeedAuthPersonaInput = Partial<AuthTestPersona> &
  Pick<AuthTestPersona, "phone" | "subdomain"> & {
    tenantId?: string;
    tenantName?: string;
    tenantDescription?: string;
    password?: string;
    fullName?: string;
  };

export type SeedTwoTenantPersonasOptions = {
  tenantA?: SeedTenantInput;
  tenantB?: SeedTenantInput;
  userInAOnly?: SeedAuthPersonaInput;
  userInBOnly?: SeedAuthPersonaInput;
  dualMember?: SeedAuthPersonaInput & { phone: string };
};

export type SeedTwoTenantPersonasResult = {
  tenantA: { id: string; subdomain: string };
  tenantB: { id: string; subdomain: string };
  personas: AuthTestPersona[];
};

async function ensureTenant(
  tenantRepo: Repository<TenantEntity>,
  input: {
    id: string;
    subdomain: string;
    name: string;
    description: string;
  },
): Promise<void> {
  const existing = await tenantRepo.findOne({ where: { id: input.id } });
  if (existing) {
    return;
  }
  await tenantRepo.insert({
    id: input.id,
    name: input.name,
    description: input.description,
    subdomain: input.subdomain,
  });
}

/**
 * Inserts tenant (if missing), user, and membership for one workspace actor.
 */
export async function seedAuthPersona(
  ds: DataSource,
  input: SeedAuthPersonaInput,
): Promise<AuthTestPersona> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);

  const phone = input.phone.trim();
  const subdomain = input.subdomain.trim();
  const tenantId = input.tenantId ?? randomUUID();
  const email = input.email?.trim() ?? authTestEmailForPhone(phone);
  const role = input.role ?? UserRole.Owner;
  const membershipStatus = input.membershipStatus ?? MembershipStatus.ACTIVE;
  const password = input.password ?? `fixture-${phone}`;

  await ensureTenant(tenantRepo, {
    id: tenantId,
    subdomain,
    name: input.tenantName ?? `Auth E2E ${subdomain}`,
    description: input.tenantDescription ?? `seedAuthPersona:${subdomain}`,
  });

  const hashedPassword = await argon2.hash(password);
  let user = await userRepo.findOne({ where: { phone } });
  if (!user) {
    user = await userRepo.save(
      userRepo.create({
        email,
        phone,
        isPhoneVerified: true,
        hashedPassword,
        fullName: input.fullName ?? `Auth E2E ${phone}`,
        isEmailVerified: true,
        telegramUserId: null,
      }),
    );
  }

  let membership = await membershipRepo.findOne({
    where: { userId: user.id, tenantId, deletedAt: IsNull() },
  });
  if (!membership) {
    membership = await membershipRepo.save(
      membershipRepo.create({
        tenantId,
        userId: user.id,
        role,
        status: membershipStatus,
        joinedAt: membershipStatus === MembershipStatus.ACTIVE ? new Date() : null,
      }),
    );
  } else if (membership.status !== membershipStatus) {
    membership.status = membershipStatus;
    membership.role = role;
    if (membershipStatus === MembershipStatus.ACTIVE) {
      membership.joinedAt = membership.joinedAt ?? new Date();
    }
    membership = await membershipRepo.save(membership);
  }

  return {
    userId: user.id,
    tenantId,
    phone,
    email,
    role,
    subdomain,
    membershipStatus,
  };
}

/**
 * Seeds two tenants and optional personas: A-only, B-only, dual-member.
 */
export async function seedTwoTenantPersonas(
  ds: DataSource,
  options: SeedTwoTenantPersonasOptions = {},
): Promise<SeedTwoTenantPersonasResult> {
  const tenantA = {
    id: options.tenantA?.id ?? AUTH_TEST_TENANT_A_ID,
    subdomain: options.tenantA?.subdomain ?? AUTH_TEST_SUBDOMAIN_A,
    name: options.tenantA?.name ?? "Auth E2E Tenant A",
    description: options.tenantA?.description ?? "auth-test-personas tenant A",
  };
  const tenantB = {
    id: options.tenantB?.id ?? AUTH_TEST_TENANT_B_ID,
    subdomain: options.tenantB?.subdomain ?? AUTH_TEST_SUBDOMAIN_B,
    name: options.tenantB?.name ?? "Auth E2E Tenant B",
    description: options.tenantB?.description ?? "auth-test-personas tenant B",
  };

  const tenantRepo = ds.getRepository(TenantEntity);
  await ensureTenant(tenantRepo, tenantA);
  await ensureTenant(tenantRepo, tenantB);

  const personas: AuthTestPersona[] = [];

  // Owner / dual-member personas first — Postgres 23514 requires an active owner before other members.
  if (options.dualMember) {
    const phone = options.dualMember.phone;
    const hash = await argon2.hash(options.dualMember.password ?? `fixture-${phone}`);
    const email = options.dualMember.email ?? authTestEmailForPhone(phone);
    const userRepo = ds.getRepository(UserEntity);
    const membershipRepo = ds.getRepository(UserTenantEntity);

    let user = await userRepo.findOne({ where: { phone } });
    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          email,
          phone,
          isPhoneVerified: true,
          hashedPassword: hash,
          fullName: options.dualMember.fullName ?? "Dual member",
          isEmailVerified: true,
          telegramUserId: null,
        }),
      );
    }

    const role = options.dualMember.role ?? UserRole.Member;
    const status = options.dualMember.membershipStatus ?? MembershipStatus.ACTIVE;

    for (const tenant of [tenantA, tenantB]) {
      let membership = await membershipRepo.findOne({
        where: { userId: user.id, tenantId: tenant.id, deletedAt: IsNull() },
      });
      if (!membership) {
        membership = await membershipRepo.save(
          membershipRepo.create({
            tenantId: tenant.id,
            userId: user.id,
            role,
            status,
            joinedAt: status === MembershipStatus.ACTIVE ? new Date() : null,
          }),
        );
      }
      personas.push({
        userId: user.id,
        tenantId: tenant.id,
        phone,
        email,
        role,
        subdomain: tenant.subdomain,
        membershipStatus: status,
      });
    }
  }

  if (options.userInAOnly) {
    personas.push(
      await seedAuthPersona(ds, {
        ...options.userInAOnly,
        tenantId: tenantA.id,
        subdomain: tenantA.subdomain,
        phone: options.userInAOnly.phone ?? allocateAuthTestPhone(),
      }),
    );
  }

  if (options.userInBOnly) {
    personas.push(
      await seedAuthPersona(ds, {
        ...options.userInBOnly,
        tenantId: tenantB.id,
        subdomain: tenantB.subdomain,
        phone: options.userInBOnly.phone ?? allocateAuthTestPhone(),
      }),
    );
  }

  return {
    tenantA: { id: tenantA.id, subdomain: tenantA.subdomain },
    tenantB: { id: tenantB.id, subdomain: tenantB.subdomain },
    personas,
  };
}

/** Raw SQL helper for membership mutation tests (avoids repository imports in specs). */
export async function updateMembershipRoleByEmail(
  ds: DataSource,
  input: { email: string; tenantId: string; role: UserRole },
): Promise<void> {
  await ds.query(
    `UPDATE user_tenants SET role = $1
     WHERE user_id = (SELECT id FROM users WHERE email = $2 AND deleted_at IS NULL)
       AND tenant_id = $3::uuid
       AND deleted_at IS NULL`,
    [input.role, input.email, input.tenantId],
  );
}

export async function bumpMembershipSessionVersionByEmail(
  ds: DataSource,
  input: { email: string; tenantId: string },
): Promise<void> {
  await ds.query(
    `UPDATE user_tenants SET session_version = session_version + 1
     WHERE user_id = (SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL)
       AND tenant_id = $2::uuid
       AND deleted_at IS NULL`,
    [input.email, input.tenantId],
  );
}

export async function findUserIdByEmail(ds: DataSource, email: string): Promise<string> {
  const rows = await ds.query<{ id: string }[]>(
    `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
    [email],
  );
  const id = rows[0]?.id;
  if (!id) {
    throw new Error(`findUserIdByEmail: no user for ${email}`);
  }
  return id;
}

export async function insertPendingWorkspaceInvite(
  ds: DataSource,
  input: {
    id?: string;
    tenantId: string;
    email: string;
    role: UserRole;
    inviteToken: string;
    invitedByUserId: string;
  },
): Promise<void> {
  await ds.query(
    `INSERT INTO workspace_invites (id, tenant_id, email, role, invite_token, expires_at, invited_by_user_id, status)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, now() + interval '7 days', $6::uuid, 'PENDING')`,
    [
      input.id ?? randomUUID(),
      input.tenantId,
      input.email.toLowerCase(),
      input.role,
      input.inviteToken,
      input.invitedByUserId,
    ],
  );
}

export async function countWorkspaceInvitesByToken(
  ds: DataSource,
  inviteToken: string,
): Promise<number> {
  const rows = await ds.query<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM workspace_invites WHERE invite_token = $1`,
    [inviteToken],
  );
  return Number(rows[0]?.count ?? "0");
}

export async function hasActiveMembership(
  ds: DataSource,
  input: { userId: string; tenantId: string },
): Promise<boolean> {
  const rows = await ds.query<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM user_tenants
     WHERE user_id = $1::uuid AND tenant_id = $2::uuid AND deleted_at IS NULL`,
    [input.userId, input.tenantId],
  );
  return Number(rows[0]?.count ?? "0") > 0;
}
