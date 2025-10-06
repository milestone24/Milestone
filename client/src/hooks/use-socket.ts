import { queryClient } from "@/lib/queryClient";
import { isNotificationMessage, isQueryMessage } from "@shared/schema/socket";
import { useEffect } from "react";
import { toast } from "./use-toast";

export const useSocket = () => {
  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:5001/");
    websocket.onopen = () => {
      console.log("connected");
    };
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (isQueryMessage(data)) {
        const queryKey = [...data.entity, data.id].filter(Boolean);
        queryClient.invalidateQueries({ queryKey });
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
