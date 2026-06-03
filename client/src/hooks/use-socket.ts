import { queryClient } from "@/lib/queryClient";
import type { SocketMessage } from "@shared/schema/socket";
import {
  isDocumentOcrCompletedSocketMessage,
  isNotificationMessage,
  isQueryMessage,
} from "@shared/schema/socket";
import { assetOcrPendingReview, assetProcesses } from "@shared/api/queryKeys";
import { isInlineOcrProcessJob } from "@/lib/ocr-inline-job-awaiting";
import { useEffect } from "react";
import { toast } from "./use-toast";

export const useSocket = () => {
  useEffect(() => {

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const websocketUrl = `${protocol}://${window.location.host}/`;
    const websocket = new WebSocket(websocketUrl);

    const controller = new AbortController();

    websocket.onopen = () => {
      console.log("websocket connected");
    };
    websocket.onmessage = (event) => {

      if (controller.signal.aborted) {
        return;
      }

      let data: SocketMessage;
      try {
        data = JSON.parse(event.data) as SocketMessage;
      } catch {
        return;
      }

      if (isQueryMessage(data)) {
        for (const queryKey of data.queryKeys) {
          queryClient.invalidateQueries({ queryKey });
          if (queryKey[0] === "assets" && queryKey[1]) {
            queryClient.invalidateQueries({
              queryKey: [...assetProcesses, queryKey[1]],
            });
          }
        }
      }
      if (isDocumentOcrCompletedSocketMessage(data)) {
        const nominated = data.pipeline?.nominatedUserAssetId;
        if (nominated) {
          queryClient.invalidateQueries({
            queryKey: [...assetOcrPendingReview, nominated],
          });
        }
        if (!isInlineOcrProcessJob(data.jobId)) {
          toast({
            title: "Statement OCR completed",
            description: nominated
              ? "Results are ready on the portfolio account."
              : "You can continue in the Record or Documents flow.",
          });
        }
        return;
      }
      if (isNotificationMessage(data)) {
        toast({
          title: "Notification",
          description: data.message,
        });
      }
    };

    return () => {
      controller.abort();
      websocket.close(1000, "Aborted");
    };
  }, [queryClient]);
};
