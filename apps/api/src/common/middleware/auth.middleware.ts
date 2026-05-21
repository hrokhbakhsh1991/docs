import {
  ForbiddenException,
  Inject,
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
import {
  AUTH_PUBLIC_HOST_PROBE_ROUTES,
  AUTH_SESSION_LOGIN_ROUTES,
  skipsJwtHostTenantAlignment,
} from "../auth/auth-route-policy";
import { authRequiredError } from "../errors/error-response-builders";
import { LoggerService } from "../logger/logger.service";
import { tryParseWorkspaceUserRole } from "../auth/user-role.enum";
import { RequestContextService } from "../request-context/request-context.service";
import { verifyActiveMembershipAndHydrateContext } from "./auth-membership-verification";

type JwtClaims = {
  sub?: string;
  tenant_id?: string;
  role?: string;
  email?: string;
  sess_ver?: unknown;
  /** Comma-separated effective capability snapshot (Phase 8.2). */
  caps?: string;
};

const PUBLIC_ROUTES = [
  "/health",
  "/internal",
  "/api/docs",
  ...AUTH_SESSION_LOGIN_ROUTES,
  ...AUTH_PUBLIC_HOST_PROBE_ROUTES,
];
const JWT_COOKIE_NAME = "jwt";
const PRIMARY_SESSION_TOKEN_COOKIE = "tour_ops_session";
const ALT_SESSION_TOKEN_COOKIE = "session";

function extractCookieToken(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const chunks = cookieHeader.split(";");
  for (const chunk of chunks) {
    const [rawName, ...rest] = chunk.trim().split("=");
    if (rawName !== cookieName) {
      continue;
    }
    const rawValue = rest.join("=").trim();
    if (!rawValue) {
      return undefined;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return undefined;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  /**
   * For public POST `/api/v2/tours/:id/register|waitlist` (and GET mint for keys), authentication is not required.
   * Public mutations require a non-blank `Idempotency-Key` header (enforced in {@link RegistrationsController}).
   * When a valid session token is present anyway, attach JWT context so downstream handlers
   * (e.g. tour policies keyed off profile fields) can resolve `userId`.
   */
  private async tryAttachJwtContextForPublicTourPlacement(req: Request): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        return;
      }

      const publicKey = await loadPublicKey(this.configService.getJwtPublicKey());
      let payload: JwtClaims;
      try {
        const verified = await jwtVerify(token, publicKey, {
          algorithms: ["RS256"],
          issuer: this.configService.getJwtIssuer(),
          audience: this.configService.getJwtAudience(),
          clockTolerance: "5s"
        });
        payload = verified.payload as JwtClaims;
      } catch {
        return;
      }

      if (
        typeof payload.sub !== "string" ||
        typeof payload.tenant_id !== "string" ||
        typeof payload.role !== "string"
      ) {
        return;
      }

      const jwtSessionVersion =
        typeof payload.sess_ver === "number"
          ? payload.sess_ver
          : typeof payload.sess_ver === "string" && payload.sess_ver.trim() !== ""
            ? Number(payload.sess_ver)
            : NaN;
      if (!Number.isInteger(jwtSessionVersion) || jwtSessionVersion < 1) {
        return;
      }

      const userId = payload.sub.trim();
      const tenantId = payload.tenant_id.trim();
      const roleRaw = payload.role.trim();
      const role = tryParseWorkspaceUserRole(roleRaw);
      if (!userId || !tenantId || !role) {
        return;
      }

      const hostTenantEntity = req.tenant;
      if (
        hostTenantEntity?.id &&
        !skipsJwtHostTenantAlignment(req.path, req.method) &&
        hostTenantEntity.id.trim().toLowerCase() !== tenantId.trim().toLowerCase()
      ) {
        return;
      }

      const queryRunner = this.dataSource.createQueryRunner();
      try {
        await queryRunner.connect();

        const result = await verifyActiveMembershipAndHydrateContext({
          userId,
          tenantId,
          jwtRole: role,
          jwtSessionVersion,
          jwtCapsClaim: payload.caps,
          queryRunner,
          requestContextService: this.requestContextService,
          loggerService: this.loggerService,
          silentOnFailure: true
        });
        if (!result.ok) {
          return;
        }
      } finally {
        await queryRunner.release();
      }
    } catch {
      /* anonymous registration — ignore optional auth failures */
    }
  }

  private extractToken(req: Request): string | undefined {
    const cookieHeader = req.header("cookie");
    const jwtCookieToken = extractCookieToken(cookieHeader, JWT_COOKIE_NAME);
    if (jwtCookieToken) {
      this.loggerService.debug("AuthMiddleware: using token from jwt cookie");
      return jwtCookieToken;
    }

    const primaryCookieToken = extractCookieToken(cookieHeader, PRIMARY_SESSION_TOKEN_COOKIE);
    if (primaryCookieToken) {
      this.loggerService.debug("AuthMiddleware: using token from tour_ops_session cookie");
      return primaryCookieToken;
    }

    const altCookieToken = extractCookieToken(cookieHeader, ALT_SESSION_TOKEN_COOKIE);
    if (altCookieToken) {
      this.loggerService.debug("AuthMiddleware: using token from session cookie");
      return altCookieToken;
    }

    const authHeader = req.header("authorization");
    if (typeof authHeader === "string") {
      const [scheme, bearerToken] = authHeader.split(" ");
      if (scheme?.toLowerCase() === "bearer" && typeof bearerToken === "string" && bearerToken.trim() !== "") {
        this.loggerService.debug("AuthMiddleware: using token from Authorization header");
        return bearerToken.trim();
      }
    }

    this.loggerService.debug("AuthMiddleware: no auth token found");
    return undefined;
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      if (
        (req.method === "POST" &&
          /^\/api\/v2\/tours\/[^/]+\/(register|waitlist)$/.test(req.path)) ||
        (req.method === "GET" &&
          /^\/api\/v2\/tours\/[^/]+\/registration-idempotency-key$/.test(req.path))
      ) {
        await this.tryAttachJwtContextForPublicTourPlacement(req);
        return next();
      }
      if (PUBLIC_ROUTES.some((route) => req.path.startsWith(route))) {
        return next();
      }

      const token = this.extractToken(req);
      if (!token) {
        throw new UnauthorizedException(authRequiredError());
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
        throw new UnauthorizedException(authRequiredError());
      }

      if (
        typeof payload.sub !== "string" ||
        typeof payload.tenant_id !== "string" ||
        typeof payload.role !== "string"
      ) {
        throw new UnauthorizedException(authRequiredError());
      }

      const jwtSessionVersion =
        typeof payload.sess_ver === "number"
          ? payload.sess_ver
          : typeof payload.sess_ver === "string" && payload.sess_ver.trim() !== ""
            ? Number(payload.sess_ver)
            : NaN;
      if (!Number.isInteger(jwtSessionVersion) || jwtSessionVersion < 1) {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_TOKEN_REVOKED",
            message: "Session token is missing a valid session version"
          }
        });
      }

      const userId = payload.sub.trim();
      const tenantId = payload.tenant_id.trim();
      const roleRaw = payload.role.trim();
      const role = tryParseWorkspaceUserRole(roleRaw);

      if (!userId || !tenantId || !role) {
        throw new UnauthorizedException(
          roleRaw && !role
            ? {
                error: {
                  code: "AUTH_INVALID_ROLE",
                  message: "Unknown workspace role in session token"
                }
              }
            : authRequiredError()
        );
      }

      const hostTenantEntity = req.tenant;
      if (
        hostTenantEntity?.id &&
        !skipsJwtHostTenantAlignment(req.path, req.method) &&
        hostTenantEntity.id.trim().toLowerCase() !== tenantId.trim().toLowerCase()
      ) {
        this.loggerService.warn("JWT tenant does not match resolved Host tenant", {
          path: req.path,
          method: req.method,
          jwtTenantId: tenantId,
          hostTenantId: hostTenantEntity.id
        });
        throw new ForbiddenException({
          error: {
            code: "TENANT_HOST_TOKEN_MISMATCH",
            message: "Session workspace does not match the request host tenant"
          }
        });
      }

      const skipHostJwtAlignment = skipsJwtHostTenantAlignment(req.path, req.method);
      if (skipHostJwtAlignment) {
        this.requestContextService.enableJwtTenantOverrideHost();
      }

      const hostId = hostTenantEntity?.id?.trim().toLowerCase();
      const jwtId = tenantId.trim().toLowerCase();
      if (!this.requestContextService.tryGetTenantId()) {
        this.requestContextService.setTenantId(tenantId);
        this.requestContextService.setUserId(userId);
      } else if (skipHostJwtAlignment && hostId && hostId !== jwtId) {
        this.requestContextService.setTenantId(tenantId);
        this.requestContextService.setUserId(userId);
      }

      const queryRunner = this.dataSource.createQueryRunner();
      try {
        await queryRunner.connect();

        const result = await verifyActiveMembershipAndHydrateContext({
          userId,
          tenantId,
          jwtRole: role,
          jwtSessionVersion,
          jwtCapsClaim: payload.caps,
          queryRunner,
          requestContextService: this.requestContextService,
          loggerService: this.loggerService
        });

        if (!result.ok) {
          if ("error" in result) {
            throw result.error;
          }
          throw new UnauthorizedException(authRequiredError());
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
