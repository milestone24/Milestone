import { db } from "@server/db"
import {
  securityDailyHistory,
  SecurityDailyHistoryWithSecurity,
} from "@server/db/schema";
import { SecurityDailyHistorySelect } from "@shared/schema/securities";
import { eq, gte, lt, lte } from "drizzle-orm";
import { and } from "drizzle-orm";

//const getSecurityHistoryForDateRange = async (identifier: SecurityIdentifier, startDate: Date, endDate: Date): Promise<SecurityHistory[]> => {
export const getSecurityHistoryForDateRange = async (
  securityId: string,
  startDate: Date,
  endDate: Date
): Promise<SecurityDailyHistoryWithSecurity[]> => {
  // console.log(
  //   "GETTING SECURITY HISTORY FOR DATE RANGE",
  //   securityId,
  //   startDate,
  //   endDate
  // );

  const data = await db.query.securityDailyHistory.findMany({
    where: and(
      eq(securityDailyHistory.securityId, securityId),
      gte(securityDailyHistory.date, startDate.toISOString().split("T")[0]!),
      lte(securityDailyHistory.date, endDate.toISOString().split("T")[0]!)
    ),
    with: {
      security: {
        columns: {
          name: true,
          symbol: true,
          exchange: true,
        },
      },
    },
  });

  return data as SecurityDailyHistoryWithSecurity[];
};

/**
 * Returns the most recent history row for each security that has any data before `beforeDate`.
 * Used to seed the carry-forward / lookback state before a calculation run so that chunk
 * boundaries never produce a gap when the market was closed on the first day of a chunk.
 */
export const getLastKnownSecurityPricesBeforeDate = async (
  securityIds: string[],
  beforeDate: Date
): Promise<Map<string, SecurityDailyHistoryWithSecurity>> => {
  const result = new Map<string, SecurityDailyHistoryWithSecurity>();
  const beforeDateStr = beforeDate.toISOString().split("T")[0]!;

  await Promise.all(
    securityIds.map(async (securityId) => {
      const row = await db.query.securityDailyHistory.findFirst({
        where: and(
          eq(securityDailyHistory.securityId, securityId),
          lt(securityDailyHistory.date, beforeDateStr)
        ),
        orderBy: (t, { desc }) => [desc(t.date)],
        with: {
          security: {
            columns: {
              name: true,
              symbol: true,
              exchange: true,
            },
          },
        },
      });
      if (row) {
        result.set(securityId, row as SecurityDailyHistoryWithSecurity);
      }
    })
  );

  return result;
};

export const getSecurityHistoryForDate = async (securityId: string, date: Date): Promise<SecurityDailyHistorySelect> => {
  const data = await db.query.securityDailyHistory.findFirst({
    where: and(
      eq(securityDailyHistory.securityId, securityId),
      eq(securityDailyHistory.date, date.toISOString().split('T')[0]!)
    )
  })

  if(!data) {
    throw new Error("No security history found")
  }

  return data
}