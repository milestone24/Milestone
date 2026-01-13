import { Database, db, Schema } from "@server/db";

type DBContext = {
  db: Database;
  schema: Schema;
};

async function setupOne(context: DBContext): Promise<void> {
  const { db, schema } = context;
  await db.insert(schema.brokerPlatforms).values({
    id: "1",
    name: "Broker Platform 1",
    supportedAccountTypes: ["ISA", "SIPP", "LISA", "GIA"],
    supportsAPIKey: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [coreUser] = await db
    .insert(schema.coreUsers)
    .values({
      id: "1",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!coreUser) {
    throw new Error("Failed to create core user");
  }
  await db.insert(schema.userAccounts).values({
    id: "1",
    email: "gary@milestone.com",
    passwordHash: "password",
    fullName: "Gary",
    isEmailVerified: true,
    isPhoneVerified: false,
    coreUserId: coreUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export { setupOne };
