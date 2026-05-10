import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export type MobileOtpPurpose = "login" | "change_mobile";

@Entity({ name: "mobile_otp_challenges" })
export class MobileOtpChallengeEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "varchar", name: "mobile", length: 64 })
  mobile!: string;

  @Column({ type: "varchar", name: "purpose", length: 32 })
  purpose!: MobileOtpPurpose;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "boolean", name: "used", default: false })
  used!: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
