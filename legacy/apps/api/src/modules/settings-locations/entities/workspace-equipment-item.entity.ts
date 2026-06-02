import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

@Entity({ name: "workspace_equipment_items" })
@Index("idx_workspace_equipment_items_workspace_id", ["workspaceId"])
@Index("idx_workspace_equipment_items_workspace_slug", ["workspaceId", "slug"], { unique: true })
export class WorkspaceEquipmentItemEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 120 })
  slug!: string;

  @Column({ name: "compatible_categories", type: "jsonb", default: () => "'[]'" })
  compatibleCategories!: string[];

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  icon!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
