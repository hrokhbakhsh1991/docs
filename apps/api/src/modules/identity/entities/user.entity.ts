import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { UserTenantEntity } from "./user-tenant.entity";

@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Index("uq_users_email", { unique: true })
  @Column({ type: "varchar", name: "email", length: 320 })
  email!: string;

  @Column({
    name: "telegram_user_id",
    type: "varchar",
    nullable: true,
    unique: true
  })
  telegramUserId?: string | null;

  @Column({ type: "varchar", name: "hashed_password", length: 255 })
  hashedPassword!: string;

  @Column({ type: "varchar", name: "full_name", length: 255, nullable: true })
  fullName?: string;

  @Column({ type: "boolean", name: "is_email_verified", default: false })
  isEmailVerified!: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamptz", name: "deleted_at", nullable: true })
  deletedAt?: Date;

  @OneToMany(() => UserTenantEntity, (membership) => membership.user)
  memberships!: UserTenantEntity[];
}
