import { UnprocessableEntityException } from "@nestjs/common";

export type TemplateCanonicalDataCorruptionDetails = {
  templateId: string;
  workspaceId: string;
  issues: readonly { path: string; message: string }[];
};

export class DataCorruptionError extends UnprocessableEntityException {
  constructor(details: TemplateCanonicalDataCorruptionDetails) {
    super({
      error: {
        code: "TEMPLATE_CANONICAL_DATA_CORRUPT",
        message: "Stored workspace tour wizard template canonical_data is invalid",
        retryability: "NO_RETRY",
        details,
      },
    });
  }
}
