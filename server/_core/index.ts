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

  // In-memory storage for live shift data (for demo purposes)
  // In production, this would use Redis or database
  const liveShifts = new Map<string, any>();

  // Sync API endpoints for live viewing
  app.post("/api/sync/shift", (req, res) => {
    const { pairCode, ...shiftData } = req.body;
    if (!pairCode) {
      return res.status(400).json({ error: "pairCode required" });
    }
    liveShifts.set(pairCode, {
      ...shiftData,
      pairCode,
      locations: [],
      photos: [],
      notes: [],
      isActive: true,
      lastUpdated: new Date().toISOString(),
    });
    res.json({ success: true });
  });

  app.post("/api/sync/location", (req, res) => {
    const { pairCode, ...locationData } = req.body;
    const shift = liveShifts.get(pairCode);
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    shift.locations.push(locationData);
    shift.lastUpdated = new Date().toISOString();
    res.json({ success: true });
  });

  app.post("/api/sync/photo", (req, res) => {
    const { pairCode, ...photoData } = req.body;
    const shift = liveShifts.get(pairCode);
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    shift.photos.push(photoData);
    shift.lastUpdated = new Date().toISOString();
    res.json({ success: true });
  });

  app.post("/api/sync/note", (req, res) => {
    const { pairCode, ...noteData } = req.body;
    const shift = liveShifts.get(pairCode);
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    shift.notes.push(noteData);
    shift.lastUpdated = new Date().toISOString();
    res.json({ success: true });
  });

  app.post("/api/sync/shift-end", (req, res) => {
    const { pairCode, endTime, endLocation } = req.body;
    const shift = liveShifts.get(pairCode);
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    shift.isActive = false;
    shift.endTime = endTime;
    shift.endLocation = endLocation;
    shift.lastUpdated = new Date().toISOString();
    res.json({ success: true });
  });

  app.get("/api/sync/shift/:pairCode", (req, res) => {
    const { pairCode } = req.params;
    const shift = liveShifts.get(pairCode) || liveShifts.get(pairCode.toUpperCase());
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    res.json(shift);
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
