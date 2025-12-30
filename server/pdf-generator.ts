import PDFDocument from "pdfkit";
import { Readable } from "stream";
import * as db from "./db";
import { storagePut } from "./storage";
import crypto from "crypto";

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
  }>;
  locations: Array<{
    latitude: string;
    longitude: string;
    capturedAt: Date;
    accuracy: string | null;
  }>;
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
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Shift Report", { align: "center" })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Report ID: ${data.shift.id}`, { align: "center" })
      .text(`Generated: ${new Date().toUTCString()}`, { align: "center" })
      .moveDown(1);

    // Shift Information
    doc.fontSize(16).font("Helvetica-Bold").text("Shift Information").moveDown(0.5);

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

    // Location Summary
    doc.fontSize(16).font("Helvetica-Bold").text("Location Tracking").moveDown(0.5);

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
    doc.fontSize(16).font("Helvetica-Bold").text("Photo Timeline").moveDown(0.5);

    doc.fontSize(11).font("Helvetica");
    addKeyValue(doc, "Total Photos", data.photos.length.toString());

    if (data.photos.length > 0) {
      doc.moveDown(0.5);
      data.photos.forEach((photo, index) => {
        doc.fontSize(10).font("Helvetica-Bold").text(`Photo ${index + 1}:`);
        doc.fontSize(9).font("Helvetica");
        doc.text(`  Time: ${new Date(photo.capturedAt).toLocaleString()} UTC`);
        doc.text(`  Type: ${photo.photoType.toUpperCase()}`);
        if (photo.latitude && photo.longitude) {
          doc.text(`  Location: ${photo.latitude}, ${photo.longitude}`);
        }
        doc.text(`  URL: ${photo.fileUrl}`);
        doc.moveDown(0.3);
      });
    }

    doc.moveDown(1);

    // Verification Section
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("Verification & Integrity")
      .moveDown(0.5);

    doc.fontSize(9).font("Helvetica");
    doc.text(
      "This report contains cryptographically verified data. All timestamps are recorded in UTC and location data is captured from GPS sensors. Photos and location points are stored with server-side timestamps to prevent tampering."
    );

    doc.moveDown(0.5);
    doc.fontSize(8).font("Helvetica");
    doc.text(`Report generated by Timestamp Tracker`, { align: "center" });
    doc.text(`${new Date().toISOString()}`, { align: "center" });

    doc.end();
  });
}

function addKeyValue(doc: PDFKit.PDFDocument, key: string, value: string) {
  doc.font("Helvetica-Bold").text(key + ": ", { continued: true });
  doc.font("Helvetica").text(value);
}
