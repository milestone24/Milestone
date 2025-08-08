import { db } from "@server/db";
import { securities } from "@server/db/schema";
import { QueryParams, ResourceQueryBuilder } from "@server/utils/resource-query-builder";
import { SecurityInsert, SecuritySearchResult, SecuritySelect } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

const securitiesQueryBuilder = new ResourceQueryBuilder({
  table: securities,
  allowedSortFields: [
    "createdAt",
    "updatedAt", 
    "symbol",
    "name",
    "exchange",
    "country",
    "currency",
    "type"
  ],
  allowedFilterFields: [
    "exchange",
    "country", 
    "currency",
    "type",
    "symbol"
  ],
  defaultSort: { field: "symbol", direction: "asc" },
  maxLimit: 100,
});

export async function getCachedSecurities(query: QueryParams): Promise<SecuritySelect[]> {
  const { where, orderBy, limit, offset } = securitiesQueryBuilder.buildQuery(query);
  return db.query.securities.findMany({ 
    where,
    orderBy,
    limit,
    offset
  });
}

export async function getCachedSecurity(id: SecuritySelect["id"]): Promise<SecuritySelect> {
  const security = await db.query.securities.findFirst({
    where: eq(securities.id, id)
  });
  if (!security) {
    throw new Error(`Security with ID ${id} not found`);
  }
  return security;
}

export async function findCachedSecurityMatch(security: SecuritySearchResult | string): Promise<SecuritySelect | null> {
  const securityFound = await db.query.securities.findFirst({
    where:
    typeof security === "string" ? eq(securities.symbol, security)
    : and(
      //TODO identify if we need to add more fields to the match
      //Should we use ISIN, CUSIP, FIGI, etc.
      eq(securities.symbol, security.symbol),
      eq(securities.name, security.name),
      eq(securities.exchange, security.exchange ?? ""),
    )
  });
  return securityFound || null;
}

export async function searchCachedSecurities(query: string): Promise<SecuritySelect[]> {
  const searchTerm = `%${query.toLowerCase()}%`;
  
  // Search by symbol (exact match gets priority) and name (partial match)
  const results = await db.query.securities.findMany({
    where: sql`
      LOWER(${securities.symbol}) LIKE ${searchTerm} 
      OR LOWER(${securities.name}) LIKE ${searchTerm}
      OR LOWER(${securities.isin}) LIKE ${searchTerm}
    `,
    orderBy: [
      // Prioritize exact symbol matches
      sql`CASE WHEN LOWER(${securities.symbol}) = ${query.toLowerCase()} THEN 0 ELSE 1 END`,
      // Then symbol starts with
      sql`CASE WHEN LOWER(${securities.symbol}) LIKE ${query.toLowerCase() + '%'} THEN 0 ELSE 1 END`,
      // Then by symbol alphabetically
      securities.symbol
    ],
    limit: 20 // Limit cached results to avoid too many
  });
  
  return results;
}

export async function createOrFindCachedSecurity(data: SecurityInsert): Promise<SecuritySelect> {
  // First try to find existing security by symbol
  const existingSecurity = await findCachedSecurityMatch(data.symbol);
  if (existingSecurity) {
    return existingSecurity;
  }

  // If not found, create new security
  const [insertedSecurity] = await db.insert(securities).values(data).returning();

  if (!insertedSecurity) {
    throw new Error("Failed to create security");
  }

  return insertedSecurity;
}

export async function updateCachedSecurity(id: SecuritySelect["id"], data: SecurityInsert): Promise<SecuritySelect> {
  const [updatedSecurity] = await db.update(securities)
    .set({
      ...data,
    })
    .where(eq(securities.id, id))
    .returning();

  if (!updatedSecurity) {
    throw new Error(`Security with ID ${id} not found`);
  }
  return updatedSecurity;
}

export async function deleteCachedSecurity(id: SecuritySelect["id"]): Promise<boolean> {
  const result = await db.delete(securities)
    .where(eq(securities.id, id));
  return (result?.rowCount ?? 0) > 0;
}