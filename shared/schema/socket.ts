export type QueryMessage = {
  type: "query";
  queryKeys: string[][];
};

export type NotificationMessage = {
  type: "notification";
  message: string;
};

export type SocketMessage = QueryMessage | NotificationMessage;

export const isQueryMessage = (
  message: SocketMessage
): message is QueryMessage => {
  return message.type === "query";
};

export const isNotificationMessage = (
  message: SocketMessage
): message is NotificationMessage => {
  return message.type === "notification";
};
