import PDFDocument from "pdfkit";
import * as db from "./db";
import { storagePut } from "./storage";
import crypto from "crypto";
import https from "https";

// Mapbox token (same as lib/mapbox.ts)
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWJkdWxic2lhbDExMjIiLCJhIjoiY21qenJjZjN3NjhrejNlcXh0NTE2M3RhaCJ9.WKftvZP3RnQoncVDdDfBiw';

interface ShiftReportData {
  shift: {
    id: number;
    siteName: string;
    startTimeUtc: Date;
    endTimeUtc?: Date | null;
    durationMinutes?: number | null;
    status: string;
  };
  user: {
    name: string | null;
    email: string | null;
  };
  photos: Array<{
    id: number;
    fileUrl: string;
    capturedAt: Date;
    latitude: string | null;
    longitude: string | null;
    photoType: string;
    address?: string | null;
  }>;
  notes: Array<{
    id: number;
    content: string;
    capturedAt: Date;
    latitude: string | null;
    longitude: string | null;
    address?: string | null;
  }>;
  locations: Array<{
    latitude: string;
    longitude: string;
    capturedAt: Date;
    accuracy: string | null;
  }>;
}

/**
 * Generate static map URL with polytrail using Mapbox
 */
function generateMapboxStaticUrl(
  locations: { latitude: string; longitude: string }[],
  width: number = 600,
  height: number = 300
): string {
  if (locations.length === 0) {
    return "";
  }

  // Convert to numbers and filter valid points
  const numLocations = locations.map(loc => ({
    latitude: parseFloat(loc.latitude),
    longitude: parseFloat(loc.longitude)
  })).filter(loc =>
    !isNaN(loc.latitude) && !isNaN(loc.longitude) &&
    Math.abs(loc.latitude) <= 90 && Math.abs(loc.longitude) <= 180
  );

  if (numLocations.length === 0) {
    return "";
  }

  const start = numLocations[0];
  const end = numLocations[numLocations.length - 1];

  // Build overlays array
  const overlays: string[] = [];

  // Add polyline path if we have multiple points
  if (numLocations.length > 1) {
    // Sample points if too many (Mapbox URL length limit)
    const maxPoints = 50;
    const step = Math.max(1, Math.floor(numLocations.length / maxPoints));
    const sampledLocations = numLocations.filter((_, i) => i % step === 0 || i === numLocations.length - 1);

    // Use geojson overlay format for polyline
    const geoJson = encodeURIComponent(JSON.stringify({
      "type": "Feature",
      "properties": { "stroke": "#3b82f6", "stroke-width": 4, "stroke-opacity": 0.8 },
      "geometry": {
        "type": "LineString",
        "coordinates": sampledLocations.map(loc => [loc.longitude, loc.latitude])
      }
    }));

    overlays.push(`geojson(${geoJson})`);
  }

  // Add start marker (green pin)
  overlays.push(`pin-l-s+22c55e(${start.longitude.toFixed(5)},${start.latitude.toFixed(5)})`);

  // Add end marker (red pin) if different from start
  if (numLocations.length > 1) {
    overlays.push(`pin-l-e+ef4444(${end.longitude.toFixed(5)},${end.latitude.toFixed(5)})`);
  }

  // Join overlays with comma
  const overlayString = overlays.join(',');

  // Build URL with auto bounds and padding
  const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlayString}/auto/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}&padding=50`;

  return url;
}

/**
 * Reverse geocode using Mapbox
 */
async function reverseGeocodeMapbox(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,locality`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.features?.[0]?.place_name) {
            resolve(json.features[0].place_name);
          } else {
            resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
        } catch {
          resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      });
    }).on('error', () => {
      resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    });
  });
}

/**
 * Fetch image from URL and return as buffer
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : require('http');

    protocol.get(url, (res: any) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) {
          fetchImageBuffer(res.headers.location).then(resolve);
          return;
        }
      }

      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

export async function generateShiftPdf(shiftId: number): Promise<string> {
  // Fetch shift data
  const shift = await db.getShiftById(shiftId);
  if (!shift) {
    throw new Error("Shift not found");
  }

  const user = await db.getUserById(shift.userId);
  if (!user) {
    throw new Error("User not found");
  }

  const photos = await db.getShiftPhotos(shiftId);
  const locations = await db.getShiftLocations(shiftId);

  // Fetch notes if available
  let notes: any[] = [];
  try {
    notes = await (db as any).getShiftNotes?.(shiftId) || [];
  } catch {
    notes = [];
  }

  const reportData: ShiftReportData = {
    shift: {
      id: shift.id,
      siteName: shift.siteName,
      startTimeUtc: shift.startTimeUtc,
      endTimeUtc: shift.endTimeUtc,
      durationMinutes: shift.durationMinutes,
      status: shift.status,
    },
    user: {
      name: user.name,
      email: user.email,
    },
    photos: photos.map((p) => ({
      id: p.id,
      fileUrl: p.fileUrl,
      capturedAt: p.capturedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      photoType: p.photoType,
      address: (p as any).address || null,
    })),
    notes: notes.map((n: any) => ({
      id: n.id,
      content: n.content || n.text || '',
      capturedAt: n.capturedAt || n.createdAt,
      latitude: n.latitude,
      longitude: n.longitude,
      address: n.address || null,
    })),
    locations: locations.map((l) => ({
      latitude: l.latitude,
      longitude: l.longitude,
      capturedAt: l.capturedAt,
      accuracy: l.accuracy,
    })),
  };

  // Generate PDF
  const pdfBuffer = await createPdfDocument(reportData);

  // Calculate integrity hash
  const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  // Upload to storage
  const storageKey = `reports/shift-${shiftId}-${Date.now()}.pdf`;
  const { url } = await storagePut(storageKey, pdfBuffer, "application/pdf");

  // Save report record
  await db.createPdfReport({
    shiftId,
    pdfUrl: url,
    fileSize: pdfBuffer.length,
    integrityHash: hash,
  });

  return url;
}

async function createPdfDocument(data: ShiftReportData): Promise<Buffer> {
  // Pre-fetch map image
  const mapUrl = generateMapboxStaticUrl(data.locations, 500, 250);
  let mapImageBuffer: Buffer | null = null;

  if (mapUrl) {
    mapImageBuffer = await fetchImageBuffer(mapUrl);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header with branding
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("STAMPIA - Shift Report", { align: "center" })
      .moveDown(0.3);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor('#666666')
      .text("Proof of Presence", { align: "center" })
      .moveDown(0.5);

    doc.fillColor('#000000');
    doc
      .fontSize(9)
      .text(`Report ID: ${data.shift.id}`, { align: "center" })
      .text(`Generated: ${new Date().toUTCString()}`, { align: "center" })
      .text(`Source: Generated via Web Viewer`, { align: "center" })
      .moveDown(1);

    // Shift Information
    doc.fontSize(14).font("Helvetica-Bold").text("Shift Information").moveDown(0.5);

    doc.fontSize(11).font("Helvetica");
    addKeyValue(doc, "Staff Member", data.user.name || "N/A");
    addKeyValue(doc, "Site Location", data.shift.siteName);
    addKeyValue(doc, "Status", data.shift.status.toUpperCase());
    addKeyValue(
      doc,
      "Start Time",
      `${data.shift.startTimeUtc.toLocaleString()} UTC`
    );
    if (data.shift.endTimeUtc) {
      addKeyValue(
        doc,
        "End Time",
        `${new Date(data.shift.endTimeUtc).toLocaleString()} UTC`
      );
    }
    if (data.shift.durationMinutes) {
      const hours = Math.floor(data.shift.durationMinutes / 60);
      const minutes = data.shift.durationMinutes % 60;
      addKeyValue(doc, "Duration", `${hours}h ${minutes}m`);
    }

    doc.moveDown(1);

    // Route Map with Polytrail (if available)
    if (mapImageBuffer) {
      doc.fontSize(14).font("Helvetica-Bold").text("Route Map & GPS Trail").moveDown(0.5);

      try {
        doc.image(mapImageBuffer, {
          fit: [500, 250],
          align: 'center',
        });
        doc.moveDown(0.5);

        // Map legend
        doc.fontSize(9).font("Helvetica").fillColor('#666666');
        doc.text(`🟢 Start Location  |  🔴 End Location  |  🔵 GPS Trail (${data.locations.length} points)`);
        doc.fillColor('#000000');
      } catch (e) {
        doc.fontSize(10).font("Helvetica").text("Map image could not be loaded.");
      }

      doc.moveDown(1);
    }

    // Location Summary
    doc.fontSize(14).font("Helvetica-Bold").text("Location Tracking").moveDown(0.5);

    doc.fontSize(11).font("Helvetica");
    addKeyValue(doc, "Total Location Points", data.locations.length.toString());

    if (data.locations.length > 0) {
      const firstLocation = data.locations[0];
      const lastLocation = data.locations[data.locations.length - 1];

      if (firstLocation) {
        addKeyValue(
          doc,
          "Starting Location",
          `${firstLocation.latitude}, ${firstLocation.longitude}`
        );
      }
      if (lastLocation && data.locations.length > 1) {
        addKeyValue(
          doc,
          "Ending Location",
          `${lastLocation.latitude}, ${lastLocation.longitude}`
        );
      }
    }

    doc.moveDown(1);

    // Photo Timeline
    doc.fontSize(14).font("Helvetica-Bold").text("Photo Evidence").moveDown(0.5);

    doc.fontSize(11).font("Helvetica");
    addKeyValue(doc, "Total Photos", data.photos.length.toString());

    if (data.photos.length > 0) {
      doc.moveDown(0.5);
      data.photos.forEach((photo, index) => {
        doc.fontSize(10).font("Helvetica-Bold").text(`Photo ${index + 1}:`);
        doc.fontSize(9).font("Helvetica");
        doc.text(`  Time: ${new Date(photo.capturedAt).toLocaleString()} UTC`);
        doc.text(`  Type: ${photo.photoType.toUpperCase()}`);
        if (photo.address) {
          doc.text(`  Address: ${photo.address}`);
        } else if (photo.latitude && photo.longitude) {
          doc.text(`  Location: ${photo.latitude}, ${photo.longitude}`);
        }
        doc.moveDown(0.3);
      });
    }

    // Notes Section (if any)
    if (data.notes.length > 0) {
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica-Bold").text("Notes").moveDown(0.5);

      doc.fontSize(11).font("Helvetica");
      addKeyValue(doc, "Total Notes", data.notes.length.toString());

      doc.moveDown(0.5);
      data.notes.forEach((note, index) => {
        doc.fontSize(10).font("Helvetica-Bold").text(`Note ${index + 1}:`);
        doc.fontSize(9).font("Helvetica");
        doc.text(`  Time: ${new Date(note.capturedAt).toLocaleString()} UTC`);
        doc.text(`  Content: ${note.content}`);
        if (note.address) {
          doc.text(`  Address: ${note.address}`);
        } else if (note.latitude && note.longitude) {
          doc.text(`  Location: ${note.latitude}, ${note.longitude}`);
        }
        doc.moveDown(0.3);
      });
    }

    doc.moveDown(1);

    // Verification Section
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Verification & Integrity")
      .moveDown(0.5);

    doc.fontSize(9).font("Helvetica");
    doc.text(
      "This report contains cryptographically verified data. All timestamps are recorded in UTC and location data is captured from GPS sensors. Photos and location points are stored with server-side timestamps to prevent tampering."
    );

    doc.moveDown(0.5);
    doc.fontSize(8).font("Helvetica");
    doc.text(`Report generated by STAMPIA via Web Viewer`, { align: "center" });
    doc.text(`${new Date().toISOString()}`, { align: "center" });
    doc.text(`stampia.tech`, { align: "center" });

    doc.end();
  });
}

function addKeyValue(doc: PDFKit.PDFDocument, key: string, value: string) {
  doc.font("Helvetica-Bold").text(key + ": ", { continued: true });
  doc.font("Helvetica").text(value);
}
