import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Import database sync functions
  const syncDb = await import("../sync-db.js");

  // Sync API endpoints for live viewing - now using database
  app.post("/api/sync/shift", async (req, res) => {
    try {
      const { pairCode, shiftId, staffName, siteName, startTime } = req.body;
      if (!pairCode) {
        return res.status(400).json({ error: "pairCode required" });
      }
      await syncDb.upsertShift({ pairCode, shiftId, staffName, siteName, startTime });
      res.json({ success: true });
    } catch (error) {
      console.error("Sync shift error:", error);
      res.status(500).json({ error: "Failed to sync shift" });
    }
  });

  app.post("/api/sync/location", async (req, res) => {
    try {
      const { pairCode, latitude, longitude, accuracy, timestamp, address } = req.body;
      if (!pairCode) {
        return res.status(400).json({ error: "pairCode required" });
      }
      await syncDb.addLocationPoint({ pairCode, latitude, longitude, accuracy, timestamp, address });
      res.json({ success: true });
    } catch (error) {
      console.error("Sync location error:", error);
      res.status(500).json({ error: "Failed to sync location" });
    }
  });

  app.post("/api/sync/photo", async (req, res) => {
    try {
      const { pairCode, photoUri, latitude, longitude, accuracy, timestamp, address } = req.body;
      if (!pairCode) {
        return res.status(400).json({ error: "pairCode required" });
      }
      await syncDb.addPhoto({ pairCode, photoUri, latitude, longitude, accuracy, timestamp, address });
      res.json({ success: true });
    } catch (error) {
      console.error("Sync photo error:", error);
      res.status(500).json({ error: "Failed to sync photo" });
    }
  });

  app.post("/api/sync/note", async (req, res) => {
    try {
      const { pairCode, text, timestamp } = req.body;
      if (!pairCode) {
        return res.status(400).json({ error: "pairCode required" });
      }
      // TODO: Implement note storage in database
      res.json({ success: true });
    } catch (error) {
      console.error("Sync note error:", error);
      res.status(500).json({ error: "Failed to sync note" });
    }
  });

  app.post("/api/sync/shift-end", async (req, res) => {
    try {
      const { pairCode, endTime } = req.body;
      if (!pairCode) {
        return res.status(400).json({ error: "pairCode required" });
      }
      await syncDb.endShift({ pairCode, endTime });
      res.json({ success: true });
    } catch (error) {
      console.error("Sync shift-end error:", error);
      res.status(500).json({ error: "Failed to end shift" });
    }
  });

  app.get("/api/sync/shift/:pairCode", async (req, res) => {
    try {
      const { pairCode } = req.params;
      const shift = await syncDb.getShiftByPairCode(pairCode);
      if (!shift) {
        return res.status(404).json({ error: "Shift not found" });
      }
      res.json(shift);
    } catch (error) {
      console.error("Get shift error:", error);
      res.status(500).json({ error: "Failed to get shift" });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
