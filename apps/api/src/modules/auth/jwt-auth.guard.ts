/**
 * Back-compat: {@link JwtAuthGuard} aliases {@link AuthorizationPresenceGuard}
 * (bearer presence only; JWT/session validation runs in middleware).
 */

export {
  AuthorizationPresenceGuard,
  AuthorizationPresenceGuard as JwtAuthGuard
} from "./authorization-presence.guard";
