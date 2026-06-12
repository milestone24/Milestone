import { useMutation } from "@tanstack/react-query";
import type { DocumentOcrResponse } from "../../schema/document";
import { useFileUploadTransport } from "../../platform/PlatformServicesProvider";

export interface OcrUploadConfig {
  platformKey: string;
  platformNames: string[];
  /** When set, uses the asset-scoped extract endpoint. */
  nominatedAssetId?: string;
}

/**
 * Returns a mutation whose variable is a plain `File` (web) or upload payload (native).
 * OCR-specific params (platformKey, platformNames, nominatedAssetId) are
 * captured as configuration so the generic DocumentUpload component only
 * needs to hand over the file.
 */
export const useDocumentUpload = (config: OcrUploadConfig) => {
  const fileUpload = useFileUploadTransport();

  return useMutation<DocumentOcrResponse, Error, File>({
    mutationFn: (file) => {
      const path =
        config.nominatedAssetId !== undefined && config.nominatedAssetId !== ""
          ? `/api/assets/${config.nominatedAssetId}/documents/${encodeURIComponent(config.platformKey)}/extract`
          : `/api/documents/${encodeURIComponent(config.platformKey)}/extract`;
      return fileUpload.upload(path, file, {
        platformNames: JSON.stringify(config.platformNames),
      }) as Promise<DocumentOcrResponse>;
    },
  });
};
