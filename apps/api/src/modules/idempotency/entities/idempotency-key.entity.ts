import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from "typeorm";

@Entity("idempotency_keys")
@Index("uq_idempotency_key", ["key"], { unique: true })
@Index("idx_idempotency_expires_at", ["expiresAt"])
export class IdempotencyKeyEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  key!: string;

  @Column({ type: "varchar", length: 255 })
  endpoint!: string;

  @Column({ type: "varchar", name: "request_hash", length: 128 })
  requestHash!: string;

  @Column({ type: "jsonb", name: "response_body", nullable: true })
  responseBody!: Record<string, unknown> | null;

  @Column({ type: "int", name: "status_code", nullable: true })
  statusCode!: number | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;
}
