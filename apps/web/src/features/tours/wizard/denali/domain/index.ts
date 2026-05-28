/**
 * Denali domain façade — browser-safe canonical basics only.
 *
 * Validation, rules, and form transforms are not re-exported here (avoids pulling
 * validation barrels into the client graph). UI imports those from `../application`
 * or deep paths under `../validation/*`.
 */

export {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "./canonical-basics";
