import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { brokerPlatforms } from "./portfolio-assets.js";
import { timestampColumns } from "./utils.js";

/**
 * Optional natural-language hints for the securities extraction LLM (phase 4a),
 * keyed to the **resolved** broker platform (`brandDbMatch.matchedBrokerPlatformId`).
 * Does not affect stored OCR pipeline JSON shape — only prompt augmentation.
 */
export const brokerPlatformSecuritiesOcrContextInstructions = pgTable(
  "broker_platform_securities_ocr_context_instructions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    brokerPlatformId: uuid("broker_platform_id")
      .notNull()
      .references(() => brokerPlatforms.id, { onDelete: "cascade" }),
    instructionText: text("instruction_text").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestampColumns(),
  },
  (t) => [
    index("bp_securities_ocr_ctx_instr_platform_idx").on(t.brokerPlatformId),
  ],
);
