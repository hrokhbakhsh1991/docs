import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { CreateDateColumn } from "typeorm";
import { TourDepartureEntity } from "./tour-departure.entity";

export enum TourPriceType {
  BASE = "base",
  EARLY_BIRD = "early_bird",
  GROUP = "group",
  VIP = "vip",
  PROMO = "promo",
  DYNAMIC = "dynamic"
}

@Entity("tour_prices")
@Index("idx_tour_prices_departure", ["tourDepartureId"])
export class TourPriceEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tour_departure_id" })
  tourDepartureId!: string;

  @ManyToOne(() => TourDepartureEntity, (d) => d.prices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tour_departure_id" })
  tourDeparture!: TourDepartureEntity;

  @Column({
    type: "enum",
    enum: TourPriceType,
    enumName: "tour_price_type_enum",
    name: "price_type",
    default: TourPriceType.BASE
  })
  priceType!: TourPriceType;

  @Column({ type: "varchar", length: 3, name: "currency_code" })
  currencyCode!: string;

  @Column({ type: "bigint", name: "amount_minor" })
  amountMinor!: string;

  @Column({ type: "jsonb", name: "conditions_json", nullable: true })
  conditionsJson?: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
