import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import { TourEntity as Tour } from "./tour.entity";

export enum DifficultyLevel {
  EASY = "easy",
  MODERATE = "moderate",
  HARD = "hard",
  TECHNICAL = "technical"
}

export interface ItineraryItem {
  day: number;
  title?: string;
  description?: string;
  distanceKm?: number;
  elevationGainM?: number;
}

export type TourItineraryItem = ItineraryItem;

@Entity("tour_details")
export class TourDetails {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "tour_id", unique: true })
  tourId!: string;

  @OneToOne(() => Tour, (tour) => tour.details, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "tour_id" })
  tour!: Tour;

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

  @Column({ type: "jsonb", name: "required_gear", nullable: true })
  requiredGear!: string[] | null;

  @Column({ type: "jsonb", name: "itinerary", nullable: true })
  itinerary!: ItineraryItem[] | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
