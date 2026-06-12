import { randomUUID } from "crypto";

export const createLedgerGroupId = () => {
  return randomUUID();
};