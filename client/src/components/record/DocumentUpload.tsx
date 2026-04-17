import { useRef, useState } from "react";
import { Upload, Loader2, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UseMutationResult } from "@tanstack/react-query";

interface DocumentUploadProps<TResponse> {
  /** Mime types accepted by the file input (e.g. "image/*,application/pdf"). */
  accept?: string;
  /** Label shown inside the drop zone when no file is selected. */
  label?: string;
  /** Mutation provided by the consumer — controls which endpoint is called. */
  uploadMutation: UseMutationResult<TResponse, Error, File>;
  /** Called with the parsed response once the POST succeeds. */
  onUploadResponse: (response: TResponse) => void;
  /** Called when the POST fails. */
  onError?: (error: Error) => void;
  /** Optional controls rendered between the drop zone and the upload button. */
  children?: React.ReactNode;
}

type UploadState = "idle" | "uploading" | "error";

export function DocumentUpload<TResponse>({
  accept = "image/*,application/pdf",
  label = "Click to upload an image or PDF",
  uploadMutation,
  onUploadResponse,
  onError,
  children,
}: DocumentUploadProps<TResponse>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadState("idle");
    setErrorMessage(null);
    e.target.value = "";
  };

  const handleUpload = () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }

    setUploadState("uploading");
    setErrorMessage(null);

    uploadMutation.mutate(selectedFile, {
      onSuccess: (response) => {
        setUploadState("idle");
        onUploadResponse(response);
      },
      onError: (err) => {
        setUploadState("error");
        setErrorMessage(err.message);
        onError?.(err);
      },
    });
  };

  return (
    <div className="space-y-4">
      <label
        htmlFor="document-upload-file-input"
        className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
      >
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          {selectedFile ? selectedFile.name : label}
        </p>
        <input
          id="document-upload-file-input"
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>

      {children}

      {uploadState === "error" && errorMessage && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {uploadState === "uploading" ? (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading…
        </div>
      ) : (
        <Button type="button" onClick={handleUpload} className="w-full">
          <Upload className="h-4 w-4 mr-2" />
          {selectedFile ? "Upload" : "Choose a file"}
        </Button>
      )}
    </div>
  );
}
