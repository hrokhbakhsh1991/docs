import { Global, Module } from "@nestjs/common";

import { ConfigModule } from "../../config/config.module";
import { ConfigService } from "../../config/config.service";
import { LoggerModule } from "../logger/logger.module";
import { LoggerService } from "../logger/logger.service";
import { EmailService } from "./email.service";

@Global()
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [
    {
      provide: EmailService,
      useFactory: (config: ConfigService, logger: LoggerService) => new EmailService(config, logger),
      inject: [ConfigService, LoggerService]
    }
  ],
  exports: [EmailService]
})
export class EmailModule {}
