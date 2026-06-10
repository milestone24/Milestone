import { db } from "@/db";
import { processes, ProcessSelect } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { and } from "drizzle-orm";

async function testJobsMeta() {

  const securityIds = ["123"];

  const metaCondition = or(
    sql`payload->'securityIds' ?| array[${securityIds}]`,
    sql`jsonb_typeof(payload->'securityIds') = 'null'`,
    //sql`payload ? 'securityIds' AND jsonb_typeof(payload->'securityIds') = 'null'`
  )

  let job: ProcessSelect | undefined;

  try {
    [job] = await db.insert(processes).values({
      key: "test",
      status: "pending",
      startedAt: new Date(),
      payload: {
        //securityIds: ["123", "456", "789"],
        securityIds: null,
      },
    }).returning();

    const jobsMatched = await db.query.processes.findMany({
      where: and(
        eq(processes.key, "test"),
        eq(processes.status, "pending"),
        metaCondition
      )
    });

    console.log("Jobs matched", JSON.stringify(jobsMatched, null, 2));

  } catch (error) {
    console.error("Error inserting job", error);
  } finally {
    if (job) {
      await db.delete(processes).where(eq(processes.id, job.id));
    }
  }
}

(async () => {
  await testJobsMeta();
})();