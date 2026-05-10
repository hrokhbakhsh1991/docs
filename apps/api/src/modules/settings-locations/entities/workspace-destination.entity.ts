import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import { WorkspaceRegionEntity } from "./workspace-region.entity";

@Entity({ name: "workspace_destinations" })
@Index("idx_workspace_destinations_tenant_id", ["tenantId"])
@Index("idx_workspace_destinations_region_id", ["regionId"])
export class WorkspaceDestinationEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "tenant_id", type: "uuid" })
  tenantId!: string;

  @Column({ name: "region_id", type: "uuid" })
  regionId!: string;

  @ManyToOne(() => WorkspaceRegionEntity, (r) => r.destinations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "region_id" })
  region!: WorkspaceRegionEntity;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  type!: string | null;

  @Column({ name: "altitude_m", type: "int", nullable: true })
  altitudeM!: number | null;

  @Column({ name: "sort_order", type: "int", nullable: true })
  sortOrder!: number | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
