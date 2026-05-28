import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import {
  WORKSPACE_DESTINATION_ENTITY,
  type IWorkspaceDestinationEntity
} from "@repo/domain-contracts";

@Entity({ name: "workspace_regions" })
@Index("idx_workspace_regions_tenant_id", ["tenantId"])
export class WorkspaceRegionEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "tenant_id", type: "uuid" })
  tenantId!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  country!: string | null;

  @Column({ name: "sort_order", type: "int", nullable: true })
  sortOrder!: number | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(WORKSPACE_DESTINATION_ENTITY, "region")
  destinations?: IWorkspaceDestinationEntity[];
}
