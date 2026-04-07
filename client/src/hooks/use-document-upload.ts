import { useMutation } from "@tanstack/react-query";
import type { DocumentOcrResponse } from "@shared/schema/document";

interface UploadDocumentParams {
  file: File;
  platformKey: string;
  platformNames: string[];
}

async function uploadDocument({
  file,
  platformKey,
  platformNames,
}: UploadDocumentParams): Promise<DocumentOcrResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("platformNames", JSON.stringify(platformNames));

  const res = await fetch(`/api/documents/${platformKey}/extract`, {
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
