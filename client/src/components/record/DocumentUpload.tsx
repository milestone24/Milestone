import { useState, useEffect, useRef } from "react";
import { Upload, Loader2, AlertCircle, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { UserAsset, BrokerPlatform } from "@shared/schema";
import { ExtractedAmount } from "@shared/schema/document";
import { useBrokerPlatforms } from "@/hooks/use-broker-platforms";
import { useDocumentUpload } from "@/hooks/use-document-upload";

interface DocumentUploadProps {
  assets: UserAsset[];
  onExtractedValues: (data: { assetId: string; value: number }[]) => void;
  /** When set, OCR extract uses the asset-scoped API and sets `pipeline.nominatedUserAssetId`. */
  nominatedAssetId?: string;
}

type UploadState =
  | { status: "idle" }
  | { status: "processing"; jobId: string }
  | { status: "complete"; extractedValues: ExtractedAmount[] }
  | { status: "error"; message: string };

interface ExtractedValueEdit extends ExtractedAmount {
  editedAmount: number;
  matchedAssetId?: string;
}

export function DocumentUpload({
  assets,
  onExtractedValues,
  nominatedAssetId,
}: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [platformKey, setPlatformKey] = useState<string>("unknown");
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [editedValues, setEditedValues] = useState<ExtractedValueEdit[]>([]);

  const { data: platforms } = useBrokerPlatforms();
  const mutation = useDocumentUpload();

  const platformNames = platforms?.map((p: BrokerPlatform) => p.name) ?? [];

  useEffect(() => {
    if (uploadState.status !== "processing") return;

    const { jobId } = uploadState;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "document-ocr-completed" && data.jobId === jobId) {
          const values: ExtractedValueEdit[] = (data.extractedValues ?? []).map(
            (v: ExtractedAmount) => ({
              ...v,
              editedAmount: v.amount,
              matchedAssetId: undefined,
            })
          );
          setEditedValues(values);
          setUploadState({ status: "complete", extractedValues: data.extractedValues });
          ws.close();
        }

        if (data.type === "notification" && data.message?.includes("failed")) {
          setUploadState({ status: "error", message: data.message });
          ws.close();
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, [uploadState, assets]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadState({ status: "idle" });
    e.target.value = "";
  };

  const startUpload = () => {
    if (!selectedFile) return;

    setUploadState({ status: "processing", jobId: "" });

    mutation.mutate(
      {
        file: selectedFile,
        platformKey,
        platformNames,
        ...(nominatedAssetId ? { nominatedAssetId } : {}),
      },
      {
        onSuccess: (result) => {
          setUploadState({ status: "processing", jobId: result.jobId });
        },
        onError: (err) => {
          setUploadState({ status: "error", message: err.message });
        },
      }
    );
  };

  const handlePrimaryClick = () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }
    startUpload();
  };

  const handleSave = () => {
    const mapped = editedValues
      .filter((v) => v.matchedAssetId)
      .map((v) => ({ assetId: v.matchedAssetId!, value: v.editedAmount }));
    onExtractedValues(mapped);
  };

  const handleAmountChange = (index: number, value: string) => {
    setEditedValues((prev) =>
      prev.map((v, i) =>
        i === index ? { ...v, editedAmount: parseFloat(value) || 0 } : v
      )
    );
  };

  const handleAssetMatch = (index: number, assetId: string) => {
    setEditedValues((prev) =>
      prev.map((v, i) => (i === index ? { ...v, matchedAssetId: assetId } : v))
    );
  };

  return (
    <div className="space-y-4">
      <label
        htmlFor="document-upload-file-input"
        className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
      >
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          {selectedFile
            ? selectedFile.name
            : "Click to upload an image or PDF statement"}
        </p>
        <input
          id="document-upload-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>

      <div className="space-y-2">
        <label className="text-sm font-medium">Platform</label>
        <Select value={platformKey} onValueChange={setPlatformKey}>
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

      {uploadState.status === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {uploadState.message}
        </div>
      )}

      {(uploadState.status === "idle" || uploadState.status === "error") && (
        <Button
          type="button"
          onClick={handlePrimaryClick}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {selectedFile ? "Upload and extract" : "Choose a file"}
        </Button>
      )}

      {uploadState.status === "processing" && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing document…
        </div>
      )}

      {uploadState.status === "complete" && editedValues.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          No account balances could be extracted from this document.
        </div>
      )}

      {uploadState.status === "complete" && editedValues.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Extracted values — review and confirm</p>
          {editedValues.map((v, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{v.platformName}</span>
                {v.accountType && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {v.accountType}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Amount</span>
                <Input
                  type="number"
                  value={v.editedAmount}
                  onChange={(e) => handleAmountChange(i, e.target.value)}
                  className="h-7 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Asset</span>
                <Select
                  value={v.matchedAssetId ?? ""}
                  onValueChange={(val) => handleAssetMatch(i, val)}
                >
                  <SelectTrigger className="h-7 text-sm">
                    <SelectValue placeholder="Match to asset…" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                Confidence: {Math.round(v.confidence * 100)}%
              </div>
            </div>
          ))}
          <Button onClick={handleSave} className="w-full">
            <Check className="h-4 w-4 mr-2" />
            Save extracted values
          </Button>
        </div>
      )}
    </div>
  );
}
