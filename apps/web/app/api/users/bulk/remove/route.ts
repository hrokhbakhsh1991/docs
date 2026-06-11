import { proxyBulkUsersRequest } from "../proxy-bulk-users-request";

export async function POST(req: Request): Promise<Response> {
  return proxyBulkUsersRequest(req, "/users/bulk/remove", "POST");
}
