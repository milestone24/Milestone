import { SecurityIdentifier } from "../types";
import { getSecurityHistoryForDateRange as getSecurityHistoryForDateRangeFromCache } from "../cache/history"
import { getSecurityHistoryForDateRange as getSecurityHistoryForDateRangeFromGateway } from "../gateway"
import { db } from "@server/db";
import { eq } from "drizzle-orm";
import { securities } from "@server/db/schema";
import { addDays } from "date-fns";

export const getSecurityHistoryForIdentifierForDateRange = async (identifier: SecurityIdentifier, startDate: Date, endDate: Date): Promise<SecurityHistory[]> => {

  const security = await db.query.securities.findFirst({
    where: eq(securities.symbol, identifier.symbol)
  })

  if (!security) {
    throw new Error("Security not found")
  }

  //If security not found do we create it here?

  const cachedHistory = await getSecurityHistoryForDateRangeFromCache(security.id, startDate, endDate)

  //if no 

  //We have checked for zero length above, so we know there is at least one item
  const fillStartDate = cachedHistory.length > 0 ? addDays(cachedHistory.at(-1)!.date, 1) : startDate 

  const historyFill = await getSecurityHistoryForDateRangeFromGateway(identifier, new Date(fillStartDate), endDate)

  return [...cachedHistory, ...historyFill]


  //1) Get cached history
  //2) Find last date of cached history and the difference between that and the end date
  //3) obtain remainder days from gateway

}
  