import { authEnv } from "@/lib/env";

/**
 * Client IP for rate limiting, from the header the reverse proxy sets
 * (`TRUSTED_IP_HEADER`, the same one Better Auth uses). Never trust
 * X-Forwarded-For chains: clients can prepend to them.
 */
export function clientIp(request: Request): string {
  const value = request.headers.get(authEnv().TRUSTED_IP_HEADER);
  return value?.split(",")[0]?.trim() || "unknown";
}
