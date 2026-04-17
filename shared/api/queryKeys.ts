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
export const portfolioValue = ["portfolio", "value"];
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
export const asset = ["asset"];
export const processes = ["processes"];

// Fire settings query keys
export const fireSettings = ["fire-settings"];

// Projection query keys
export const assetProjection = ["projections", "asset"];
export const assetValues = ["asset", "history", "values"];
export const portfolioProjection = ["projections", "portfolio"];
export const milestoneProjection = ["projections", "milestone"];
export const milestonesProjection = ["projections", "milestones"];
export const fireProjection = ["projections", "fire"];
export const fireCustomProjection = ["projections", "fire", "custom"];


export const documents = ["documents"];

export const ocrJobsList = ["ocr-jobs"] as const;

export function ocrJobDetailKey(ocrJobId: string) {
  return [...ocrJobsList, ocrJobId] as const;
}

/** Document inbound email inboxes (SES rail); list/detail for settings UI. */
export const emailIngestInboxes = ["email-ingest-inboxes"] as const;

export function emailIngestInboxDetailKey(inboxId: string) {
  return [...emailIngestInboxes, inboxId] as const;
}

/** Pending statement OCR reviews for an asset (`user_assets.id` nominee). */
export const assetOcrPendingReview = ["asset", "ocr-pending-review"] as const;
