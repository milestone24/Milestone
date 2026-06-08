import { and, count, eq } from "drizzle-orm";
import { db } from "@server/db";
import {
  brokerPlatforms,
  securities,
  userAssetSecurities,
  userAssets,
} from "@server/db/schema";
import type {
  StatementPlatformBrandCandidate,
  StatementPlatformBrandDbMatch,
  StatementPlatformBrandIdentification,
  StatementPlatformBrandMatchKind,
} from "@shared/schema/platform-brand-ocr";
import {
  ocrAssetCandidateResultSchema,
  type OcrAssetCandidateResult,
  type SecurityTransactionOcrExtractionRow,
} from "@shared/schema/ocr";
import type { OcrPipelineVerboseLog } from "./transaction-ocr-orchestrator";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseConfiguredBrokerPlatformId(
  platformKey: string
): string | undefined {
  if (platformKey === "unknown") return undefined;
  if (!UUID_RE.test(platformKey)) {
    throw new Error(
      `Invalid platformKey: expected "unknown" or broker platform UUID, got "${platformKey}"`
    );
  }
  return platformKey;
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}

function fuzzyRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - levenshtein(a, b) / maxLen;
}

type PlatformRow = { id: string; name: string };

function classifyNameMatch(
  candidateNorm: string,
  platformNorm: string,
  platformName: string
): { kind: StatementPlatformBrandMatchKind; score?: number } | null {
  if (candidateNorm === platformNorm) {
    return candidateNorm === platformName.toLowerCase().trim()
      ? { kind: "exact" }
      : { kind: "normalized" };
  }
  const ratio = fuzzyRatio(candidateNorm, platformNorm);
  if (ratio >= 0.88) return { kind: "fuzzy", score: ratio };
  if (
    candidateNorm.length >= 5 &&
    platformNorm.length >= 5 &&
    (candidateNorm.includes(platformNorm) || platformNorm.includes(candidateNorm))
  ) {
    return { kind: "fuzzy", score: 0.86 };
  }
  return null;
}

function scoreCandidateAgainstPlatforms(
  candidate: StatementPlatformBrandCandidate,
  platforms: PlatformRow[]
): {
  platform: PlatformRow;
  kind: StatementPlatformBrandMatchKind;
  score?: number;
}[] {
  const cNorm = normalizeLabel(candidate.name);
  const hits: {
    platform: PlatformRow;
    kind: StatementPlatformBrandMatchKind;
    score?: number;
  }[] = [];
  for (const p of platforms) {
    const pNorm = normalizeLabel(p.name);
    const m = classifyNameMatch(cNorm, pNorm, p.name);
    if (m) hits.push({ platform: p, kind: m.kind, score: m.score });
  }
  hits.sort((a, b) => (b.score ?? 1) - (a.score ?? 1));
  return hits;
}

function sortBrandCandidates(
  candidates: StatementPlatformBrandCandidate[]
): StatementPlatformBrandCandidate[] {
  return [...candidates].sort((a, b) => {
    const ra = a.rank ?? 999;
    const rb = b.rank ?? 999;
    if (ra !== rb) return ra - rb;
    return b.confidence - a.confidence;
  });
}

/**
 * Steps 3b and 3c: resolve AI brand candidates to `broker_platforms` and optional upload-time platform id.
 */
export async function verifyStatementPlatformBrand(params: {
  identification: StatementPlatformBrandIdentification;
  configuredBrokerPlatformId?: string;
  /** When set, checked after DB reads so shutdown can preempt CPU-bound matching. */
  abortSignal?: AbortSignal;
}): Promise<StatementPlatformBrandDbMatch> {
  const { identification, configuredBrokerPlatformId, abortSignal } = params;
  const platforms = await db
    .select({ id: brokerPlatforms.id, name: brokerPlatforms.name })
    .from(brokerPlatforms);

  abortSignal?.throwIfAborted();

  const ordered = sortBrandCandidates(identification.candidates);

  let bestHit: {
    platform: PlatformRow;
    kind: StatementPlatformBrandMatchKind;
    score?: number;
  } | null = null;

  for (const cand of ordered) {
    const hits = scoreCandidateAgainstPlatforms(cand, platforms);
    if (hits.length === 0) continue;
    const top = hits[0]!;
    const second = hits[1];
    const topScore = top.score ?? (top.kind === "exact" || top.kind === "normalized" ? 1 : 0.85);
    const secondScore = second
      ? second.score ?? (second.kind === "exact" || second.kind === "normalized" ? 1 : 0.85)
      : 0;
    if (second && Math.abs(topScore - secondScore) < 0.02) {
      return buildDbMatchFailure({
        configuredBrokerPlatformId,
        rejectReason: "ambiguous_match",
        matchedBrokerPlatformId: null,
        matchKind: "none",
      });
    }
    bestHit = top;
    break;
  }

  if (!bestHit) {
    return buildDbMatchFailure({
      configuredBrokerPlatformId,
      rejectReason: "no_database_match",
      matchedBrokerPlatformId: null,
      matchKind: "none",
    });
  }

  const { platform, kind, score } = bestHit;

  if (configuredBrokerPlatformId === undefined) {
    return {
      matchedBrokerPlatformId: platform.id,
      matchKind: kind,
      fuzzyScore: score,
      ok: true,
    };
  }

  const matchesConfiguredPlatform = platform.id === configuredBrokerPlatformId;
  if (matchesConfiguredPlatform) {
    return {
      matchedBrokerPlatformId: platform.id,
      matchKind: kind,
      fuzzyScore: score,
      configuredBrokerPlatformId,
      matchesConfiguredPlatform: true,
      ok: true,
    };
  }

  return {
    matchedBrokerPlatformId: platform.id,
    matchKind: kind,
    fuzzyScore: score,
    configuredBrokerPlatformId,
    matchesConfiguredPlatform: false,
    ok: false,
    rejectReason: "config_platform_mismatch",
  };
}

function buildDbMatchFailure(params: {
  configuredBrokerPlatformId?: string;
  rejectReason: "no_database_match" | "ambiguous_match";
  matchedBrokerPlatformId: null;
  matchKind: "none";
}): StatementPlatformBrandDbMatch {
  const { configuredBrokerPlatformId, rejectReason, matchedBrokerPlatformId, matchKind } =
    params;
  if (configuredBrokerPlatformId === undefined) {
    return {
      matchedBrokerPlatformId,
      matchKind,
      ok: false,
      rejectReason,
    };
  }
  return {
    matchedBrokerPlatformId,
    matchKind,
    configuredBrokerPlatformId,
    matchesConfiguredPlatform: false,
    ok: false,
    rejectReason,
  };
}

function normSymbol(s: string): string {
  return s.trim().toUpperCase();
}

type HoldingIdentity = { symbol: string; isin: string | null; name: string };

/** Mirrors {@link rowMatchesUserSecurity} checks for verbose diagnostics (keep in sync). */
function scoreOcrRowAgainstHolding(
  row: SecurityTransactionOcrExtractionRow,
  holding: HoldingIdentity
): {
  symbolExactMatch: boolean;
  isinExactMatch: boolean;
  nameNormalizedEqual: boolean;
  nameFuzzyRatio: number;
  matched: boolean;
} {
  const rowSym = row.symbol?.trim();
  const rowIsin = row.isin?.trim();
  const rowName = row.name?.trim();
  const symbolExactMatch =
    !!rowSym && normSymbol(rowSym) === normSymbol(holding.symbol);
  const isinExactMatch =
    !!rowIsin &&
    !!holding.isin &&
    rowIsin.toUpperCase() === holding.isin.toUpperCase();
  const rn = normalizeLabel(rowName ?? "");
  const hn = normalizeLabel(holding.name);
  const nameNormalizedEqual = !!rowName && rn === hn;
  const nameFuzzyRatio = fuzzyRatio(rn, hn);
  const matched =
    symbolExactMatch ||
    isinExactMatch ||
    nameNormalizedEqual ||
    nameFuzzyRatio >= 0.92;
  return {
    symbolExactMatch,
    isinExactMatch,
    nameNormalizedEqual,
    nameFuzzyRatio,
    matched,
  };
}

function rowMatchesUserSecurity(
  row: SecurityTransactionOcrExtractionRow,
  holding: HoldingIdentity
): boolean {
  return scoreOcrRowAgainstHolding(row, holding).matched;
}

type AssetHoldingRow = {
  userAssetSecurityId: string;
  symbol: string;
  isin: string | null;
  name: string;
};

type AssetWithHoldings = {
  userAssetId: string;
  assetName: string;
  platformId: string | null;
  holdings: AssetHoldingRow[];
};

function groupHoldingsByAsset(
  flat: Array<{
    userAssetId: string;
    assetName: string;
    platformId: string | null;
    userAssetSecurityId: string;
    symbol: string;
    isin: string | null;
    securityName: string;
  }>
): AssetWithHoldings[] {
  const byAsset = new Map<string, AssetWithHoldings>();
  for (const r of flat) {
    let entry = byAsset.get(r.userAssetId);
    if (!entry) {
      entry = {
        userAssetId: r.userAssetId,
        assetName: r.assetName,
        platformId: r.platformId,
        holdings: [],
      };
      byAsset.set(r.userAssetId, entry);
    }
    entry.holdings.push({
      userAssetSecurityId: r.userAssetSecurityId,
      symbol: r.symbol,
      isin: r.isin,
      name: r.securityName,
    });
  }
  return [...byAsset.values()];
}

function pickFirstMatchingUserAssetSecurityId(
  row: SecurityTransactionOcrExtractionRow,
  holdings: AssetHoldingRow[]
): string | null {
  for (const h of holdings) {
    const identity: HoldingIdentity = {
      symbol: h.symbol,
      isin: h.isin,
      name: h.name,
    };
    if (rowMatchesUserSecurity(row, identity)) {
      return h.userAssetSecurityId;
    }
  }
  return null;
}

function buildOcrAssetCandidateForAsset(params: {
  userAssetId: string;
  assetName: string;
  userAssetPlatformId: string | null;
  /** Broker platform the pipeline attributed to the document (`brandDbMatch.matchedBrokerPlatformId`), if any. */
  statementMatchedPlatformId: string | null;
  ocrRows: SecurityTransactionOcrExtractionRow[];
  holdings: AssetHoldingRow[];
}): OcrAssetCandidateResult {
  const totalCount = params.ocrRows.length;
  const securities = params.ocrRows.map((ocrRow) => {
    const userAssetSecurityId = pickFirstMatchingUserAssetSecurityId(
      ocrRow,
      params.holdings
    );
    const matched = userAssetSecurityId !== null;
    return {
      ocrRow,
      verified: true,
      matched,
      userAssetSecurityId: matched ? userAssetSecurityId : null,
    };
  });
  const matchedCount = securities.filter((s) => s.matched).length;
  const alignsWithMatchedStatementPlatform =
    params.statementMatchedPlatformId !== null &&
    params.userAssetPlatformId !== null &&
    params.userAssetPlatformId === params.statementMatchedPlatformId;
  return ocrAssetCandidateResultSchema.parse({
    userAssetId: params.userAssetId,
    assetName: params.assetName,
    userAssetPlatformId: params.userAssetPlatformId,
    alignsWithMatchedStatementPlatform,
    matchedCount,
    totalCount,
    securities,
  });
}

async function countUserAssetsOnBrokerPlatform(params: {
  accountId: string;
  brokerPlatformId: string;
  abortSignal?: AbortSignal;
}): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(userAssets)
    .where(
      and(
        eq(userAssets.userAccountId, params.accountId),
        eq(userAssets.platformId, params.brokerPlatformId)
      )
    );
  params.abortSignal?.throwIfAborted();
  return Number(row?.c ?? 0);
}

/**
 * Step 4c (revised): build an asset-first tree — each user asset with holdings lists
 * every OCR row with per-asset `matched` / `userAssetSecurityId`. No throw; callers
 * use `matchedCount === totalCount` to decide auto-insert vs user resolution.
 */
export async function buildOcrAssetCandidateResults(params: {
  accountId: string;
  rows: SecurityTransactionOcrExtractionRow[];
  brandDbMatch: StatementPlatformBrandDbMatch;
  verboseLog?: OcrPipelineVerboseLog;
  /** When set, checked after the holdings query so shutdown can preempt tree build. */
  abortSignal?: AbortSignal;
}): Promise<{
  candidates: OcrAssetCandidateResult[];
  hasPortfolioAccountOnMatchedPlatform: boolean;
}> {
  const { accountId, rows, brandDbMatch, verboseLog: v, abortSignal } = params;
  const statementMatchedPlatformId = brandDbMatch.matchedBrokerPlatformId;

  const hasPortfolioAccountOnMatchedPlatform =
    statementMatchedPlatformId != null
      ? (await countUserAssetsOnBrokerPlatform({
          accountId,
          brokerPlatformId: statementMatchedPlatformId,
          abortSignal,
        })) > 0
      : false;

  if (rows.length === 0) {
    return { candidates: [], hasPortfolioAccountOnMatchedPlatform };
  }

  const flat = await db
    .select({
      userAssetId: userAssets.id,
      assetName: userAssets.name,
      platformId: userAssets.platformId,
      userAssetSecurityId: userAssetSecurities.id,
      symbol: securities.symbol,
      isin: securities.isin,
      securityName: securities.name,
    })
    .from(userAssets)
    .innerJoin(userAssetSecurities, eq(userAssetSecurities.userAssetId, userAssets.id))
    .innerJoin(securities, eq(userAssetSecurities.securityId, securities.id))
    .where(
      and(eq(userAssets.userAccountId, accountId), eq(userAssetSecurities.archived, false))
    );

  abortSignal?.throwIfAborted();

  const assetsWithHoldings = groupHoldingsByAsset(flat);

  const candidates: OcrAssetCandidateResult[] = [];
  for (const asset of assetsWithHoldings) {
    if (asset.holdings.length === 0) {
      continue;
    }
    candidates.push(
      buildOcrAssetCandidateForAsset({
        userAssetId: asset.userAssetId,
        assetName: asset.assetName,
        userAssetPlatformId: asset.platformId,
        statementMatchedPlatformId,
        ocrRows: rows,
        holdings: asset.holdings,
      })
    );
  }

  v?.("4c_asset_candidates_built", {
    accountId,
    ocrRowCount: rows.length,
    assetCandidateCount: candidates.length,
    fullMatchAssetIds: candidates
      .filter((c) => c.matchedCount === c.totalCount && c.totalCount > 0)
      .map((c) => c.userAssetId),
  });

  return { candidates, hasPortfolioAccountOnMatchedPlatform };
}

export function assertBrandVerificationPassed(
  match: StatementPlatformBrandDbMatch
): void {
  if (!match.ok) {
    throw new Error(
      `OCR phase 3b/3c: brand verification failed (${match.rejectReason ?? "unknown"})`
    );
  }
}
