/// <reference path="../../types/express.d.ts" />
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NestMiddleware,
  NotFoundException
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { ConfigService } from "../../config/config.service";
import { TenantHostResolverService } from "../../modules/tenant/tenant-host-resolver.service";
import { RequestContextService } from "../request-context/request-context.service";
import { isAuthSessionLoginRoute } from "../auth/auth-route-policy";

/**
 * Paths where Host-based tenant lookup must not run (health, docs, public flows).
 * Aligns with {@link TenantMiddleware} bypass list except `/api/v2/auth/*` is NOT skipped here
 * so login routes receive `request.tenant`.
 */
export function shouldBypassTenantResolver(path: string, method: string): boolean {
  return (
    (method === "POST" && /^\/api\/v2\/tours\/[^/]+\/(register|waitlist)$/.test(path)) ||
    (method === "GET" && /^\/api\/v2\/registrations\/[^/]+$/.test(path)) ||
    path.startsWith("/health") ||
    path.startsWith("/internal") ||
    path.startsWith("/api/docs")
  );
}

export function isAuthTenantSessionRoute(path: string, method: string): boolean {
  return isAuthSessionLoginRoute(path, method);
}

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    @Inject(TenantHostResolverService)
    private readonly tenantHostResolver: TenantHostResolverService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      if (shouldBypassTenantResolver(req.path, req.method)) {
        return next();
      }

      const root = this.configService.getTenantRootDomain();
      if (!root) {
        return next();
      }

      const authRoute = isAuthTenantSessionRoute(req.path, req.method);
      const inboundHost = TenantHostResolverService.extractInboundHost(
        req,
        this.configService.getTenantHostTrustModel()
      );

      if (authRoute && !inboundHost) {
        throw new BadRequestException({
          error: {
            code: "TENANT_HOST_INVALID",
            message: "The workspace hostname is missing or invalid"
          }
        });
      }

      if (!inboundHost) {
        return next();
      }

      const outcome = this.tenantHostResolver.parseWorkspaceTenantLabel(inboundHost);

      if (
        outcome.kind === "apex" ||
        outcome.kind === "outside_workspace" ||
        outcome.kind === "no_root_config"
      ) {
        return next();
      }

      if (outcome.kind === "reserved") {
        if (authRoute) {
          throw new ForbiddenException({
            error: {
              code: "TENANT_HOST_RESERVED",
              message: "This hostname is reserved and cannot be used as a workspace"
            }
          });
        }
        return next();
      }

      if (outcome.kind === "invalid_label") {
        if (authRoute) {
          throw new BadRequestException({
            error: {
              code: "TENANT_HOST_INVALID",
              message: "The workspace subdomain in this hostname is not valid"
            }
          });
        }
        return next();
      }

      const tenant = await this.requestContextService.runWithoutTenantBinding(
        "tenant_host_resolution",
        () => this.tenantHostResolver.resolveTenantEntityFromHost(inboundHost)
      );

      if (!tenant) {
        if (authRoute) {
          throw new NotFoundException({
            error: {
              code: "TENANT_HOST_UNKNOWN",
              message: "No workspace matches this host"
            }
          });
        }
        return next();
      }

      req.tenant = tenant;
      this.requestContextService.setHostTenantId(tenant.id);
      return next();
    } catch (err) {
      return next(err);
    }
  }
}
