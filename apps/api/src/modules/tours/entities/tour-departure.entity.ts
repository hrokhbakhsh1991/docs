import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn
} from "typeorm";
import { TourProductEntity } from "./tour-product.entity";
import { TourLifecycleStatus } from "./tour.entity";
import { TourPriceEntity } from "./tour-price.entity";

@Entity("tour_departures")
@Index("idx_tour_departures_tenant_starts", ["tenantId", "startsOn"])
@Index("idx_tour_departures_product_id", ["tourProductId"])
export class TourDepartureEntity {
  @PrimaryColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tour_product_id" })
  tourProductId!: string;

  @ManyToOne(() => TourProductEntity, (p) => p.departures, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tour_product_id" })
  tourProduct!: TourProductEntity;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "date", name: "starts_on", nullable: true })
  startsOn?: string | null;

  @Column({ type: "date", name: "ends_on", nullable: true })
  endsOn?: string | null;

  @Column({ type: "varchar", length: 3, name: "currency_code", nullable: true })
  currencyCode?: string | null;

  @Column({ type: "bigint", name: "list_price_minor", nullable: true })
  listPriceMinor?: string | null;

  @Column({
    type: "enum",
    enum: TourLifecycleStatus,
    enumName: "tour_lifecycle_status_enum",
    name: "lifecycle_status",
    default: TourLifecycleStatus.DRAFT
  })
  lifecycleStatus!: TourLifecycleStatus;

  @Column({ type: "int", name: "capacity_total", default: 0 })
  capacityTotal!: number;

  @Column({ type: "int", name: "reserved_count", default: 0 })
  reservedCount!: number;

  @Column({ type: "int", name: "sold_count", default: 0 })
  soldCount!: number;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => TourPriceEntity, (p) => p.tourDeparture)
  prices?: TourPriceEntity[];
}
