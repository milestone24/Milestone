import { Database } from "@/db";
import { securityTransactions } from "@/db/schema";
import {
  SecurityTransactionOrphanInsert,
  SecurityTransaction,
} from "@shared/schema";

export class DatabaseSecurityService {
  constructor(private db: Database) {}
}
