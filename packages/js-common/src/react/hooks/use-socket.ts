import { useQueryClient } from "@tanstack/react-query";
import { assetOcrPendingReview, assetProcesses } from "../../api/queryKeys";
import {
  useNotificationService,
  useSocketUrl,
} from "../../platform/PlatformServicesProvider";
import {
  isDocumentOcrCompletedSocketMessage,
  isNotificationMessage,
  isQueryMessage,
  type SocketMessage,
} from "../../schema/socket";
import { isInlineOcrProcessJob } from "../../utils/ocr-inline-job-awaiting";
import { useEffect } from "react";

export const useSocket = () => {
  const socketUrl = useSocketUrl();
  const notifications = useNotificationService();
  const queryClient = useQueryClient();

  useEffect(() => {
    const websocketUrl = socketUrl.getWebSocketUrl();
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
          notifications.show({
            title: "Statement OCR completed",
            description: nominated
              ? "Results are ready on the portfolio account."
              : "You can continue in the Record or Documents flow.",
          });
        }
        return;
      }
      if (isNotificationMessage(data)) {
        notifications.show({
          title: "Notification",
          description: data.message,
        });
      }
    };

    return () => {
      controller.abort();
      websocket.close(1000, "Aborted");
    };
  }, [notifications, queryClient, socketUrl]);
};
