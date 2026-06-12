import { connections } from "@/sockets/connections";
import { SocketMessage } from "@shared/schema/socket";

export const sendNotification = (accountId: string, message: SocketMessage) => {
  const sockets = connections.get(accountId);
  if (sockets) {
    sockets.forEach((socket) => {
      socket.send(JSON.stringify(message));
    });
  }
};

