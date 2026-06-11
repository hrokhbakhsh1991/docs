import { proxyBulkUsersRequest } from "../proxy-bulk-users-request";

export async function PATCH(req: Request): Promise<Response> {
  return proxyBulkUsersRequest(req, "/users/bulk/suspend", "PATCH");
}
