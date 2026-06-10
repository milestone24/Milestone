import { AuthService } from "@/auth";
import { Response, Request } from "express";
import type { Server } from "http";
import { parse } from "cookie";
import { WebSocketServer, WebSocket } from "ws";
import { addConnection } from "./connections";
import { SocketMessage } from "@shared/schema/socket";

export const applyWebsocket = (server: Server, authService: AuthService) => {
  const requireUser = authService.getAuthMiddlewares().requireUser;

  //const wss = new WebSocketServer({ server });
  const wss = new WebSocketServer({ clientTracking: false, noServer: true });

  wss.on("connection", function connection(ws, req) {
    ws.on("error", console.error);

    ws.on("message", function message(data) {
      console.log("received: %s", data);
    });

    // const o: SocketMessage = {
    //   entity: ["portfolio", "history", "graph"],
    //   id: "1",
    //   type: "query",
    // };

    const o: SocketMessage = {
      message: "Hello",
      type: "notification",
    };

    ws.send(JSON.stringify(o));
  });

  server.on("upgrade", (req, socket, head) => {
    const fakeRes = {
      writeHead: () => {},
      end: () => {},
    } as unknown as Response;

    req.cookies = parse(req.headers.cookie || "") as { [key: string]: string };

    requireUser(req as Request, fakeRes, (err) => {
      if (err) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        if (req.tenant?.userAccountId) {
          addConnection(req.tenant.userAccountId, ws);
        }
        //wss.emit("connection", ws, req);
      });
    });
  });
};
