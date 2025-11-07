import { Database } from "@server/db";
import {
  assetValues,
  fireSettings,
  milestones,
  recurringContributions,
  userAssets,
  userProfiles,
} from "@server/db/schema";
import {
  FireProjection,
  FIREProjectionConfig,
  MilestoneTarget,
  ProjectionConfigWithDateRange,
  ProjectionDataSource,
  ProjectionResult,
  RecurringContribution,
  ResolvedUserAsset,
  UserAssetWithValue,
  ProjectionConfig,
} from "@shared/schema";
import {
  projectPortfolio as hybridProjectPortfolio,
  projectAsset as hybridProjectAssetById,
} from "@shared/utils/projection-orchestrator";
import {
  checkMilestoneProgress as hybridCheckMilestoneProgress,
  getAllMilestonesWithProgress as hybridGetAllMilestonesWithProgress,
} from "@shared/utils/projection-milestone-tracker";
import {
  projectToRetirement as hybridProjectToRetirement,
  projectRetirementWithAccountAssets as hybridCheckFIREFeasibility,
} from "@shared/utils/projection-fire-calculator";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import {
  calculatedAssetsQueryBuilder,
  calculatedAssetsWithContributionsQueryBuilder,
} from "../assets/query";
import { mapAssetsToContributors } from "@shared/utils/projection-utils";

export type AssetWithRecurringContributions = UserAssetWithValue & {
  recurringContributions: RecurringContribution[];
};

export const mapAssetsWithRecurringContributions = (
  rows: {
    asset: UserAssetWithValue;
    recurringContribution: RecurringContribution | null;
  }[]
): AssetWithRecurringContributions[] => {
  return rows.reduce<AssetWithRecurringContributions[]>((acc, row) => {
    const existingAsset = acc.find((a) => a.id === row.asset.id);
    if (existingAsset) {
      if (row.recurringContribution) {
        existingAsset.recurringContributions.push(row.recurringContribution);
      }
    } else {
      acc.push({
        ...row.asset,
        recurringContributions: row.recurringContribution
          ? [row.recurringContribution]
          : [],
      });
    }

    return acc;
  }, []);
};

//Maybe tables could be injected here for use of materialised views
const defineDataSource = (
  db: Database,
  accountId: string
): ProjectionDataSource => {
  const assetsQuery = calculatedAssetsWithContributionsQueryBuilder(db).where(
    eq(userAssets.userAccountId, accountId)
  );

  const assetQuery = (assetId: string) =>
    calculatedAssetsWithContributionsQueryBuilder(db).where(
      and(eq(userAssets.id, assetId), eq(userAssets.userAccountId, accountId))
    );

  const recurringContrbutionsForAssetsQuery = (assetIds: string[]) =>
    db.query.recurringContributions.findMany({
      where: and(inArray(recurringContributions.assetId, assetIds)),
    });

  const milestonesQuery = () =>
    db.query.milestones.findMany({
      where: eq(milestones.userAccountId, accountId),
    });

  const milestoneQuery = (milestoneId: string) =>
    db.query.milestones.findFirst({
      where: and(
        eq(milestones.id, milestoneId),
        eq(milestones.userAccountId, accountId)
      ),
    });

  const fireSettingsQuery = () =>
    db.query.fireSettings.findFirst({
      where: eq(fireSettings.userAccountId, accountId),
    });

  const userProfileQuery = () =>
    db.query.userProfiles.findFirst({
      where: eq(userProfiles.userAccountId, accountId),
    });

  //const asset = (assetId: string) => assetQuery(assetId).execute();

  return {
    getAssets: () =>
      assetsQuery.execute().then(mapAssetsWithRecurringContributions),
    getAssetById: (assetId) =>
      assetQuery(assetId)
        .execute()
        .then(mapAssetsWithRecurringContributions)
        .then((assets) => assets.find((a) => a.id === assetId) ?? null),
    getContributionsForAssets: (assetIds) =>
      recurringContrbutionsForAssetsQuery(assetIds).execute(),
    getMilestones: () => milestonesQuery().execute(),
    getMilestoneById: (milestoneId) =>
      milestoneQuery(milestoneId)
        .execute()
        .then((milestone) => milestone ?? null),
    getFireSettings: () =>
      fireSettingsQuery()
        .execute()
        .then((fireSettings) => fireSettings ?? null),
    getUserProfile: () =>
      userProfileQuery()
        .execute()
        .then((userProfile) => userProfile ?? null),
  };
};

export class ProjectionService {
  constructor(private db: Database) {}

  async projectPortfolio(
    accountId: string,
    config: ProjectionConfigWithDateRange,
    milestoneTarget?: MilestoneTarget
  ): Promise<ProjectionResult> {
    const dataSource = defineDataSource(this.db, accountId);
    const assets = await dataSource.getAssets();
    const contributors = mapAssetsToContributors(assets);
    return hybridProjectPortfolio(
      config,
      dataSource,
      contributors,
      milestoneTarget
    );
    //return hybridProjectPortfolio(config, dataSource, milestoneTarget);
  }

  async projectAssetById(
    accountId: string,
    assetId: string,
    //recurringContributions: RecurringContribution[],
    //accountId: string,
    config: ProjectionConfigWithDateRange
  ) {
    const dataSource = defineDataSource(this.db, accountId);
    return hybridProjectAssetById(assetId, config, dataSource);
  }

  async projectToRetirement(
    accountId: string,
    fireConfig: FIREProjectionConfig,
    config: ProjectionConfigWithDateRange
  ) {
    const dataSource = defineDataSource(this.db, accountId);
    const assets = await dataSource.getAssets();
    const contributors = mapAssetsToContributors(assets);
    return hybridProjectToRetirement(fireConfig, config, contributors);
    //return hybridProjectToRetirement(fireConfig, config, dataSource);
  }

  async checkMilestoneProgress(
    accountId: string,
    milestoneId: string,
    config: ProjectionConfigWithDateRange
  ) {
    const dataSource = defineDataSource(this.db, accountId);

    const milestone = await dataSource.getMilestoneById(milestoneId);

    const assets = await dataSource.getAssets();
    const contributors = mapAssetsToContributors(assets);

    if (!milestone) {
      throw new Error("Milestone not found");
    }

    const milestoneTarget: MilestoneTarget = {
      milestoneId: milestone.id,
      milestoneName: milestone.name,
      targetValue: milestone.targetValue,
      targetDate: config.endDate, // Use projection end date as target
      accountType: milestone.accountType,
    };

    return hybridCheckMilestoneProgress(milestoneTarget, config, contributors);
  }

  async getAllMilestonesWithProgress(
    accountId: string,
    config: ProjectionConfigWithDateRange
  ) {
    const dataSource = defineDataSource(this.db, accountId);
    return hybridGetAllMilestonesWithProgress(config, dataSource);
  }

  async checkFIREFeasibility(
    accountId: string,
    config: ProjectionConfig
    //Should this be passed through?
    //fireConfig: FIREProjectionConfig
  ): Promise<FireProjection> {
    const dataSource = defineDataSource(this.db, accountId);
    return hybridCheckFIREFeasibility(config, dataSource);
  }
}
