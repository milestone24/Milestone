import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  pgEnum,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { InferSelectModel, relations, sql } from "drizzle-orm";
import { InferInsertModelBasic, timestampColumns } from "./utils.js";
import { coreUsers, userAccounts } from "./user-account.js";

// API Key type enum
export const apiKeyTypeEnum = pgEnum("api_key_type", ["user", "system"]);

// API Key scope enum - controls what the key can access
export const apiKeyScopeEnum = pgEnum("api_key_scope", [
  "read", // Read-only access
  "write", // Read + write access
  "admin", // Full admin access (system keys only)
  "trigger", // Can only call trigger endpoints
]);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // The actual key (hashed for security)
    keyHash: text("key_hash").notNull().unique(),

    // Key prefix for identification (e.g., "mk_live_", "mk_sys_")
    keyPrefix: text("key_prefix").notNull(),

    // Human-readable name for the key
    name: text("name").notNull(),

    // Key type: "user" or "system"
    type: apiKeyTypeEnum("type").notNull(),

    // Scope determines permissions
    scope: apiKeyScopeEnum("scope").notNull().default("read"),

    // Tenant ID - always required (references coreUsers)
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => coreUsers.id),

    // User Account ID - only for "user" type keys
    userAccountId: uuid("user_account_id").references(() => userAccounts.id),

    // Optional restrictions
    allowedIPs: text("allowed_ips").array(),
    allowedDomains: text("allowed_domains").array(),

    // Rate limiting (requests per minute)
    rateLimit: integer("rate_limit").default(60),

    // Expiration
    expiresAt: timestamp("expires_at"),

    // Status
    isRevoked: boolean("is_revoked").notNull().default(false),
    revokedAt: timestamp("revoked_at"),
    revokedReason: text("revoked_reason"),

    // Usage tracking
    lastUsedAt: timestamp("last_used_at"),
    usageCount: integer("usage_count").default(0),

    ...timestampColumns(),
  },
  (table) => [
    index("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_tenant_id_idx").on(table.tenantId),
    index("api_keys_user_account_id_idx").on(table.userAccountId),
    index("api_keys_type_idx").on(table.type),
  ]
);

export type SelectApiKey = InferSelectModel<typeof apiKeys>;
export type InsertApiKey = InferInsertModelBasic<typeof apiKeys>;

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(coreUsers, {
    fields: [apiKeys.tenantId],
    references: [coreUsers.id],
  }),
  userAccount: one(userAccounts, {
    fields: [apiKeys.userAccountId],
    references: [userAccounts.id],
  }),
}));

// API Key types for use in application code
export type ApiKeyType = "user" | "system";
export type ApiKeyScope = "read" | "write" | "admin" | "trigger";

// Well-known system tenant ID
export const SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000000";
