import { Database } from "@server/db";
import { securityTransactions } from "@server/db/schema";
import {
  SecurityTransactionOrphanInsert,
  SecurityTransaction,
} from "@shared/schema";

export class DatabaseSecurityService {
  constructor(private db: Database) {}
}
