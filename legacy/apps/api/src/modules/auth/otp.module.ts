import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { MobileOtpChallengeEntity } from "./entities/mobile-otp-challenge.entity";
import { OTP_CHALLENGE_REPOSITORY_PORT } from "./domain/ports/otp-challenge-repository.port";
import { OtpService } from "./otp.service";
import { TypeOrmOtpChallengeRepository } from "./repositories/typeorm-otp-challenge.repository";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MobileOtpChallengeEntity])],
  providers: [
    TypeOrmOtpChallengeRepository,
    {
      provide: OTP_CHALLENGE_REPOSITORY_PORT,
      useExisting: TypeOrmOtpChallengeRepository,
    },
    OtpService,
  ],
  exports: [OtpService]
})
export class OtpModule {}
