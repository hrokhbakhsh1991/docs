import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { MobileOtpChallengeEntity } from "./entities/mobile-otp-challenge.entity";
import { OtpService } from "./otp.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MobileOtpChallengeEntity])],
  providers: [OtpService],
  exports: [OtpService]
})
export class OtpModule {}
