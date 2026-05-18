import { z } from "zod";
import { envSchema } from "./env.schema";

export type EnvVariables = z.infer<typeof envSchema>;
export type LogLevel = EnvVariables["LOG_LEVEL"];

export type DatabaseConfig = {
  host: EnvVariables["DATABASE_HOST"];
  port: EnvVariables["DATABASE_PORT"];
  user: EnvVariables["DATABASE_USER"];
  password: EnvVariables["DATABASE_PASSWORD"];
  name: EnvVariables["DATABASE_NAME"];
};

export type RedisConfig = {
  host: EnvVariables["REDIS_HOST"];
  port: EnvVariables["REDIS_PORT"];
  password?: string;
};

export type MinioConfig = {
  endPoint: EnvVariables["MINIO_ENDPOINT"];
  port: EnvVariables["MINIO_PORT"];
  accessKey: EnvVariables["MINIO_ACCESS_KEY"];
  secretKey: EnvVariables["MINIO_SECRET_KEY"];
  useSSL: EnvVariables["MINIO_USE_SSL"];
  bucket: EnvVariables["MINIO_BUCKET"];
};
