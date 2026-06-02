import { Global, Module } from "@nestjs/common";
import { RedisClientFactory } from "./redis-client.factory";
import { REDIS_CLIENT } from "./redis.constants";

@Global()
@Module({
  providers: [RedisClientFactory],
  exports: [REDIS_CLIENT]
})
export class RedisInfraModule {}
