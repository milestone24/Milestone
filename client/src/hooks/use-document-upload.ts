import { useMutation } from "@tanstack/react-query";
import type { DocumentOcrResponse } from "@shared/schema/document";

export interface OcrUploadConfig {
  platformKey: string;
  platformNames: string[];
  /** When set, uses the asset-scoped extract endpoint. */
  nominatedAssetId?: string;
}

async function uploadDocument(
  file: File,
  { platformKey, platformNames, nominatedAssetId }: OcrUploadConfig
): Promise<DocumentOcrResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("platformNames", JSON.stringify(platformNames));

  const path =
    nominatedAssetId !== undefined && nominatedAssetId !== ""
      ? `/api/assets/${nominatedAssetId}/documents/${encodeURIComponent(platformKey)}/extract`
      : `/api/documents/${encodeURIComponent(platformKey)}/extract`;

  const res = await fetch(path, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json() as Promise<DocumentOcrResponse>;
}

/**
 * Returns a mutation whose variable is a plain `File`.
 * OCR-specific params (platformKey, platformNames, nominatedAssetId) are
 * captured as configuration so the generic DocumentUpload component only
 * needs to hand over the file.
 */
export const useDocumentUpload = (config: OcrUploadConfig) => {
  return useMutation<DocumentOcrResponse, Error, File>({
    mutationFn: (file) => uploadDocument(file, config),
  });
};
