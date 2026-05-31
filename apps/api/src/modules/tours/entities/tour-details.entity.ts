import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from "typeorm";

import { TOUR_ENTITY, type ITourEntity } from "@repo/domain-contracts";
import {
  DifficultyLevel,
  type ItineraryItem,
  type TourItineraryItem,
  type TourTripDetails
} from "../types/tour-trip-details.types";

export { DifficultyLevel, type ItineraryItem, type TourItineraryItem };

@Entity("tour_details")
@Index("idx_tour_details_tenant_id_tour_id", ["tenantId", "tourId"])
@Unique("uq_tour_details_tenant_id_tour_id", ["tenantId", "tourId"])
export class TourDetails {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "tenant_id", nullable: false })
  tenantId!: string;

  @Column({ type: "uuid", name: "tour_id" })
  tourId!: string;

  @OneToOne(TOUR_ENTITY, "details", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "tour_id" })
  tour!: ITourEntity;

  @Column({ type: "varchar", name: "destination_name", nullable: true })
  destinationName!: string | null;

  @Column({ type: "int", name: "elevation_m", nullable: true })
  elevationM!: number | null;

  @Column({
    type: "enum",
    enum: DifficultyLevel,
    enumName: "difficulty_level",
    name: "difficulty",
    nullable: true
  })
  difficulty!: DifficultyLevel | null;

  @Column({ type: "int", name: "duration_days", nullable: true })
  durationDays!: number | null;

  @Column({ type: "varchar", name: "meeting_point", nullable: true })
  meetingPoint!: string | null;

  @Column({ type: "jsonb", name: "itinerary", nullable: true })
  itinerary!: ItineraryItem[] | null;

  @Column({ type: "jsonb", name: "trip_details", nullable: true })
  tripDetails!: TourTripDetails | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
