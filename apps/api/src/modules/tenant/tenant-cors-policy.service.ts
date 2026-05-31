import { Inject, Injectable } from "@nestjs/common";

import { ConfigService } from "../../config/config.service";
import {
  TENANT_INGRESS_REGISTRY_PORT,
  type TenantIngressRegistryPort,
} from "./domain/ports/tenant-ingress-registry.port";

/** Dynamic CORS policy: static env tiers + tenant registry lookup for white-label origins. */
@Injectable()
export class TenantCorsPolicyService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(TENANT_INGRESS_REGISTRY_PORT)
    private readonly ingressRegistry: TenantIngressRegistryPort,
  ) {}

  /**
   * Whether `Origin` may receive credentialed CORS responses.
   * Undefined/empty Origin (non-browser) is allowed.
   */
  async isOriginAllowed(originHeader: string | undefined): Promise<boolean> {
    if (originHeader === undefined || originHeader.trim() === "") {
      return true;
    }

    if (this.configService.isCorsOriginAllowedExplicitWhitelist(originHeader)) {
      return true;
    }

    if (this.configService.isCorsOriginAllowedDevelopmentDefault(originHeader)) {
      return true;
    }

    if (this.configService.isCorsPlatformSuboriginAllowed(originHeader)) {
      return true;
    }

    if (!this.configService.getCorsAllowTenantSuborigins()) {
      return false;
    }

    return this.ingressRegistry.isRegisteredWebOrigin(originHeader.trim());
  }
}
