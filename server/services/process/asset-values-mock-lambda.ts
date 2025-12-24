import { handler } from "./asset-values-distributed-handler";

type Event = {
  assetId: string;
  accountId: string;
  jobId: string;
  startDate?: Date;
};

export const mockLambdaHandler = async (event: Event) => {
  const { assetId, accountId, jobId, startDate } = event;

  await new Promise(async (resolve, reject) => {
    const updater = await handler({
      assetId,
      accountId,
      jobId,
      startDate,
    });

    updater.once("exited", async () => {
      resolve(void 0);
    });
  });

  return {}; //Will be lambda response object
};
