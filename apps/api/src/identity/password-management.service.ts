import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getIdentityRepository, type IdentityRepository } from "./create-identity-repository";
import { createMobileOtpChallenge, verifyPasswordChangeOtp } from "./otp.service";
import { hashPassword } from "./password-hash";
import { validateNewPassword } from "./password-policy";
import { signSessionToken } from "./sign-session-token";

export class PasswordManagementError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PasswordManagementError";
  }
}

type Dependencies = {
  readonly repo?: IdentityRepository;
  readonly signSession?: typeof signSessionToken;
};

async function readActiveSelf(
  auth: TenantAuthContext,
  expectedSessionVersion: number,
  repo: IdentityRepository
) {
  const [user, membership] = await Promise.all([
    repo.findUserById(auth.userId),
    repo.findMembership(auth.userId, auth.tenantId),
  ]);
  if (
    auth.status !== "ACTIVE" ||
    user === null ||
    membership === null ||
    membership.status !== "ACTIVE" ||
    membership.sessionVersion !== expectedSessionVersion
  ) {
    throw new PasswordManagementError("PASSWORD_SESSION_INVALID");
  }
  return { user, membership };
}

/** Caller must enforce authenticated self access and the read-only support guard. */
export async function requestOwnPasswordChangeOtp(
  auth: TenantAuthContext,
  expectedSessionVersion: number,
  repo: IdentityRepository = getIdentityRepository()
): Promise<{ readonly challengeId: string; readonly otpLength: number }> {
  const { user } = await readActiveSelf(auth, expectedSessionVersion, repo);
  const { resolveWorkspaceTypeForTenant } = await import("../tenant/resolve-workspace-type");
  return createMobileOtpChallenge(user.mobile, repo, {
    purpose: "password_change",
    tenantId: auth.tenantId,
    userId: auth.userId,
    workspaceType: await resolveWorkspaceTypeForTenant(auth.tenantId),
  });
}

/** Caller supplies the session version from the already verified request JWT. */
export async function changeOwnPassword(
  auth: TenantAuthContext,
  expectedSessionVersion: number,
  input: { readonly challengeId: string; readonly code: string; readonly password: string },
  dependencies: Dependencies = {}
): Promise<{ readonly sessionToken: string }> {
  const policyError = validateNewPassword(input.password);
  if (policyError !== null) throw new PasswordManagementError(policyError);
  const repo = dependencies.repo ?? getIdentityRepository();
  const { user, membership } = await readActiveSelf(auth, expectedSessionVersion, repo);
  const proof = await verifyPasswordChangeOtp(
    input.challengeId,
    input.code,
    { tenantId: auth.tenantId, userId: auth.userId, mobile: user.mobile },
    repo
  );
  const passwordHash = await hashPassword(input.password);
  // Sign first so a signing configuration failure cannot commit a password change
  // while failing to refresh the user's current session.
  const sessionToken = await (dependencies.signSession ?? signSessionToken)({
    userId: auth.userId,
    tenantId: auth.tenantId,
    role: membership.role,
    sessionVersion: expectedSessionVersion + 1,
    ...(membership.workspaceId !== undefined ? { workspaceId: membership.workspaceId } : {}),
  });
  const newVersion = await repo.commitPasswordCredential({
    userId: auth.userId,
    tenantId: auth.tenantId,
    mobile: user.mobile,
    challengeId: proof.challengeId,
    codeHash: proof.codeHash,
    passwordHash,
    expectedSessionVersion,
  });
  if (newVersion === null) throw new PasswordManagementError("PASSWORD_CHALLENGE_INVALID");
  return { sessionToken };
}
