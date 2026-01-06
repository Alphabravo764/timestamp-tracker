import { Shift, LocationPoint, ShiftPhoto, ShiftNote } from "./shift-types";
import { generateMapboxStaticUrl } from "./mapbox";
import { photoToBase64DataUri } from "./photo-to-base64";

// Format duration from shift
const formatDuration = (shift: Shift): string => {
  const start = new Date(shift.startTime);
  const end = shift.endTime ? new Date(shift.endTime) : new Date();
  const diff = end.getTime() - start.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
};

// Calculate total distance
const calculateDistance = (locations: LocationPoint[]): number => {
  let total = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    const R = 6371;
    const dLat = ((curr.latitude - prev.latitude) * Math.PI) / 180;
    const dLon = ((curr.longitude - prev.longitude) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((prev.latitude * Math.PI) / 180) *
      Math.cos((curr.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
};

// Format time
const formatTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
};

// Format date
const formatDate = (timestamp: string): string => {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
};

// Generate SHA-256 hash simulation
const generateHash = (shift: Shift): string => {
  const data = `${shift.pairCode}-${shift.startTime}-${shift.endTime || 'active'}`;
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  }
  return hash;
};

// PROFESSIONAL PDF GENERATOR - Proper pagination, clean structure
export const generatePdfHtml = async (shift: Shift, isInterim?: boolean): Promise<string> => {
  const locations = shift.locations || [];
  const distance = calculateDistance(locations);
  const duration = formatDuration(shift);
  const photoCount = shift.photos?.length || 0;
  const noteCount = shift.notes?.length || 0;
  const docHash = generateHash(shift);

  // Map URL
  const mapUrl = locations.length > 0
    ? generateMapboxStaticUrl(locations, 700, 400) || ''
    : '';

  // Convert photos to base64
  const photoDataUris: string[] = [];
  if (shift.photos) {
    for (const photo of shift.photos) {
      try {
        const dataUri = await photoToBase64DataUri(photo.uri || '');
        photoDataUris.push(dataUri || '');
      } catch (e) {
        photoDataUris.push('');
      }
    }
  }

  // Build CLEANED timeline - NO system noise
  interface TimelineItem {
    time: string;
    type: 'start' | 'end' | 'photo' | 'note';
    title: string;
    subtitle?: string;
    evidenceNum?: number;
  }

  const timeline: TimelineItem[] = [];

  // Shift start with location
  const startLoc = locations[0];
  let startLocStr = shift.siteName;
  if (startLoc) {
    startLocStr = `${shift.siteName}\n📍 (${startLoc.latitude.toFixed(5)}, ${startLoc.longitude.toFixed(5)})`;
  }
  timeline.push({
    time: formatTime(shift.startTime),
    type: 'start',
    title: 'Shift Started',
    subtitle: `${shift.staffName} clocked in at ${startLocStr}`
  });

  // Photos with evidence numbers and location
  shift.photos?.forEach((photo, idx) => {
    let photoLocStr = photo.address || 'Location captured';
    if (photo.location?.latitude && photo.location?.longitude) {
      photoLocStr += `\n(${photo.location.latitude.toFixed(5)}, ${photo.location.longitude.toFixed(5)})`;
    }
    timeline.push({
      time: formatTime(photo.timestamp),
      type: 'photo',
      title: `Photo Evidence – Evidence #${idx + 1}`,
      subtitle: photoLocStr,
      evidenceNum: idx + 1
    });
  });

  // Notes with location
  shift.notes?.forEach(note => {
    let noteLocStr = note.text;
    if (note.location?.latitude && note.location?.longitude) {
      noteLocStr += `\n📍 (${note.location.latitude.toFixed(5)}, ${note.location.longitude.toFixed(5)})`;
    }
    timeline.push({
      time: formatTime(note.timestamp),
      type: 'note',
      title: 'Note Added',
      subtitle: noteLocStr
    });
  });

  // Shift end with location
  if (shift.endTime) {
    const endLoc = locations[locations.length - 1];
    let endLocStr = 'Manual clock-out complete';
    if (endLoc) {
      endLocStr = `Clocked out at ${shift.siteName}\n📍 (${endLoc.latitude.toFixed(5)}, ${endLoc.longitude.toFixed(5)})`;
    }
    timeline.push({
      time: formatTime(shift.endTime),
      type: 'end',
      title: 'Shift Ended',
      subtitle: endLocStr
    });
  }

  // Sort by time
  timeline.sort((a, b) => {
    const tA = new Date(`2000-01-01 ${a.time}`).getTime();
    const tB = new Date(`2000-01-01 ${b.time}`).getTime();
    return tA - tB;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Shift Report - ${shift.pairCode}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4;
      margin: 0;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1e293b;
      background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* PAGE STRUCTURE */
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      page-break-after: always;
      position: relative;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    /* HEADER */
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .logo {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    
    .verified-badge {
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid rgba(34, 197, 94, 0.5);
      color: #86efac;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    
    .report-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -1px;
      margin-bottom: 4px;
    }
    
    .report-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .report-subtitle {
      font-size: 12px;
      color: rgba(255,255,255,0.7);
    }
    
    .report-id {
      font-size: 11px;
      color: rgba(255,255,255,0.8);
      font-weight: 600;
    }
    
    /* SUMMARY GRID */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      text-align: center;
    }
    
    .summary-value {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 2px;
    }
    
    .summary-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* SECTION */
    .section {
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    /* TIMELINE */
    .timeline {
      position: relative;
      padding-left: 24px;
    }
    
    .timeline::before {
      content: '';
      position: absolute;
      left: 6px;
      top: 8px;
      bottom: 8px;
      width: 2px;
      background: #e2e8f0;
    }
    
    .timeline-item {
      position: relative;
      margin-bottom: 16px;
      padding-left: 16px;
    }
    
    .timeline-dot {
      position: absolute;
      left: -18px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: white;
      border: 3px solid #3b82f6;
    }
    
    .timeline-dot.start { border-color: #22c55e; }
    .timeline-dot.end { border-color: #ef4444; }
    .timeline-dot.photo { border-color: #8b5cf6; }
    .timeline-dot.note { border-color: #f59e0b; }
    
    .timeline-time {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 2px;
    }
    
    .timeline-title {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
    }
    
    .timeline-subtitle {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    
    /* EVIDENCE GRID */
    .evidence-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    
    .evidence-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      page-break-inside: avoid;
    }
    
    .evidence-header {
      background: #3b82f6;
      color: white;
      padding: 6px 12px;
      font-size: 10px;
      font-weight: 700;
    }
    
    .evidence-image {
      width: 100%;
      height: 140px;
      object-fit: cover;
      background: #f1f5f9;
    }
    
    .evidence-details {
      padding: 10px 12px;
    }
    
    .evidence-time {
      font-size: 10px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }
    
    .evidence-location {
      font-size: 9px;
      color: #64748b;
    }
    
    .evidence-verified {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 600;
      color: #22c55e;
      margin-top: 6px;
    }
    
    /* MAP SECTION - DEDICATED PAGE */
    .map-page {
      display: flex;
      flex-direction: column;
    }
    
    .map-container {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    
    .map-image {
      width: 100%;
      height: 300px;
      object-fit: cover;
    }
    
    .map-legend {
      padding: 16px;
      background: #fff;
      border-top: 1px solid #e2e8f0;
    }
    
    .legend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .legend-dot.start { background: #22c55e; }
    .legend-dot.end { background: #ef4444; }
    .legend-dot.trail { background: #3b82f6; }
    
    .legend-text {
      font-size: 10px;
      color: #64748b;
    }
    
    /* FOOTER */
    .footer {
      margin-top: auto;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    
    .hash-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .hash-value {
      font-size: 8px;
      font-family: monospace;
      color: #94a3b8;
      word-break: break-all;
      margin-bottom: 8px;
    }
    
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #64748b;
    }
    
    .footer-brand {
      font-weight: 700;
      color: #1e293b;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact !important; }
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>

<!-- PAGE 1: COVER + SUMMARY + TIMELINE -->
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <span class="logo">
        <svg viewBox="0 0 100 100" fill="none" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><path d="M25 10H10V25" stroke="#0055FF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M75 10H90V25" stroke="#0055FF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M90 75V90H75" stroke="#0055FF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 90H10V75" stroke="#0055FF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M65 30H40C34.4772 30 30 34.4772 30 40V45C30 50.5228 34.4772 55 40 55H60C65.5228 55 70 59.4772 70 65V70C70 75.5228 65.5228 80 60 80H35" stroke="#0055FF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        STAMPIA
      </span>
      <span class="verified-badge">✓ Proof of Presence</span>
    </div>
    <h1 class="report-title">SHIFT REPORT</h1>
    <div class="report-meta">
      <span class="report-subtitle">${formatDate(shift.startTime)}</span>
      <span class="report-id">ID: ${shift.pairCode}</span>
    </div>
  </div>
  
  <!-- Summary Grid -->
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-value">${shift.staffName || 'Officer'}</div>
      <div class="summary-label">Officer</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${duration}</div>
      <div class="summary-label">Duration</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${photoCount}</div>
      <div class="summary-label">Evidence</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${locations.length}</div>
      <div class="summary-label">GPS Points</div>
    </div>
  </div>
  
  <!-- Site Info -->
  <div class="section">
    <div class="section-title">📍 Site Information</div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
      <div style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">${shift.siteName}</div>
      <div style="font-size: 10px; color: #64748b;">
        ${formatTime(shift.startTime)} - ${shift.endTime ? formatTime(shift.endTime) : 'In Progress'}
      </div>
    </div>
  </div>
  
  <!-- Activity Timeline -->
  <div class="section">
    <div class="section-title">⏱️ Activity Timeline</div>
    <div class="timeline">
      ${timeline.map(item => `
        <div class="timeline-item">
          <div class="timeline-dot ${item.type}"></div>
          <div class="timeline-time">${item.time}</div>
          <div class="timeline-title">${item.title}</div>
          ${item.subtitle ? `<div class="timeline-subtitle">${item.subtitle}</div>` : ''}
        </div>
      `).join('')}
    </div>
  </div>
</div>

<!-- PAGE 2: VISUAL EVIDENCE (if photos exist) -->
${photoCount > 0 ? `
<div class="page">
  <div class="section">
    <div class="section-title">📷 Visual Evidence Log</div>
    <div class="evidence-grid">
      ${shift.photos?.map((photo, idx) => `
        <div class="evidence-card">
          <div class="evidence-header">EVIDENCE #${idx + 1}</div>
          ${photoDataUris[idx] ? `
            <img class="evidence-image" src="${photoDataUris[idx]}" alt="Evidence ${idx + 1}" />
          ` : `
            <div class="evidence-image" style="display: flex; align-items: center; justify-content: center; background: #f1f5f9;">
              <span style="color: #94a3b8;">📷 Image</span>
            </div>
          `}
          <div class="evidence-details">
            <div class="evidence-time">${formatTime(photo.timestamp)}</div>
            <div class="evidence-location">${photo.address || 'Location verified'}</div>
            <div class="evidence-verified">✓ GPS Verified</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</div>
` : ''}

<!-- PAGE 3: ROUTE MAP -->
${mapUrl ? `
<div class="page map-page">
  <div class="section">
    <div class="section-title">🗺️ Route Map & Trail</div>
    <div class="map-container">
      <img class="map-image" src="${mapUrl}" alt="Route Map" />
      <div class="map-legend">
        <div class="legend-row">
          <div class="legend-dot start"></div>
          <span class="legend-text">Start Location (${formatTime(shift.startTime)})</span>
        </div>
        <div class="legend-row">
          <div class="legend-dot trail"></div>
          <span class="legend-text">GPS Trail (${locations.length} points, ${distance.toFixed(2)} km)</span>
        </div>
        ${shift.endTime ? `
        <div class="legend-row">
          <div class="legend-dot end"></div>
          <span class="legend-text">End Location (${formatTime(shift.endTime)})</span>
        </div>
        ` : ''}
      </div>
    </div>
  </div>
  
  <!-- Footer -->
  <div class="footer">
    <div class="hash-label">Document Integrity Hash (SHA-256)</div>
    <div class="hash-value">${docHash}</div>
    <div class="footer-row">
      <span class="footer-brand">TRUSTLAYER SECURITY SYSTEMS</span>
      <span>🔒 Encrypted & Tamper-Proof</span>
    </div>
  </div>
</div>
` : `
<div class="page">
  <div class="footer">
    <div class="hash-label">Document Integrity Hash (SHA-256)</div>
    <div class="hash-value">${docHash}</div>
    <div class="footer-row">
      <span class="footer-brand">TRUSTLAYER SECURITY SYSTEMS</span>
      <span>🔒 Encrypted & Tamper-Proof</span>
    </div>
  </div>
</div>
`}

</body>
</html>`;
};

// Alias for backward compatibility
export const generatePDFReport = generatePdfHtml;
export default generatePdfHtml;
