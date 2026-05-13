/**
 * CASL + shared ability factory re-exports for NestJS.
 *
 * `@casl/nestjs` is not published on npm; use {@link defineAbilityFor} with a custom
 * guard or `nest-casl` if you want a third-party Nest adapter (stalniy/casl#915).
 */
export {
  AbilityBuilder,
  createMongoAbility,
  subject,
  type MongoAbility
} from "@casl/ability";
export {
  defineAbilityFor,
  type AppAbility,
  type UserAbilityContext,
  type WorkspaceAbilityAction,
  type WorkspaceAbilitySubject,
  type UserAbilityMembershipStatus
} from "@repo/shared-rbac";
