import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigService } from "../config/config.service";
import { createTypeOrmOptions } from "./database.config";
import { TenantSessionBindingService } from "./tenant-session-binding.service";
import { TenantDbContextService } from "./tenant-db-context.service";
import { RuntimeSchemaGuardService } from "./runtime-schema-guard.service";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createTypeOrmOptions(configService)
    })
  ],
  providers: [TenantSessionBindingService, TenantDbContextService, RuntimeSchemaGuardService],
  exports: [TypeOrmModule, TenantDbContextService]
})
export class DatabaseModule {}
