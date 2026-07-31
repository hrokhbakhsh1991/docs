import type { IncomingMessage } from "node:http";
import { assertWorkspaceRegisteredUserOrThrow } from "@app-tour/workspace-sdk";

import { resolveDenaliPublicAuth } from "./resolve-denali-public-auth";

/** Registered-user Denali routes — requires a non-anonymous actor id. */
export function resolveDenaliRegisteredAuth(req: IncomingMessage) {
  const auth = resolveDenaliPublicAuth(req);
  assertWorkspaceRegisteredUserOrThrow(auth);
  return auth;
}
