import { and, eq } from "drizzle-orm";
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
import type { SecurityTransactionOcrExtractionRow } from "@shared/schema/transaction";

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
}): Promise<StatementPlatformBrandDbMatch> {
  const { identification, configuredBrokerPlatformId } = params;
  const platforms = await db
    .select({ id: brokerPlatforms.id, name: brokerPlatforms.name })
    .from(brokerPlatforms);

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

/** Compare ISINs ignoring case and internal spaces. */
function isinsEqual(a: string, b: string): boolean {
  return a.replace(/\s/g, "").toUpperCase() === b.replace(/\s/g, "").toUpperCase();
}

/**
 * True when OCR and DB tickers refer to the same instrument under common variants
 * (e.g. `VWRL` vs `VWRL.L`, same base before the first dot).
 */
function symbolsCompatible(ocrSymbol: string | undefined, dbSymbol: string): boolean {
  const raw = ocrSymbol?.trim();
  if (!raw) return false;
  const o = normSymbol(raw);
  const d = normSymbol(dbSymbol);
  if (o === d) return true;
  const baseO = o.includes(".") ? o.slice(0, o.indexOf(".")) : o;
  const baseD = d.includes(".") ? d.slice(0, d.indexOf(".")) : d;
  if (baseO.length < 2 || baseD.length < 2) return false;
  return baseO === baseD;
}

const OCR_NAME_PREFIX_MIN_LEN = 10;

function rowMatchesUserSecurity(
  row: SecurityTransactionOcrExtractionRow,
  holding: { symbol: string; isin: string | null; name: string }
): boolean {
  const rowSym = row.symbol?.trim();
  const rowIsin = row.isin?.trim();
  const rowName = row.name?.trim();

  const symMatch = symbolsCompatible(rowSym, holding.symbol);
  const isinMatch =
    !!rowIsin &&
    !!holding.isin &&
    isinsEqual(rowIsin, holding.isin);

  // Near-definitive when both identifiers agree (OCR and DB each supply ISIN).
  if (symMatch && isinMatch) return true;
  if (symMatch) return true;
  if (isinMatch) return true;

  if (!rowName) return false;

  const rn = normalizeLabel(rowName);
  const hn = normalizeLabel(holding.name);
  if (rn.length === 0) return false;
  if (hn === rn) return true;
  // Short OCR title vs longer canonical name, e.g. "Vanguard FTSE Developed World" vs
  // "Vanguard FTSE Developed World UCITS ETF USD Accumulation"
  if (rn.length >= OCR_NAME_PREFIX_MIN_LEN && hn.startsWith(rn)) return true;

  return fuzzyRatio(rn, hn) >= 0.92;
}

/**
 * Step 4c: each OCR security row must match at least one non-archived holding for the account.
 */
export async function verifySecurityHoldingsOwnedByUser(params: {
  accountId: string;
  rows: SecurityTransactionOcrExtractionRow[];
}): Promise<void> {
  const { accountId, rows } = params;
  if (rows.length === 0) return;

  const holdings = await db
    .select({
      symbol: securities.symbol,
      isin: securities.isin,
      name: securities.name,
    })
    .from(userAssetSecurities)
    .innerJoin(userAssets, eq(userAssetSecurities.userAssetId, userAssets.id))
    .innerJoin(securities, eq(userAssetSecurities.securityId, securities.id))
    .where(
      and(eq(userAssets.userAccountId, accountId), eq(userAssetSecurities.archived, false))
    );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ok = holdings.some((h) => rowMatchesUserSecurity(row, h));
    if (!ok) {
      throw new Error(
        `OCR phase 4c: security row ${i + 1} (${row.symbol ?? row.name ?? "?"}) does not match any holding for this account`
      );
    }
  }
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
