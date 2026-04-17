import { Link } from "wouter";
import type { DocumentOcrPipelineResult, ExtractedAmount } from "@shared/schema/document";
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
  const { brandIdentification, brandDbMatch, securityHoldings, assetCandidates, nominatedUserAssetId } =
    pipeline;

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
          <OcrResultsMetaRow label="Nominated asset">
            <Link
              href={`/asset/${nominatedUserAssetId}`}
              className="text-primary underline-offset-2 hover:underline font-mono text-xs break-all"
            >
              {nominatedUserAssetId}
            </Link>
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
        <OcrResultsMetaRow label="OK">
          <span>{brandDbMatch.ok ? "Yes" : "No"}</span>
        </OcrResultsMetaRow>
        <OcrResultsMetaRow label="Match kind">
          <span className="font-mono text-xs">{brandDbMatch.matchKind}</span>
        </OcrResultsMetaRow>
        {brandDbMatch.matchedBrokerPlatformId ? (
          <OcrResultsMetaRow label="Matched platform id">
            <span className="font-mono text-xs break-all">{brandDbMatch.matchedBrokerPlatformId}</span>
          </OcrResultsMetaRow>
        ) : null}
        {brandDbMatch.rejectReason ? (
          <OcrResultsMetaRow label="Reject reason">
            <span className="text-destructive text-xs">{brandDbMatch.rejectReason}</span>
          </OcrResultsMetaRow>
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
