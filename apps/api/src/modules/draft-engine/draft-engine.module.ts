import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuthModule } from "../auth/auth.module";
import { DraftSnapshotEntity } from "./entities/draft-snapshot.entity";
import { DraftEngineController } from "./draft-engine.controller";
import { DraftEngineService } from "./draft-engine.service";

@Module({
  imports: [TypeOrmModule.forFeature([DraftSnapshotEntity]), AuthModule, RequestContextModule],
  controllers: [DraftEngineController],
  providers: [DraftEngineService],
  exports: [DraftEngineService],
})
export class DraftEngineModule {}
