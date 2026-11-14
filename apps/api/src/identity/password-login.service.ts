import type { IdentityRepository } from "./create-identity-repository";
import { canonicalizeLoginMobile } from "./canonicalize-login-mobile";
import { isSupportedPasswordHash, verifyPassword } from "./password-hash";
import { signSessionToken } from "./sign-session-token";

// This is a hash of a public dummy value, never a real account credential. It
// ensures absent accounts take the same password-KDF path as existing ones.
const DUMMY_HASH =
  "scrypt$v1$16384$8$5$e4c6b0e63f411f7d3f9e37c2f0ec5faf$32f3e1989f175fb7a7ebd69bca14bcc5228a26a3ef9ed77ba28c50d6370711a1";

export class PasswordLoginError extends Error {
  readonly code = "PASSWORD_LOGIN_FAILED";
  constructor() {
    super("PASSWORD_LOGIN_FAILED");
    this.name = "PasswordLoginError";
  }
}

type PasswordLoginDependencies = {
  readonly repo: IdentityRepository;
  readonly assertTenant: (tenantId: string) => Promise<void>;
  readonly assertAttempt: (input: {
    readonly tenantId: string;
    readonly mobile: string;
    readonly clientIp?: string;
  }) => Promise<void>;
  readonly signSession?: typeof signSessionToken;
};

/** No registration or invite is created through password authentication. */
export async function loginWithPassword(
  input: {
    readonly tenantId: string;
    readonly mobile: string;
    readonly password: string;
    readonly clientIp?: string;
  },
  dependencies: PasswordLoginDependencies
): Promise<{
  readonly sessionToken: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly role: string;
}> {
  const mobile = canonicalizeLoginMobile(input.mobile);
  await dependencies.assertAttempt({
    tenantId: input.tenantId,
    mobile,
    ...(input.clientIp !== undefined ? { clientIp: input.clientIp } : {}),
  });
  await dependencies.assertTenant(input.tenantId);
  if (Array.from(input.password.normalize("NFC")).length > 128) throw new PasswordLoginError();
  const user = await dependencies.repo.findUserByMobile(mobile);
  const stored = user === null ? null : await dependencies.repo.findPasswordHash(user.id);
  const supported = stored !== null && isSupportedPasswordHash(stored);
  const matches = await verifyPassword(input.password, supported ? stored : DUMMY_HASH);
  const membership =
    user === null ? null : await dependencies.repo.findMembership(user.id, input.tenantId);
  if (
    !matches ||
    !supported ||
    user === null ||
    membership === null ||
    membership.status !== "ACTIVE"
  ) {
    throw new PasswordLoginError();
  }
  // A credential replacement and membership-version bump commit together.
  // Read the membership first, then ensure the verified credential is still
  // current; a later replacement makes the token's membership version stale.
  if ((await dependencies.repo.findPasswordHash(user.id)) !== stored) {
    throw new PasswordLoginError();
  }
  const sessionToken = await (dependencies.signSession ?? signSessionToken)({
    userId: user.id,
    tenantId: input.tenantId,
    role: membership.role,
    sessionVersion: membership.sessionVersion,
    ...(membership.workspaceId !== undefined ? { workspaceId: membership.workspaceId } : {}),
  });
  return { sessionToken, userId: user.id, tenantId: input.tenantId, role: membership.role };
}
