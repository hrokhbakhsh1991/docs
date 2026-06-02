import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { TOUR_DEPARTURE_ENTITY, type ITourDepartureEntity } from "@repo/domain-contracts";

@Entity("tour_products")
@Index("idx_tour_products_tenant_id", ["tenantId"])
export class TourProductEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "varchar", length: 255, name: "title" })
  title!: string;

  @Column({ type: "varchar", length: 255, name: "slug", nullable: true })
  slug?: string | null;

  @Column({ type: "text", name: "description", nullable: true })
  description?: string | null;

  @Column({ type: "jsonb", name: "settings", nullable: true })
  settings?: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(TOUR_DEPARTURE_ENTITY, "tourProduct")
  departures?: ITourDepartureEntity[];
}
