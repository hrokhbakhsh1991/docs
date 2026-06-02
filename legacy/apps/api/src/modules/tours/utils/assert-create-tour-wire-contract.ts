import { BadRequestException } from "@nestjs/common";
import { instanceToPlain } from "class-transformer";
import { safeParseCreateTourPostWireBody } from "@repo/shared-contracts";

import type { CreateTourDto } from "../dto/create-tour.dto";

/**
 * Shared Zod wire contract gate for `POST /tours` ingress (structural parity with web egress).
 */
export function assertCreateTourPostWireContract(dto: CreateTourDto): void {
  const plain = instanceToPlain(dto) as Record<string, unknown>;
  delete plain.formProfile;
  const parsed = safeParseCreateTourPostWireBody(plain);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new BadRequestException({
      error: {
        code: "TOUR_CREATE_WIRE_CONTRACT",
        message: `Create tour payload failed shared wire contract: ${message}`,
      },
    });
  }
}
