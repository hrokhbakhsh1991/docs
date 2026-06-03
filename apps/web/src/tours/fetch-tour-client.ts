import type {
  CreateTourPayload,
  TourAuthHeaders,
  TourClient,
  TourClientError,
  TourRecordDto,
} from "@app-tour/workspace-sdk";

function parseErrorBody(body: unknown): { code: string; message: string } {
  if (body !== null && typeof body === "object" && "error" in body) {
    const code = String((body as { error?: unknown }).error ?? "unknown_error");
    return { code, message: code };
  }
  return { code: "unknown_error", message: "unknown_error" };
}

export class FetchTourClient implements TourClient {
  constructor(private readonly baseUrl: string) {}

  async createTour(payload: CreateTourPayload, auth: TourAuthHeaders): Promise<TourRecordDto> {
    const res = await fetch(`${this.baseUrl}/tours`, {
      method: "POST",
      headers: {
        ...auth,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const parsed = parseErrorBody(body);
      const err: TourClientError = {
        status: res.status,
        code: parsed.code,
        message: parsed.message,
      };
      throw err;
    }
    return body as TourRecordDto;
  }

  async getTour(id: string, auth: TourAuthHeaders): Promise<TourRecordDto | null> {
    const res = await fetch(`${this.baseUrl}/tours/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: auth,
    });
    if (res.status === 404) {
      return null;
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const parsed = parseErrorBody(body);
      const err: TourClientError = {
        status: res.status,
        code: parsed.code,
        message: parsed.message,
      };
      throw err;
    }
    return body as TourRecordDto;
  }
}
