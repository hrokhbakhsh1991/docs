/** OpenAPI `WaitlistItemResponseDto` */

export type WaitlistItemStatus = "Waiting" | "Converted" | "Cancelled";

export interface WaitlistItemResponseDto {
  id: string;
  tenantId: string;
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: "self_vehicle" | "group_vehicle" | "other";
  entryMode: "telegram" | "web";
  status: WaitlistItemStatus;
  conversionReason?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
}
