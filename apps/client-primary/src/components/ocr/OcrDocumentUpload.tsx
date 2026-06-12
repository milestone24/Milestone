import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentUpload } from "@/components/record/DocumentUpload";
import { useDocumentUpload } from "@/hooks/use-document-upload";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import { useOcrJobEvents, OcrJobStatus } from "@/hooks/use-ocr-job-events";
import type { DocumentOcrResponse } from "@milestone/js-common/schema/document";
import type { BrokerPlatform } from "@milestone/js-common/schema";

export type OcrCompleteResult = Extract<OcrJobStatus, { status: "complete" }>;

interface OcrDocumentUploadProps {
  /** When set, uses the asset-scoped extract endpoint. */
  nominatedAssetId?: string;
  /** Pre-select a platform preference in the selector (e.g. from the asset's `platformId`). */
  initialPlatformKey?: string;
  /** Whether to show the platform preference selector. Defaults to true. Set to false when the preference is implied by context (e.g. asset page). */
  showPlatformSelect?: boolean;
  /**
   * When true (default), opens a job-scoped WebSocket and calls `onOcrComplete` when OCR finishes
   * (record page). When false, upload returns immediately and completion is surfaced via the main
   * socket + pending-review UI (asset page).
   */
  awaitResultsInline?: boolean;
  /** When `awaitResultsInline` is false, called after the server accepts the upload (202) so the parent can close a dialog, etc. */
  onUploadStarted?: () => void;
  onOcrComplete?: (result: OcrCompleteResult) => void;
  onOcrError?: (message: string) => void;
}

export function OcrDocumentUpload({
  nominatedAssetId,
  initialPlatformKey,
  showPlatformSelect = true,
  awaitResultsInline = true,
  onUploadStarted,
  onOcrComplete,
  onOcrError,
}: OcrDocumentUploadProps) {
  const [platformKey, setPlatformKey] = useState<string>(initialPlatformKey ?? "unknown");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadOcrJobId, setUploadOcrJobId] = useState<string | null>(null);

  const { data: platforms } = useBrokerPlatforms();
  const platformNames = platforms?.map((p: BrokerPlatform) => p.name) ?? [];

  const uploadMutation = useDocumentUpload({
    platformKey,
    platformNames,
    nominatedAssetId,
  });

  const jobStatus = useOcrJobEvents(awaitResultsInline ? jobId : null);

  const handleUploadResponse = (response: DocumentOcrResponse) => {
    if (awaitResultsInline) {
      setJobId(response.jobId);
      setUploadOcrJobId(response.ocrJobId);
    } else {
      onUploadStarted?.();
    }
  };

  const handleUploadError = (error: Error) => {
    onOcrError?.(error.message);
  };

  useEffect(() => {
    if (!awaitResultsInline || !onOcrComplete) {
      return;
    }
    if (jobStatus.status === "complete") {
      const ocrJobId =
        jobStatus.ocrJobId || uploadOcrJobId || "";
      onOcrComplete({
        ...jobStatus,
        ocrJobId,
      });
    }
    if (jobStatus.status === "failed" || jobStatus.status === "aborted") {
      onOcrError?.(jobStatus.message);
    }
  }, [awaitResultsInline, jobStatus, onOcrComplete, onOcrError, uploadOcrJobId]);

  const isProcessing = awaitResultsInline && jobStatus.status === "processing";

  return (
    <div className="space-y-4">
      <DocumentUpload<DocumentOcrResponse>
        accept="image/*,application/pdf"
        label="Click to upload an image or PDF statement"
        uploadMutation={uploadMutation}
        onUploadResponse={handleUploadResponse}
        onError={handleUploadError}
      >
        {showPlatformSelect && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Platform preference (optional)</label>
            <Select value={platformKey} onValueChange={setPlatformKey} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue placeholder="No platform preference or choose a broker platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">No platform preference (identify automatically)</SelectItem>
                {platforms?.map((p: BrokerPlatform) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </DocumentUpload>

      {(jobStatus.status === "failed" || jobStatus.status === "aborted") && (
        <p className="text-sm text-destructive">{jobStatus.message}</p>
      )}
    </div>
  );
}
