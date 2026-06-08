import { Link } from "wouter";
import { AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAssets } from "@/hooks/use-assets";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import type { DocumentOcrPipelineResult, ExtractedAmount } from "@milestone/js-common/schema/document";
import { OcrResultsSection } from "./ocr-results-section";
import { OcrResultsMetaRow } from "./ocr-results-meta-row";
import { OcrResultsEmptyState } from "./ocr-results-empty-state";
import { OcrResultsCodeBlock } from "./ocr-results-code-block";
import { OcrResultsExtractedBalancesReadonly } from "./ocr-results-extracted-balances-readonly";
import { OcrResultsPlainHoldingRows } from "./ocr-results-plain-holding-rows";
import { OcrResultsAssetCandidateReadonly } from "./ocr-results-asset-candidate-readonly";

type OcrPipelineReadonlyPanelsProps = {
  pipeline: DocumentOcrPipelineResult;
  extractedValues: ExtractedAmount[];
  /** When true, append full JSON for debugging. */
  showRawJson?: boolean;
};

export function OcrPipelineReadonlyPanels({
  pipeline,
  extractedValues,
  showRawJson = true,
}: OcrPipelineReadonlyPanelsProps) {
  const { data: platforms = [] } = useBrokerPlatforms();
  const { data: portfolioAssets = [] } = useAssets();
  const platformName = (id: string | null | undefined) =>
    id ? platforms.find((p) => p.id === id)?.name ?? id : "—";

  const {
    brandIdentification,
    brandDbMatch,
    securityHoldings,
    assetCandidates,
    nominatedUserAssetId,
    hasPortfolioAccountOnMatchedPlatform,
  } = pipeline;

  const nomineeName = nominatedUserAssetId
    ? portfolioAssets.find((a) => a.id === nominatedUserAssetId)?.name
    : undefined;

  const matchedPlatformId = brandDbMatch.matchedBrokerPlatformId;
  const hasPortFlag = hasPortfolioAccountOnMatchedPlatform;
  const showNoPortfolioOnBrokerWarning =
    Boolean(matchedPlatformId) && hasPortFlag === false;

  const holdingsRows = securityHoldings.map((row, i) => ({
    key: `${i}-${row.symbol ?? row.name ?? "row"}`,
    label: [row.name, row.symbol].filter(Boolean).join(" · ") || "Unknown security",
  }));

  return (
    <div className="space-y-4">
      <OcrResultsSection title="Statement interpretation">
        <OcrResultsMetaRow label="LLM path">
          <span className="font-mono text-xs">
            {pipeline.llmPath === "text" ? "text (transcript)" : "vision (document / image)"}
          </span>
        </OcrResultsMetaRow>
        {pipeline.nativePdfCharCount != null ? (
          <OcrResultsMetaRow label="Native PDF chars">
            <span>{pipeline.nativePdfCharCount}</span>
          </OcrResultsMetaRow>
        ) : null}
        {nominatedUserAssetId ? (
          <OcrResultsMetaRow label="Preferred portfolio account (import)">
            <div className="flex flex-col gap-0.5 items-end text-right min-w-0">
              {nomineeName ? (
                <Link
                  href={`/asset/${nominatedUserAssetId}`}
                  className="text-primary font-medium text-sm underline-offset-2 hover:underline truncate max-w-full"
                >
                  {nomineeName}
                </Link>
              ) : null}
              <Link
                href={`/asset/${nominatedUserAssetId}`}
                className="text-muted-foreground underline-offset-2 hover:underline font-mono text-xs break-all"
              >
                {nominatedUserAssetId}
              </Link>
            </div>
          </OcrResultsMetaRow>
        ) : null}
      </OcrResultsSection>

      <OcrResultsSection title="Platform on document">
        <ul className="space-y-2">
          {brandIdentification.candidates.map((c, i) => (
            <li
              key={`${c.name}-${i}`}
              className="border rounded-md px-3 py-2 flex flex-wrap items-center justify-between gap-2"
            >
              <span className="font-medium text-sm">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(c.confidence * 100)}% · {c.inferenceMethod}
              </span>
            </li>
          ))}
        </ul>
      </OcrResultsSection>

      <OcrResultsSection title="Database match">
        {brandDbMatch.configuredBrokerPlatformId ? (
          <OcrResultsMetaRow label="Platform you selected for this import">
            <span className="text-sm text-right">
              {platformName(brandDbMatch.configuredBrokerPlatformId)}
            </span>
          </OcrResultsMetaRow>
        ) : null}
        {brandDbMatch.matchesConfiguredPlatform !== undefined ? (
          <OcrResultsMetaRow label="Statement platform matches your selection">
            <span>{brandDbMatch.matchesConfiguredPlatform ? "Yes" : "No"}</span>
          </OcrResultsMetaRow>
        ) : null}
        <OcrResultsMetaRow label="OK">
          <span>{brandDbMatch.ok ? "Yes" : "No"}</span>
        </OcrResultsMetaRow>
        <OcrResultsMetaRow label="Match kind">
          <span className="font-mono text-xs">{brandDbMatch.matchKind}</span>
        </OcrResultsMetaRow>
        {matchedPlatformId ? (
          <OcrResultsMetaRow label="Statement matched to broker">
            <span className="text-sm text-right">{platformName(matchedPlatformId)}</span>
          </OcrResultsMetaRow>
        ) : null}
        {matchedPlatformId ? (
          <OcrResultsMetaRow label="Matched platform id">
            <span className="font-mono text-xs break-all">{matchedPlatformId}</span>
          </OcrResultsMetaRow>
        ) : null}
        {matchedPlatformId && typeof hasPortFlag === "boolean" ? (
          <OcrResultsMetaRow label="Portfolio account on this broker (in Milestone)">
            <span>{hasPortFlag ? "Yes" : "No"}</span>
          </OcrResultsMetaRow>
        ) : null}
        {brandDbMatch.rejectReason ? (
          <OcrResultsMetaRow label="Reject reason">
            <span className="text-destructive text-xs">{brandDbMatch.rejectReason}</span>
          </OcrResultsMetaRow>
        ) : null}
        {showNoPortfolioOnBrokerWarning ? (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No portfolio account on this broker</AlertTitle>
            <AlertDescription>
              The statement was matched to{" "}
              <span className="font-medium">{platformName(matchedPlatformId)}</span>, but you do
              not have a portfolio account linked to that broker. Add an account with this broker
              platform to reconcile against it.
            </AlertDescription>
          </Alert>
        ) : null}
      </OcrResultsSection>

      <OcrResultsSection title="Extracted holdings (model)">
        {securityHoldings.length === 0 ? (
          <OcrResultsEmptyState message="No security rows in the pipeline output." />
        ) : (
          <OcrResultsPlainHoldingRows rows={holdingsRows} />
        )}
      </OcrResultsSection>

      <OcrResultsSection title="Portfolio match">
        {assetCandidates.length === 0 ? (
          <OcrResultsEmptyState message="No portfolio accounts were evaluated for this account." />
        ) : (
          <div className="space-y-3">
            {assetCandidates.map((c) => (
              <OcrResultsAssetCandidateReadonly
                key={c.userAssetId}
                candidate={c}
                emphasized={
                  nominatedUserAssetId !== null && c.userAssetId === nominatedUserAssetId
                }
              />
            ))}
          </div>
        )}
        {matchedPlatformId && assetCandidates.some((c) => c.alignsWithMatchedStatementPlatform) ? (
          <Alert className="border-sky-500/40 bg-sky-500/5">
            <Info className="h-4 w-4 text-sky-600" />
            <AlertTitle className="text-sky-900 dark:text-sky-100">
              Platform alignment
            </AlertTitle>
            <AlertDescription className="text-sky-900/90 dark:text-sky-100/90">
              Highlighted accounts use the same broker platform as the matched statement.
            </AlertDescription>
          </Alert>
        ) : null}
      </OcrResultsSection>

      <OcrResultsSection title="Extracted balances">
        {extractedValues.length === 0 ? (
          <OcrResultsEmptyState message="No account balances could be extracted from this document." />
        ) : (
          <OcrResultsExtractedBalancesReadonly values={extractedValues} showHeading={false} />
        )}
      </OcrResultsSection>

      {showRawJson && extractedValues.length > 0 ? (
        <OcrResultsSection title="Raw extracted balances JSON" description="For support and debugging.">
          <OcrResultsCodeBlock className="max-h-[240px] overflow-y-auto">
            {JSON.stringify(extractedValues, null, 2)}
          </OcrResultsCodeBlock>
        </OcrResultsSection>
      ) : null}

      {showRawJson ? (
        <OcrResultsSection title="Raw pipeline JSON" description="For support and debugging.">
          <OcrResultsCodeBlock className="max-h-[360px] overflow-y-auto">
            {JSON.stringify(pipeline, null, 2)}
          </OcrResultsCodeBlock>
        </OcrResultsSection>
      ) : null}
    </div>
  );
}
