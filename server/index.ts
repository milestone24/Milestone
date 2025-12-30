import express, { type Request, Response, NextFunction, Router } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import cookieParser from "cookie-parser";
import { validateAuthEnvVars } from "./utils/time";
import authService from "./services/auth";
import { ping } from "./db";
import http from "http";
import helmet from "helmet";
import { applyWebsocket } from "./sockets/primary";
import semver from "semver";
import { initUpdateChain } from "./services/distributed/chain";
import { initQueueNotifications } from "./services/distributed/notification";

const app = express();

// Validate environment variables
validateAuthEnvVars();

// Basic middleware
// app.use(helmet({
//   //TODO Configure
// }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || "your-cookie-secret"));

// Serve static files from public directory (needed for manifest.json and service worker)
app.use(express.static(path.join(process.cwd(), "public")));

// app.use((req, res, next) => {
//   const start = Date.now();
//   const path = req.path;
//   let capturedJsonResponse: Record<string, any> | undefined = undefined;

//   const originalResJson = res.json;
//   res.json = function (bodyJson, ...args) {
//     capturedJsonResponse = bodyJson;
//     return originalResJson.apply(res, [bodyJson, ...args]);
//   };

//   res.on("finish", () => {
//     const duration = Date.now() - start;
//     if (path.startsWith("/api")) {
//       let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
//       if (capturedJsonResponse) {
//         logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
//       }

//       if (logLine.length > 80) {
//         logLine = logLine.slice(0, 79) + "…";
//       }

//       log(logLine);
//     }
//   });

//   next();
// });

// Error handling middleware

(async () => {
  const requiredVersion = "24.0.0";

  if (!semver.gt(process.version, requiredVersion)) {
    console.error(`Error: Incompatible Node.js version detected.`);
    console.error(
      `Your version is ${process.version}. This app requires Node.js v${requiredVersion} or later.`
    );
    process.exit(1); // Exit with a failure code
  }
  app.use("/api", await registerRoutes(Router(), authService));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  //Dont allow undhandled apiu route requests to follow through
  app.use("/api", (req, res) => {
    console.log("Unhandled API route request:", req.path);
    return res.status(404).json({ message: "Not Found" });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Error in API route:", err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite or static serving last
  if (app.get("env") === "development") {
    await setupVite(app);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;

  try {
    await ping();
    const server = app.listen(
      Number(port),
      "0.0.0.0",
      /**
       * The express docs for version 5 say this this error is given now but not in type decalration
       * To test
       */
      /**@ts-ignore**/
      (error: any) => {
        if (error) {
          console.error("Error starting server:", error);
        }
        log(`serving on port ${port}`);
      }
    );

    // Create a new HTTP server (wsServer) for websockets only
    //const wsServer = http.createServer();

    // Start listening on a separate port for websocket clients (e.g., 5002)
    // const wsPort = process.env.WS_PORT || 5002;
    // wsServer.listen(Number(wsPort), "0.0.0.0", () => {
    //   log(`WebSocket server listening on port ${wsPort}`);
    // });

    // Attach the websocket handler to the new HTTP server
    //applyWebsocket(wsServer, authService);

    applyWebsocket(server, authService);
    initUpdateChain();
    initQueueNotifications();
  } catch (error) {
    console.log("Database ping failed:", error);
  }
})();
