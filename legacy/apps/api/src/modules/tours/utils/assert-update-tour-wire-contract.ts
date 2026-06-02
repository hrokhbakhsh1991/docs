import { BadRequestException } from "@nestjs/common";
import { instanceToPlain } from "class-transformer";
import { safeParseUpdateTourPatchWireBody } from "@repo/shared-contracts";
import type { ZodIssue } from "zod";

import type { UpdateTourDto } from "../dto/update-tour.dto";

/**
 * Shared Zod wire contract gate for `PATCH /tours/:id` ingress (structural parity with web egress).
 */
export function assertUpdateTourPatchWireContract(dto: UpdateTourDto): void {
  const plain = instanceToPlain(dto) as Record<string, unknown>;
  delete plain.formProfile;
  const parsed = safeParseUpdateTourPatchWireBody(plain);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue: ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new BadRequestException({
      error: {
        code: "TOUR_PATCH_WIRE_CONTRACT",
        message: `Update tour payload failed shared wire contract: ${message}`,
      },
    });
  }
}
