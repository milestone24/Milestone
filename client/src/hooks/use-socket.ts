import { queryClient } from "@/lib/queryClient";
import { isNotificationMessage, isQueryMessage } from "@shared/schema/socket";
import { useEffect } from "react";
import { toast } from "./use-toast";

export const useSocket = () => {
  useEffect(() => {

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const websocketUrl = `${protocol}://${window.location.host}/`;
    const websocket = new WebSocket(websocketUrl);
    websocket.onopen = () => {
      console.log("websocket connected");
    };
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (isQueryMessage(data)) {
        for (const queryKey of data.queryKeys) {
          queryClient.invalidateQueries({ queryKey });
        }
      }
      if (isNotificationMessage(data)) {
        toast({
          title: "Notification",
          description: data.message,
        });
      }
    };

    return () => {
      websocket.close();
    };
  }, [queryClient]);
};
