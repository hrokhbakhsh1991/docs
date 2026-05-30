import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { MobileOtpPurpose } from "../mobile-otp.types";
import type { OtpChallengeRepositoryPort } from "../domain/ports/otp-challenge-repository.port";
import { MobileOtpChallengeEntity } from "../entities/mobile-otp-challenge.entity";

@Injectable()
export class TypeOrmOtpChallengeRepository implements OtpChallengeRepositoryPort {
  constructor(
    @InjectRepository(MobileOtpChallengeEntity)
    private readonly challengeRepository: Repository<MobileOtpChallengeEntity>
  ) {}

  async markChallengeUsed(row: {
    id: string;
    mobile: string;
    purpose: MobileOtpPurpose;
    expiresAt: Date;
    used: boolean;
  }): Promise<void> {
    row.used = true;
    await this.challengeRepository.save(row);
  }
}
