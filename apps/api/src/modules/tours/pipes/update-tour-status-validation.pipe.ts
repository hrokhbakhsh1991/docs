import { Injectable, PipeTransform, UnprocessableEntityException } from "@nestjs/common";
import { z } from "zod";

import { TourLifecycleStatus } from "../entities/tour.entity";

const updateTourStatusSchema = z
  .object({
    lifecycle_status: z.nativeEnum(TourLifecycleStatus),
  })
  .strict();

export type UpdateTourStatusPayload = z.infer<typeof updateTourStatusSchema>;

@Injectable()
export class UpdateTourStatusValidationPipe
  implements PipeTransform<unknown, UpdateTourStatusPayload>
{
  transform(value: unknown): UpdateTourStatusPayload {
    const parsed = updateTourStatusSchema.safeParse(value);
    if (parsed.success) {
      return parsed.data;
    }

    const fields = parsed.error.issues.map((issue) => ({
      code: "VALIDATION_FIELD_FORMAT_INVALID",
      path: issue.path.join(".") || "body",
      message: issue.message,
    }));

    throw new UnprocessableEntityException({
      error: {
        code: "VALIDATION_FAILED",
        message: "Request payload is invalid for updateTourStatus.",
        details: {
          validationErrors: fields,
        },
      },
    });
  }
}
