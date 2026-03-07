/**
 * Mock Lambda entrypoint for asset-values update. Used for local or test
 * runs that emulate a distributed worker: awaits the handler to completion
 * then returns. For production Lambda, wire this to the queue trigger.
 */
import { handler } from "./asset-values-distributed-handler";

type Event = {
  assetId: string;
  accountId: string;
  jobId: string;
  startDate?: Date;
};

export const mockLambdaHandler = async (event: Event) => {
  const { assetId, accountId, jobId, startDate } = event;

  await handler({
    assetId,
    accountId,
    jobId,
    startDate,
  });

  return {}; // Will be lambda response object
};
