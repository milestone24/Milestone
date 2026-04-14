import { useMutation } from "@tanstack/react-query";
import type { DocumentOcrResponse } from "@shared/schema/document";

interface UploadDocumentParams {
  file: File;
  platformKey: string;
  platformNames: string[];
  /** When set, uses asset-scoped extract (`POST /api/assets/:id/documents/:platformKey/extract`). */
  nominatedAssetId?: string;
}

async function uploadDocument({
  file,
  platformKey,
  platformNames,
  nominatedAssetId,
}: UploadDocumentParams): Promise<DocumentOcrResponse> {
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

export const useDocumentUpload = () => {
  return useMutation<DocumentOcrResponse, Error, UploadDocumentParams>({
    mutationFn: uploadDocument,
  });
};
