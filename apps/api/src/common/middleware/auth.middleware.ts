import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  UnauthorizedException
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { jwtVerify } from "jose";
import type { NextFunction, Request, Response } from "express";
import type { DataSource } from "typeorm";
import { loadPublicKey } from "../../auth/jwt-key.util";
import { ConfigService } from "../../config/config.service";
import { UserTenantEntity } from "../../modules/identity/entities/user-tenant.entity";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

type JwtClaims = {
  sub?: string;
  tenant_id?: string;
  role?: string;
  email?: string;
};

const PUBLIC_ROUTES = [
  "/health",
  "/internal",
  "/api/docs",
  "/api/v2/auth/web/session",
  "/api/v2/auth/telegram/session"
];

/** JWT required; tenant membership check skipped (handler lists all memberships with RLS bypass). */
const AUTH_WORKSPACES_PATH = "/api/v2/auth/workspaces";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly loggerService: LoggerService
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      if (
        (req.method === "POST" &&
          /^\/api\/v2\/tours\/[^/]+\/(register|waitlist)$/.test(req.path))
      ) {
        return next();
      }
      if (PUBLIC_ROUTES.some((route) => req.path.startsWith(route))) {
        return next();
      }

      const authHeader = req.header("authorization");
      if (!authHeader) {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_UNAUTHENTICATED",
            message: "Authentication required"
          }
        });
      }

      const [scheme, token] = authHeader.split(" ");
      if (scheme?.toLowerCase() !== "bearer" || !token) {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_UNAUTHENTICATED",
            message: "Authentication required"
          }
        });
      }

      let payload: JwtClaims;
      try {
        const publicKey = await loadPublicKey(this.configService.getJwtPublicKey());

        const verified = await jwtVerify(token, publicKey, {
          algorithms: ["RS256"],
          issuer: this.configService.getJwtIssuer(),
          audience: this.configService.getJwtAudience(),
          clockTolerance: "5s"
        });
        payload = verified.payload as JwtClaims;
      } catch {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_UNAUTHENTICATED",
            message: "Authentication required"
          }
        });
      }

      if (
        typeof payload.sub !== "string" ||
        typeof payload.tenant_id !== "string" ||
        typeof payload.role !== "string"
      ) {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_UNAUTHENTICATED",
            message: "Authentication required"
          }
        });
      }

      const userId = payload.sub.trim();
      const tenantId = payload.tenant_id.trim();
      const role = payload.role.trim();

      if (!userId || !tenantId || !role) {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_UNAUTHENTICATED",
            message: "Authentication required"
          }
        });
      }

      this.requestContextService.setUserId(userId);
      this.requestContextService.setTenantId(tenantId);
      this.requestContextService.setRole(role);

      const skipTenantMembershipCheck =
        req.method === "GET" && req.path === AUTH_WORKSPACES_PATH;

      if (skipTenantMembershipCheck) {
        return next();
      }

      const queryRunner = this.dataSource.createQueryRunner();
      try {
        await queryRunner.connect();

        const isMember = await queryRunner.manager
          .getRepository(UserTenantEntity)
          .createQueryBuilder("ut")
          .where("ut.user_id = :userId", { userId })
          .andWhere("ut.tenant_id = :tenantId", { tenantId })
          .andWhere("ut.deleted_at IS NULL")
          .getExists();

        if (!isMember) {
          this.loggerService.warn(
            "User attempted access without tenant membership",
            {
              userId,
              tenantId
            }
          );
          throw new ForbiddenException({
            error: {
              code: "TENANT_SCOPE_FORBIDDEN",
              message: "Access to tenant denied"
            }
          });
        }
      } finally {
        await queryRunner.release();
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }
}
