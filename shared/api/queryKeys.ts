/**
 * These are the route query keys.
 * In each use site of these additional params maybe be applied.
 * ie "startDate" and "endDate"
 * or for asset query keys "assetId"
 */

export const portfolioGraphValues = ["portfolio", "history", "values", "graph"];
export const portfolioGraphTransactions = [
  "portfolio",
  "history",
  "transactions",
  "graph",
];
export const portfolioOverview = ["portfolio", "overview"];
export const portfolioAssets = ["portfolio", "assets"];
export const assetGraphValues = ["asset", "history", "values", "graph"];
export const assetGraphTransactions = [
  "asset",
  "history",
  "transactions",
  "graph",
];
export const assetSecurities = ["asset", "securities"];
export const assetSecuritiesTransactions = [
  "asset",
  "securities",
  "transactions",
];
export const processes = ["processes"];

// Projection query keys
export const assetProjection = ["projections", "asset"];
export const portfolioProjection = ["projections", "portfolio"];
export const milestoneProjection = ["projections", "milestone"];
export const milestonesProjection = ["projections", "milestones"];
export const fireProjection = ["projections", "fire"];
export const fireCustomProjection = ["projections", "fire", "custom"];
