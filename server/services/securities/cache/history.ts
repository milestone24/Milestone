import { db } from "@server/db"
import {
  securityDailyHistory,
  SecurityDailyHistoryWithSecurity,
} from "@server/db/schema";
import { SecurityDailyHistorySelect } from "@shared/schema/securities";
import { eq, gte, lte } from "drizzle-orm";
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
        },
      },
    },
  });

  return data as SecurityDailyHistoryWithSecurity[];
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