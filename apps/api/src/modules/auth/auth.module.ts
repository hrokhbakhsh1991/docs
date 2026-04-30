import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "../identity/entities/user.entity";
import { UserTenantEntity } from "../identity/entities/user-tenant.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserTenantEntity])],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard]
})
export class AuthModule {}
