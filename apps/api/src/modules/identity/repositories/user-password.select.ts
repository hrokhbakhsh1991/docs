import type { SelectQueryBuilder } from "typeorm";
import type { UserEntity } from "../entities/user.entity";

/** Use when a password-verify path must load `hashed_password` (column has `select: false` on the entity). */
export function addUserHashedPasswordSelect(qb: SelectQueryBuilder<UserEntity>): SelectQueryBuilder<UserEntity> {
  return qb.addSelect("user.hashed_password", "user_hashed_password");
}
