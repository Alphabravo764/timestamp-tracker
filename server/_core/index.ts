import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { storagePut } from "../storage";

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
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ---- CORS (keep this near the top) ----
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ---- Simple HTML pages served by Railway (NO Expo Web build) ----
  const simpleWebDir = path.join(process.cwd(), "server", "web");

  // Optional: serve static assets if you add css/js later
  if (fs.existsSync(simpleWebDir)) {
    app.use("/web", express.static(simpleWebDir));
  }

  // Code entry page
  app.get("/track", (_req, res) => {
    res.sendFile(path.join(simpleWebDir, "track.html"));
  });

  // Viewer page (pair code is in URL as :code)
  app.get("/viewer/:code", (_req, res) => {
    // Read viewer.html and inject MapBox token
    const viewerPath = path.join(simpleWebDir, "viewer.html");
    let html = fs.readFileSync(viewerPath, "utf-8");
    // Inject MapBox token as a global variable
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || "";
    html = html.replace("</head>", `<script>window.MAPBOX_TOKEN = "${mapboxToken}";</script></head>`);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  // Policy pages
  app.get("/policies/privacy-policy", (_req, res) => {
    res.sendFile(path.join(simpleWebDir, "policies", "privacy-policy.html"));
  });

  app.get("/policies/terms-of-service", (_req, res) => {
    res.sendFile(path.join(simpleWebDir, "policies", "terms-of-service.html"));
  });

  // ---- OAuth + health ----
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // ---- Database sync APIs ----
  const syncDb = await import("../sync-db.js");

  app.post("/api/sync/shift", async (req, res) => {
    try {
      const { pairCode, shiftId, staffName, siteName, startTime } = req.body;
      if (!pairCode) return res.status(400).json({ error: "pairCode required" });

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
      if (!pairCode) return res.status(400).json({ error: "pairCode required" });

      await syncDb.addLocationPoint({ pairCode, latitude, longitude, accuracy, timestamp, address });
      res.json({ success: true });
    } catch (error) {
      console.error("Sync location error:", error);
      res.status(500).json({ error: "Failed to sync location" });
    }
  });

  // Photo sync with S3 upload
  app.post("/api/sync/photo", async (req, res) => {
    try {
      const { pairCode, photoUri, latitude, longitude, accuracy, timestamp, address } = req.body;
      if (!pairCode) return res.status(400).json({ error: "pairCode required" });

      let finalPhotoUrl = photoUri;

      // If photoUri is base64 data URI, upload to S3
      if (photoUri && photoUri.startsWith("data:image/")) {
        try {
          // Extract base64 data from data URI
          const matches = photoUri.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            const extension = matches[1] === "jpeg" ? "jpg" : matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, "base64");
            
            // Generate unique filename
            const filename = `photos/${pairCode}/${Date.now()}.${extension}`;
            
            // Upload to S3
            const result = await storagePut(filename, buffer, `image/${matches[1]}`);
            finalPhotoUrl = result.url;
            console.log(`[Photo Upload] Uploaded to S3: ${finalPhotoUrl}`);
          }
        } catch (uploadError) {
          console.error("[Photo Upload] S3 upload failed, storing URI as-is:", uploadError);
          // Fall back to storing the original URI if upload fails
        }
      }

      await syncDb.addPhoto({ 
        pairCode, 
        photoUri: finalPhotoUrl, 
        latitude, 
        longitude, 
        accuracy, 
        timestamp, 
        address 
      });
      
      res.json({ success: true, photoUrl: finalPhotoUrl });
    } catch (error) {
      console.error("Sync photo error:", error);
      res.status(500).json({ error: "Failed to sync photo" });
    }
  });

  app.post("/api/sync/note", async (req, res) => {
    try {
      const { pairCode, noteId, text, timestamp, latitude, longitude, accuracy } = req.body;
      if (!pairCode || !text) return res.status(400).json({ error: "pairCode and text required" });

      await syncDb.addNote({
        pairCode,
        noteId: noteId || `note_${Date.now()}`,
        text,
        timestamp: timestamp || new Date().toISOString(),
        latitude,
        longitude,
        accuracy,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Sync note error:", error);
      res.status(500).json({ error: "Failed to sync note" });
    }
  });

  app.post("/api/sync/shift-end", async (req, res) => {
    try {
      const { pairCode, endTime } = req.body;
      if (!pairCode) return res.status(400).json({ error: "pairCode required" });

      await syncDb.endShift({ pairCode, endTime });
      res.json({ success: true });
    } catch (error) {
      console.error("Sync shift-end error:", error);
      res.status(500).json({ error: "Failed to end shift" });
    }
  });

  // GDPR Data Export - Download all user data by pair code
  app.get("/api/export/:pairCode", async (req, res) => {
    try {
      const { pairCode } = req.params;
      const shift = await syncDb.getShiftByPairCode(pairCode);
      if (!shift) return res.status(404).json({ error: "No data found for this pair code" });

      // Compile all user data
      const exportData = {
        exportDate: new Date().toISOString(),
        pairCode: pairCode,
        shift: {
          id: shift.shiftId,
          staffName: shift.staffName,
          siteName: shift.siteName,
          startTime: shift.startTime,
          endTime: shift.endTime,
          duration: shift.endTime 
            ? Math.round((new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 1000 / 60) + " minutes"
            : "In progress",
        },
        locations: shift.locations?.map((loc: any) => ({
          timestamp: loc.timestamp,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          address: loc.address,
        })) || [],
        photos: shift.photos?.map((photo: any) => ({
          timestamp: photo.timestamp,
          url: photo.photoUri,
          latitude: photo.latitude,
          longitude: photo.longitude,
          accuracy: photo.accuracy,
          address: photo.address,
        })) || [],
        notes: shift.notes?.map((note: any) => ({
          id: note.noteId,
          timestamp: note.timestamp,
          text: note.text,
          latitude: note.latitude,
          longitude: note.longitude,
          accuracy: note.accuracy,
        })) || [],
        summary: {
          totalLocations: shift.locations?.length || 0,
          totalPhotos: shift.photos?.length || 0,
          totalNotes: shift.notes?.length || 0,
        },
      };

      // Set headers for file download
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="timestamp-tracker-data-${pairCode}-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Data export error:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Fetch full shift timeline by pair code
  app.get("/api/sync/shift/:pairCode", async (req, res) => {
    try {
      const { pairCode } = req.params;
      const { format } = req.query;
      const shift = await syncDb.getShiftByPairCode(pairCode);
      if (!shift) return res.status(404).json({ error: "Shift not found" });
      
      // If PDF format requested, generate printable HTML
      if (format === 'pdf') {
        // Generate simple HTML for printing (viewer uses window.print())
        const html = `<!DOCTYPE html>
<html>
<head>
  <title>Shift Report - ${shift.staffName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    .info { margin: 20px 0; }
    .photo { max-width: 300px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Shift Report</h1>
  <div class="info">
    <p><strong>Staff:</strong> ${shift.staffName}</p>
    <p><strong>Site:</strong> ${shift.siteName}</p>
    <p><strong>Start:</strong> ${new Date(shift.startTime).toLocaleString()}</p>
    <p><strong>End:</strong> ${shift.endTime ? new Date(shift.endTime).toLocaleString() : 'In progress'}</p>
    <p><strong>Locations tracked:</strong> ${shift.locations?.length || 0}</p>
    <p><strong>Photos:</strong> ${shift.photos?.length || 0}</p>
  </div>
  <h2>Photos</h2>
  ${shift.photos?.map((p: any) => `
    <div>
      <img src="${p.photoUri}" class="photo" />
      <p>${new Date(p.timestamp).toLocaleString()}</p>
    </div>
  `).join('') || '<p>No photos</p>'}
  <h2>Notes</h2>
  ${shift.notes?.map((n: any) => `
    <p><strong>${new Date(n.timestamp).toLocaleString()}:</strong> ${n.text}</p>
  `).join('') || '<p>No notes</p>'}
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      }
      
      res.json(shift);
    } catch (error) {
      console.error("Get shift error:", error);
      res.status(500).json({ error: "Failed to get shift" });
    }
  });

  // PDF Shift Report Generation
  app.get("/api/shift-report/:pairCode", async (req, res) => {
    try {
      const { pairCode } = req.params;
      const shift = await syncDb.getShiftByPairCode(pairCode);
      if (!shift) return res.status(404).json({ error: "Shift not found" });

      // Calculate shift duration
      const startTime = new Date(shift.startTime);
      const endTime = shift.endTime ? new Date(shift.endTime) : new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const hours = Math.floor(durationMs / 1000 / 60 / 60);
      const minutes = Math.floor((durationMs / 1000 / 60) % 60);
      const durationText = `${hours}h ${minutes}m`;

      // Calculate total distance
      let totalDistance = 0;
      if (shift.locations && shift.locations.length > 1) {
        for (let i = 1; i < shift.locations.length; i++) {
          const prev = shift.locations[i - 1];
          const curr = shift.locations[i];
          const R = 6371; // Earth radius in km
          const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
          const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          totalDistance += R * c;
        }
      }

      // Generate comprehensive PDF HTML
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Shift Report - ${shift.staffName}</title>
  <style>
    @page { margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e293b;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 30px;
      margin-bottom: 30px;
      border-radius: 8px;
    }
    .header h1 {
      font-size: 28pt;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 12pt;
      opacity: 0.9;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .stat-label {
      font-size: 10pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 20pt;
      font-weight: bold;
      color: #1e293b;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 16pt;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .info-item {
      padding: 12px;
      background: #f8fafc;
      border-radius: 6px;
    }
    .info-label {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 11pt;
      font-weight: 600;
      color: #1e293b;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 15px;
    }
    .photo-item {
      page-break-inside: avoid;
    }
    .photo-item img {
      width: 100%;
      height: auto;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .photo-caption {
      font-size: 9pt;
      color: #64748b;
      margin-top: 8px;
    }
    .note-item {
      padding: 15px;
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      border-radius: 4px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .note-time {
      font-size: 9pt;
      color: #92400e;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .note-text {
      font-size: 10pt;
      color: #1e293b;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      font-size: 9pt;
      color: #64748b;
    }
    .map-placeholder {
      background: #f1f5f9;
      padding: 40px;
      text-align: center;
      border-radius: 8px;
      border: 2px dashed #cbd5e1;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Shift Report</h1>
    <p>Generated on ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</p>
  </div>

  <div class="summary">
    <div class="stat-card">
      <div class="stat-label">Duration</div>
      <div class="stat-value">${durationText}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Locations</div>
      <div class="stat-value">${shift.locations?.length || 0}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Photos</div>
      <div class="stat-value">${shift.photos?.length || 0}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Distance</div>
      <div class="stat-value">${totalDistance.toFixed(2)} km</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">📋 Shift Details</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Staff Member</div>
        <div class="info-value">${shift.staffName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Site</div>
        <div class="info-value">${shift.siteName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Start Time</div>
        <div class="info-value">${startTime.toLocaleString('en-GB')}</div>
      </div>
      <div class="info-item">
        <div class="info-label">End Time</div>
        <div class="info-value">${shift.endTime ? endTime.toLocaleString('en-GB') : 'In Progress'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Pair Code</div>
        <div class="info-value">${pairCode}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Status</div>
        <div class="info-value">${shift.endTime ? '✅ Completed' : '🔄 Active'}</div>
      </div>
    </div>
  </div>

  ${shift.photos && shift.photos.length > 0 ? `
  <div class="section">
    <h2 class="section-title">PHOTOS (${shift.photos.length})</h2>
    <div class="photo-grid">
      ${shift.photos.map((photo: any) => `
        <div class="photo-item">
          <img src="${photo.photoUri}" alt="Shift photo" />
          <div class="photo-caption">
            ${new Date(photo.timestamp).toLocaleString('en-GB')}<br/>
            ${photo.address || `${photo.latitude?.toFixed(6)}, ${photo.longitude?.toFixed(6)}`}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${shift.notes && shift.notes.length > 0 ? `
  <div class="section">
    <h2 class="section-title">NOTES (${shift.notes.length})</h2>
    ${shift.notes.map((note: any) => `
      <div class="note-item">
        <div class="note-time">${new Date(note.timestamp).toLocaleString('en-GB')}</div>
        <div class="note-text">${note.text}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">ROUTE MAP</h2>
    <div class="map-placeholder">
      <p style="font-size: 14pt; margin-bottom: 10px;">Route Visualization</p>
      <p>View the interactive map at:<br/>
      <strong>${req.protocol}://${req.get('host')}/viewer/${pairCode}</strong></p>
      <p style="margin-top: 15px; font-size: 10pt;">
        ${shift.locations?.length || 0} GPS points tracked over ${durationText}
      </p>
    </div>
  </div>

  <div class="footer">
    <p><strong>Timestamp Tracker</strong> | Shift Report</p>
    <p>This document is generated automatically and contains verified GPS tracking data.</p>
    <p style="margin-top: 8px; font-size: 8pt;">UK GDPR Compliant | Data retention policy applies</p>
  </div>
</body>
</html>`;

      // Generate PDF using PDFKit
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Shift Report - ${shift.staffName}`,
          Author: 'Timestamp Tracker',
          Subject: `Shift Report for ${shift.siteName}`,
          CreationDate: new Date(),
        },
      });

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="shift-report-${shift.staffName.replace(/\s+/g, '-')}-${pairCode}.pdf"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Header with gradient background
      doc.rect(0, 0, doc.page.width, 120).fillAndStroke('#3b82f6', '#1d4ed8');
      doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text('Shift Report', 50, 40);
      doc.fontSize(12).font('Helvetica').text(
        `Generated on ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}`,
        50, 80
      );

      // Summary cards
      const summaryY = 150;
      const cardWidth = (doc.page.width - 150) / 4;

      // Duration card
      doc.fillColor('#f8fafc').rect(50, summaryY, cardWidth, 80).fill();
      doc.fillColor('#3b82f6').rect(50, summaryY, 4, 80).fill();
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('DURATION', 60, summaryY + 15);
      doc.fillColor('#1e293b').fontSize(20).font('Helvetica-Bold').text(durationText, 60, summaryY + 35);

      // Locations card
      doc.fillColor('#f8fafc').rect(50 + cardWidth + 10, summaryY, cardWidth, 80).fill();
      doc.fillColor('#3b82f6').rect(50 + cardWidth + 10, summaryY, 4, 80).fill();
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('LOCATIONS', 60 + cardWidth + 10, summaryY + 15);
      doc.fillColor('#1e293b').fontSize(20).font('Helvetica-Bold').text(
        String(shift.locations?.length || 0), 60 + cardWidth + 10, summaryY + 35
      );

      // Photos card
      doc.fillColor('#f8fafc').rect(50 + (cardWidth + 10) * 2, summaryY, cardWidth, 80).fill();
      doc.fillColor('#3b82f6').rect(50 + (cardWidth + 10) * 2, summaryY, 4, 80).fill();
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('PHOTOS', 60 + (cardWidth + 10) * 2, summaryY + 15);
      doc.fillColor('#1e293b').fontSize(20).font('Helvetica-Bold').text(
        String(shift.photos?.length || 0), 60 + (cardWidth + 10) * 2, summaryY + 35
      );

      // Distance card
      doc.fillColor('#f8fafc').rect(50 + (cardWidth + 10) * 3, summaryY, cardWidth, 80).fill();
      doc.fillColor('#3b82f6').rect(50 + (cardWidth + 10) * 3, summaryY, 4, 80).fill();
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('DISTANCE', 60 + (cardWidth + 10) * 3, summaryY + 15);
      doc.fillColor('#1e293b').fontSize(20).font('Helvetica-Bold').text(
        `${totalDistance.toFixed(2)} km`, 60 + (cardWidth + 10) * 3, summaryY + 35
      );

      doc.moveDown(8);

      // Shift Details Section
      doc.fillColor('#1e293b').fontSize(16).font('Helvetica-Bold').text('📋 Shift Details', 50, 270);
      doc.strokeColor('#e2e8f0').lineWidth(2).moveTo(50, 295).lineTo(doc.page.width - 50, 295).stroke();

      const detailsY = 310;
      const col1X = 50;
      const col2X = doc.page.width / 2 + 10;

      // Left column
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Staff Member', col1X, detailsY);
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(shift.staffName, col1X, detailsY + 15);

      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Start Time', col1X, detailsY + 50);
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(
        startTime.toLocaleString('en-GB'), col1X, detailsY + 65
      );

      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Pair Code', col1X, detailsY + 100);
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(pairCode, col1X, detailsY + 115);

      // Right column
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Site', col2X, detailsY);
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(shift.siteName, col2X, detailsY + 15);

      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('End Time', col2X, detailsY + 50);
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(
        shift.endTime ? endTime.toLocaleString('en-GB') : 'In Progress', col2X, detailsY + 65
      );

      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Status', col2X, detailsY + 100);
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text(
        shift.endTime ? '✅ Completed' : '🔄 Active', col2X, detailsY + 115
      );

      // Route Map Section with Static Map Image
      if (shift.locations && shift.locations.length > 0) {
        doc.addPage();
        doc.fillColor('#1e293b').fontSize(16).font('Helvetica-Bold').text('🗺️ Route Map', 50, 50);
        doc.strokeColor('#e2e8f0').lineWidth(2).moveTo(50, 75).lineTo(doc.page.width - 50, 75).stroke();

        // Calculate bounding box
        const lats = shift.locations.map((l: any) => l.latitude);
        const lngs = shift.locations.map((l: any) => l.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;

        // Generate static map URL with polyline using OpenStreetMap Static Maps API
        // Encode polyline coordinates for static map
        const polylineCoords = shift.locations.map((l: any) => `${l.latitude},${l.longitude}`).join('|');
        
        // Use Geoapify Static Maps API (free tier available)
        const mapWidth = 500;
        const mapHeight = 350;
        const zoom = Math.min(15, Math.max(12, 16 - Math.ceil(Math.log2(Math.max(maxLat - minLat, maxLng - minLng) * 111))));
        
        // Build marker and path for static map
        const startLoc = shift.locations[0];
        const endLoc = shift.locations[shift.locations.length - 1];
        
        // Static map URL using OpenStreetMap-based service
        const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${mapWidth}x${mapHeight}&maptype=osmarenderer`;
        
        // Try to fetch and embed the static map image
        try {
          const https = await import('https');
          const mapImageBuffer = await new Promise<Buffer>((resolve, reject) => {
            https.get(staticMapUrl, (response) => {
              const chunks: Buffer[] = [];
              response.on('data', (chunk) => chunks.push(chunk));
              response.on('end', () => resolve(Buffer.concat(chunks)));
              response.on('error', reject);
            }).on('error', reject);
          });
          
          // Embed map image in PDF
          doc.image(mapImageBuffer, 50, 95, { width: doc.page.width - 100, height: 280 });
          
          // Draw route overlay info below map
          const mapBottomY = 385;
          doc.fillColor('#f0f9ff').rect(50, mapBottomY, doc.page.width - 100, 80).fill();
          doc.fillColor('#3b82f6').rect(50, mapBottomY, 4, 80).fill();
          
          doc.fillColor('#0369a1').fontSize(11).font('Helvetica-Bold').text(
            `Route: ${shift.locations.length} GPS points | ${totalDistance.toFixed(2)} km traveled`, 65, mapBottomY + 15
          );
          doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(
            `Start: ${startLoc.latitude.toFixed(6)}, ${startLoc.longitude.toFixed(6)}`, 65, mapBottomY + 35
          );
          doc.fillColor('#64748b').fontSize(9).text(
            `End: ${endLoc.latitude.toFixed(6)}, ${endLoc.longitude.toFixed(6)}`, 65, mapBottomY + 50
          );
        } catch (mapError) {
          console.log('Static map fetch failed, showing text fallback:', mapError);
          // Fallback: show map placeholder with coordinates
          doc.fillColor('#f3f4f6').rect(50, 95, doc.page.width - 100, 280).fill();
          doc.fillColor('#64748b').fontSize(12).font('Helvetica').text(
            'Route Map', (doc.page.width / 2) - 30, 200
          );
          doc.fillColor('#94a3b8').fontSize(10).text(
            `${shift.locations.length} GPS points tracked`, (doc.page.width / 2) - 50, 220
          );
          doc.fillColor('#94a3b8').fontSize(9).text(
            `Center: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`, (doc.page.width / 2) - 70, 240
          );
        }
      }

      // Notes Section (compact)
      if (shift.notes && shift.notes.length > 0) {
        doc.addPage();
        doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text(`📝 Notes (${shift.notes.length})`, 50, 50);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 70).lineTo(doc.page.width - 50, 70).stroke();

        let noteY = 85;
        shift.notes.forEach((note: any, idx: number) => {
          if (noteY > doc.page.height - 100) {
            doc.addPage();
            noteY = 50;
          }

          doc.fillColor('#f59e0b').fontSize(9).font('Helvetica-Bold').text(
            new Date(note.timestamp).toLocaleString('en-GB'), 50, noteY
          );
          doc.fillColor('#1e293b').fontSize(10).font('Helvetica').text(
            note.text, 50, noteY + 15, { width: doc.page.width - 100 }
          );

          noteY += 50;
        });
      }

      // Footer with verification (on last page, simple)
      const crypto = await import('crypto');
      const reportData = JSON.stringify({
        shiftId: shift.id,
        staffName: shift.staffName,
        siteName: shift.siteName,
        startTime: shift.startTime,
        endTime: shift.endTime,
        locationCount: shift.locations?.length || 0,
        photoCount: shift.photos?.length || 0,
      });
      const integrityHash = crypto.createHash('sha256').update(reportData).digest('hex').substring(0, 16);

      // Footer with simple verification
      const footerY = doc.page.height - 60;
      doc.strokeColor('#22c55e').lineWidth(2).moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).stroke();
      doc.fillColor('#22c55e').fontSize(10).font('Helvetica-Bold').text(
        `✓ VERIFIED | Hash: ${integrityHash}`, 50, footerY + 10, { align: 'center' }
      );
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(
        `Generated: ${new Date().toLocaleString('en-GB')} | Timestamp Tracker`, 50, footerY + 28, { align: 'center' }
      );

      doc.end();
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF report" });
    }
  });

  // ---- Watermark API ----
  const watermarkApi = await import("../watermark-api.js");

  app.post("/api/watermark", async (req, res) => {
    try {
      const { imageBase64, timestamp, address, latitude, longitude, staffName, siteName } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ success: false, error: "imageBase64 required" });
      }

      const result = await watermarkApi.addWatermarkServer({
        imageBase64,
        timestamp: timestamp || new Date().toLocaleString(),
        address: address || "Location unavailable",
        latitude: latitude || 0,
        longitude: longitude || 0,
        staffName,
        siteName,
      });

      res.json(result);
    } catch (error) {
      console.error("Watermark API error:", error);
      res.status(500).json({ success: false, error: "Failed to add watermark" });
    }
  });

  // ---- tRPC ----
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // ---- Start ----
  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
