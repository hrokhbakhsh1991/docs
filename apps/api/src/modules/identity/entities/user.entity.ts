import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn
} from "typeorm";
import { UserTenantEntity } from "./user-tenant.entity";

@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Index("uq_users_email", { unique: true })
  @Column({ type: "varchar", name: "email", length: 320 })
  email!: string;

  @Index("uq_users_phone", { unique: true })
  @Column({ type: "varchar", name: "phone", nullable: true })
  phone?: string;

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
  fullName?: string | null;

  @Column({ type: "varchar", name: "national_id", length: 10, nullable: true })
  nationalId?: string | null;

  @Column({ type: "varchar", name: "gender", length: 32, nullable: true })
  gender?: string | null;

  @Column({ type: "date", name: "birth_date", nullable: true })
  birthDate?: Date | string | null;

  @Column({ type: "boolean", name: "is_email_verified", default: false })
  isEmailVerified!: boolean;

  @Column({ type: "boolean", name: "is_phone_verified", default: false })
  isPhoneVerified?: boolean;

  @Column({
    type: "boolean",
    name: "notifications_enabled",
    nullable: true,
    default: null
  })
  notificationsEnabled?: boolean | null;

  @VersionColumn({
    type: "int",
    name: "profile_row_version",
    default: 1
  })
  profileRowVersion!: number;

  @Column({ type: "timestamptz", name: "last_login_at", nullable: true })
  lastLoginAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamptz", name: "deleted_at", nullable: true })
  deletedAt?: Date;

  @OneToMany(() => UserTenantEntity, (membership) => membership.user)
  memberships!: UserTenantEntity[];
}
