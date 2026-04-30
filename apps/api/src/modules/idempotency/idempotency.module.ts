import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdempotencyKeyEntity } from "./entities/idempotency-key.entity";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IdempotencyService } from "./idempotency.service";

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKeyEntity])],
  providers: [IdempotencyService, IdempotencyInterceptor, Reflector],
  exports: [IdempotencyService, IdempotencyInterceptor]
})
export class IdempotencyModule {}
