import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import { UserEntity } from "./user.entity";

@Entity({ name: "email_verification_tokens" })
@Index("idx_email_verification_tokens_user_id", ["userId"])
export class EmailVerificationTokenEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user!: UserEntity;

  @Column({ type: "varchar", name: "new_email", length: 320 })
  newEmail!: string;

  @Column({ type: "varchar", name: "token", length: 255, unique: true })
  token!: string;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", name: "used_at", nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
