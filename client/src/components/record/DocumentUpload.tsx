import { useRef, useState } from "react";
import { Upload, Loader2, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UseMutationResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function fileMatchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }
  for (const token of tokens) {
    if (token === "*/*") {
      return true;
    }
    if (token.endsWith("/*")) {
      const major = token.slice(0, -2);
      if (file.type.startsWith(`${major}/`)) {
        return true;
      }
    } else if (token === file.type) {
      return true;
    }
  }
  return false;
}

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
  const dragDepthRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDraggingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (!fileMatchesAccept(file, accept)) {
      setUploadState("error");
      setErrorMessage("That file type is not accepted for this upload.");
      return;
    }
    setSelectedFile(file);
    setUploadState("idle");
    setErrorMessage(null);
  };

  return (
    <div className="space-y-4">
      <label
        htmlFor="document-upload-file-input"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors",
          isDraggingFile && "border-primary bg-primary/5"
        )}
      >
        <FileText className="h-8 w-8 text-muted-foreground" />
        <div className="text-sm text-muted-foreground text-center space-y-1">
          {selectedFile ? (
            <p>{selectedFile.name}</p>
          ) : (
            <>
              <p>{label}</p>
              <p className="text-xs">Or drop a file here.</p>
            </>
          )}
        </div>
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
