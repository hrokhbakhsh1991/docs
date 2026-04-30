import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { UserTenantEntity } from "./user-tenant.entity";

@Entity({ name: "tenants" })
export class TenantEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "varchar", name: "name", length: 255 })
  name!: string;

  @Column({ type: "text", name: "description", nullable: true })
  description?: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamptz", name: "deleted_at", nullable: true })
  deletedAt?: Date;

  @OneToMany(() => UserTenantEntity, (membership) => membership.tenant)
  members!: UserTenantEntity[];
}
