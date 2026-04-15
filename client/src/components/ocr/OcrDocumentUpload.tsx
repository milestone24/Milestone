import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { DocumentOcrResponse } from "@shared/schema/document";
import type { BrokerPlatform } from "@shared/schema";

export type OcrCompleteResult = Extract<OcrJobStatus, { status: "complete" }>;

interface OcrDocumentUploadProps {
  /** When set, uses the asset-scoped extract endpoint. */
  nominatedAssetId?: string;
  /** Pre-select a platform in the selector (e.g. from the asset's platformId). */
  initialPlatformKey?: string;
  /** Whether to show the platform selector. Defaults to true. Set to false when the platform is implied by context (e.g. asset page). */
  showPlatformSelect?: boolean;
  onOcrComplete: (result: OcrCompleteResult) => void;
  onOcrError?: (message: string) => void;
}

export function OcrDocumentUpload({
  nominatedAssetId,
  initialPlatformKey,
  showPlatformSelect = true,
  onOcrComplete,
  onOcrError,
}: OcrDocumentUploadProps) {
  const [platformKey, setPlatformKey] = useState<string>(initialPlatformKey ?? "unknown");
  const [jobId, setJobId] = useState<string | null>(null);

  const { data: platforms } = useBrokerPlatforms();
  const platformNames = platforms?.map((p: BrokerPlatform) => p.name) ?? [];

  const uploadMutation = useDocumentUpload({
    platformKey,
    platformNames,
    nominatedAssetId,
  });

  const jobStatus = useOcrJobEvents(jobId);

  const handleUploadResponse = (response: DocumentOcrResponse) => {
    setJobId(response.jobId);
  };

  const handleUploadError = (error: Error) => {
    onOcrError?.(error.message);
  };

  useEffect(() => {
    if (jobStatus.status === "complete") {
      onOcrComplete(jobStatus);
    }
    if (jobStatus.status === "failed" || jobStatus.status === "aborted") {
      onOcrError?.(jobStatus.message);
    }
  }, [jobStatus.status]);

  const isProcessing = jobStatus.status === "processing";

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
            <label className="text-sm font-medium">Platform</label>
            <Select value={platformKey} onValueChange={setPlatformKey} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform or leave unknown" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown — identify automatically</SelectItem>
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

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing document…
        </div>
      )}

      {(jobStatus.status === "failed" || jobStatus.status === "aborted") && (
        <p className="text-sm text-destructive">{jobStatus.message}</p>
      )}
    </div>
  );
}
