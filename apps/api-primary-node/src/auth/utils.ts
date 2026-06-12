import { Tenant } from "./types";

/**
 * Wrapper function that ensures a tenant exists before executing the given function
 * @param fn The async function to execute if tenant exists
 */
export const requireTenant = async <T>(tenant: Tenant | undefined, fn: (tenant: Tenant & { id: string }) => Promise<T>) => {
  if (!tenant || !tenant.id) {
    throw new Error("Tenant not found on request");
  }
  return await fn(tenant);
};

export const requireTenantWithUserAccountId = async <T>(tenant: Tenant | undefined, fn: (tenant: Tenant & { id: string, userAccountId: string }) => Promise<T>) => {

  return requireTenant(tenant, async (tenant) => {

    if(!tenant.userAccountId) {
      throw new Error("User account ID not found on tenant");
    }

    // Cast to the expected type after runtime check
    return await fn(tenant as Tenant & { id: string, userAccountId: string });

  });
};
