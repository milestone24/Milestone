import { eq } from "drizzle-orm";
import { fireSettings, InsertFireSettings } from "@server/db/schema/portfolio-fire";
import { createDecimalValueString, FireSettings, FireSettingsInsert, UserAccount } from "@shared/schema";
import { type Database } from "../../db/index";

export class DatabaseFireSettingsService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async get(id: FireSettings["id"]): Promise<FireSettings | undefined> {
    return this.db.query.fireSettings.findFirst({
      where: eq(fireSettings.id, id),
    });
  }

  async getByUserAccountId(userAccountId: UserAccount["id"]): Promise<FireSettings | undefined> {
    return this.db.query.fireSettings.findFirst({
      where: eq(fireSettings.userAccountId, userAccountId),
    });
  }

  async create(data: FireSettingsInsert): Promise<FireSettings> {
    const [settings] = await this.db.insert(fireSettings).values({
      ...data,
      //Temporarily satisfy the type whilst we remove monthlyInvestment from the settings.
      monthlyInvestment: createDecimalValueString("0"),
    }).returning();

    if (!settings) {
      throw new Error("Failed to create FIRE settings");
    }

    return settings;
  }

  async update(id: FireSettings["id"], data: Partial<InsertFireSettings>): Promise<FireSettings> {
    const [settings] = await this.db
      .update(fireSettings)
      .set(data)
      .where(eq(fireSettings.id, id))
      .returning();

    if (!settings) {
      throw new Error("FIRE settings not found");
    }

    return settings;
  }

  async delete(id: FireSettings["id"]): Promise<boolean> {
    const [deleted] = await this.db
      .delete(fireSettings)
      .where(eq(fireSettings.id, id))
      .returning();

    return !!deleted;
  }

  async updateByUserAccountId(userAccountId: UserAccount["id"], data: Partial<InsertFireSettings>): Promise<FireSettings> {
    const [settings] = await this.db
      .update(fireSettings)
      .set(data)
      .where(eq(fireSettings.userAccountId, userAccountId))
      .returning();

    if (!settings) {
      throw new Error("FIRE settings not found");
    }

    return settings;
  }
} 
