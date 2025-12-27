import { Database } from "@server/db";
import { assetSecurities } from "@shared/api/queryKeys";
import { sendNotification } from "../comms/socket";
import { and, eq, or, sql } from "drizzle-orm";
import { UpdateSecuritiesDailyHistoryCacheProcess } from "@shared/schema/process";
import { processes } from "@server/db/schema";
import { handler } from "./securities-cache-distributed-handler";

export class SecuritiesCacheService {
  //TODO consider how to handle the abstraction of Db or
  constructor(
    //TODO maybe use job or process persistence factory instead of db?
    private db: Database
  ) {}

  async updateSecuritiesDailyHistoryCacheForAllSecurities(): Promise<void> {
    //Send notification to all accounts that the securities daily history cache is being updated.
    // sendNotification(accountId, {
    //   type: "notification",
    //   message: "Updating securities daily history cache...",
    // });

    const existingJobs: UpdateSecuritiesDailyHistoryCacheProcess[] =
      ((await this.db.query.processes.findMany({
        where: and(
          eq(processes.key, "update-securities-daily-history-cache"),
          or(eq(processes.status, "running"), eq(processes.status, "pending"))
        ),
      })) as UpdateSecuritiesDailyHistoryCacheProcess[]) ?? [];

    console.log("existingJobs", existingJobs);

    if (existingJobs.length > 0) {
      //Do we need to wait and run again?
      return;
    }

    const [job] = await this.db
      .insert(processes)
      .values({
        key: "update-securities-daily-history-cache",
        status: "running",
        startedAt: new Date(),
        payload: {
          date: new Date(),
        },
      })
      .returning();

    if (!job) {
      throw new Error("Failed to create job");
    }

    const distributed = process.env.DISTRIBUTED === "true";

    if (distributed) {
      // mockLambdaHandler({
      //   jobId: job.id,
      // });
    } else {
      handler({ jobId: job.id }).catch((error) => {
        console.error("Error updating securities daily history cache", error);
      });
    }
  }
}
