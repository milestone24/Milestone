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
