import type { IncomingMessage } from "node:http";

import { resolveDenaliPublicAuth } from "./resolve-denali-public-auth";

const PUBLIC_CATALOG_GUEST_USER_ID = "00000000-0000-4000-0000-000000000001";
const UNAUTHORIZED_REGISTERED_USER_REQUIRED = "UNAUTHORIZED_REGISTERED_USER_REQUIRED";

/** Registered-user Denali routes — requires a non-anonymous actor id. */
export function resolveDenaliRegisteredAuth(req: IncomingMessage) {
  const auth = resolveDenaliPublicAuth(req);
  if (auth.userId === PUBLIC_CATALOG_GUEST_USER_ID) {
    throw new Error(UNAUTHORIZED_REGISTERED_USER_REQUIRED);
  }
  return auth;
}
