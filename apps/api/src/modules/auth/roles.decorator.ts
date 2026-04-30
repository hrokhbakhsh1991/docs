import { SetMetadata } from "@nestjs/common";
import type { Role } from "./roles.enum";

export const ROLES_METADATA_KEY = "roles";

export const Roles = (...roles: Role[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
