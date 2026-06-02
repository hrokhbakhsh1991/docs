import { FactoryProvider } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigService } from "../../config/config.service";
import { REDIS_CLIENT } from "./redis.constants";

export const RedisClientFactory: FactoryProvider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService) => {
    const redisConfig = config.getRedisConfig();
    return new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password
    });
  },
  inject: [ConfigService]
};
