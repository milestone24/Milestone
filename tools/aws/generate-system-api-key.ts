/**
 * Generate a system API key for EventBridge triggers
 * 
 * This script:
 * 1. Ensures the system tenant exists
 * 2. Creates a new system API key with "trigger" scope
 * 3. Outputs the key to stdout (for capture by shell script)
 * 
 * Usage: npx tsx tools/aws/generate-system-api-key.ts
 */

import { db } from "@api/db";
import { coreUsers } from "@api/db/schema/user-account";
import { SYSTEM_TENANT_ID } from "@api/db/schema/api-keys";
import { apiKeyService } from "@api/services/api-keys";
import { eq } from "drizzle-orm";

async function main() {
  try {
    // Ensure system tenant exists
    const [existingTenant] = await db
      .select()
      .from(coreUsers)
      .where(eq(coreUsers.id, SYSTEM_TENANT_ID));

    if (!existingTenant) {
      // Create system tenant
      await db.insert(coreUsers).values({
        id: SYSTEM_TENANT_ID,
        status: "active",
      });
      console.error("Created system tenant");
    }

    // Generate system API key
    const result = await apiKeyService.createSystemKey({
      name: "EventBridge Securities Cache Trigger",
      scope: "trigger",
    });

    // Output only the key to stdout (for shell script capture)
    console.log(result.key);

    process.exit(0);
  } catch (error) {
    console.error("Error generating system API key:", error);
    process.exit(1);
  }
}

main();

