import { WebSocket } from "ws";

export const connections = new Map<string, Set<WebSocket>>();

export const addConnection = (id: string, ws: WebSocket) => {
  if (!connections.has(id)) {
    connections.set(id, new Set());
  }
  connections.get(id)?.add(ws);
};

export const removeConnection = (id: string, ws: WebSocket) => {
  connections.get(id)?.delete(ws);
};

export const removeAllConnections = (id: string) => {
  connections.delete(id);
};
