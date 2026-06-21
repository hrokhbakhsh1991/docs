import { PlatformDomainRepository } from "./platform-domain.repository.ts";

export async function countExpiringDomainSslWithinDays(days: number): Promise<number> {
  const repository = new PlatformDomainRepository();
  return repository.countExpiringWithinDays(days);
}

export async function listExpiringDomainSslHostnames(days: number): Promise<string[]> {
  const repository = new PlatformDomainRepository();
  return repository.listExpiringWithinDays(days);
}
