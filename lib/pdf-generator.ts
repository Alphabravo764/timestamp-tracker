import type { Shift, LocationPoint } from "./shift-types";
import { generateStaticMapUrl } from "./google-maps";

// Format duration from shift
const formatDuration = (shift: Shift): string => {
  const start = new Date(shift.startTime).getTime();
  const end = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

// Calculate distance between locations
const calculateDistance = (locations: LocationPoint[]): number => {
  if (locations.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < locations.length; i++) {
    const lat1 = locations[i - 1].latitude;
    const lon1 = locations[i - 1].longitude;
    const lat2 = locations[i].latitude;
    const lon2 = locations[i].longitude;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
};

// Generate HTML report with Google Maps trail
export const generatePDFReport = (shift: Shift): string => {
  const duration = formatDuration(shift);
  const startDate = new Date(shift.startTime).toLocaleString();
  const endDate = shift.endTime ? new Date(shift.endTime).toLocaleString() : "In Progress";
  const distance = calculateDistance(shift.locations).toFixed(2);
  
  // Generate Google Maps static image with trail
  const mapUrl = shift.locations.length > 0 ? generateStaticMapUrl(shift.locations, 700, 350) : "";
  
  // Get addresses
  const startAddress = shift.locations[0]?.address || "Unknown";
  const endAddress = shift.locations.length > 1 
    ? shift.locations[shift.locations.length - 1]?.address || "Unknown"
    : startAddress;

  // Build photos HTML
  let photosHtml = "";
  if (shift.photos.length > 0) {
    const photoItems = shift.photos.map((photo, index) => `
      <div class="photo-card">
        <img src="${photo.uri}" alt="Photo ${index + 1}" onerror="this.style.display='none'" />
        <div class="photo-info">
          <div class="photo-time">${new Date(photo.timestamp).toLocaleString()}</div>
          ${photo.address ? `<div class="photo-address">📍 ${photo.address}</div>` : ""}
        </div>
      </div>
    `).join("");
    
    photosHtml = `
      <div class="section">
        <h2>📷 Photo Evidence (${shift.photos.length})</h2>
        <div class="photos-grid">${photoItems}</div>
      </div>
    `;
  }

  // Build notes HTML
  let notesHtml = "";
  if (shift.notes && shift.notes.length > 0) {
    const noteItems = shift.notes.map((note) => `
      <div class="note-item">
        <div class="note-time">${new Date(note.timestamp).toLocaleTimeString()}</div>
        <div class="note-text">${note.text}</div>
      </div>
    `).join("");
    
    notesHtml = `
      <div class="section">
        <h2>📝 Notes (${shift.notes.length})</h2>
        <div class="notes-list">${noteItems}</div>
      </div>
    `;
  }

  // Build locations HTML
  let locationsHtml = "";
  if (shift.locations.length > 0) {
    const locationItems = shift.locations.map((loc, index) => {
      const isStart = index === 0;
      const isEnd = index === shift.locations.length - 1;
      let label = `Point ${index + 1}`;
      let className = "";
      if (isStart) { label = "START"; className = "start"; }
      else if (isEnd) { label = shift.isActive ? "CURRENT" : "END"; className = "end"; }
      
      return `
        <div class="location-item ${className}">
          <div class="location-marker"></div>
          <div class="location-content">
            <span class="location-label">${label}</span>
            <span class="location-time">${new Date(loc.timestamp).toLocaleTimeString()}</span>
            <div class="location-coords">${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}</div>
            ${loc.address ? `<div class="location-address">${loc.address}</div>` : ""}
          </div>
        </div>
      `;
    }).join("");
    
    locationsHtml = `
      <div class="section">
        <h2>🗺️ Location Timeline (${shift.locations.length} points)</h2>
        <div class="location-timeline">${locationItems}</div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shift Report - ${shift.siteName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f1f5f9;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0a7ea4 0%, #0891b2 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
    .header .staff { font-size: 18px; opacity: 0.9; }
    .header .pair-code {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 6px 16px;
      border-radius: 20px;
      font-family: monospace;
      font-size: 14px;
      margin-top: 16px;
    }
    .header .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
    .header .status.completed { background: #22c55e; }
    .header .status.active { background: #f59e0b; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid #e2e8f0;
    }
    .stat {
      padding: 20px;
      text-align: center;
      border-right: 1px solid #e2e8f0;
    }
    .stat:last-child { border-right: none; }
    .stat-value { font-size: 28px; font-weight: 700; color: #0a7ea4; }
    .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .section {
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    .section:last-child { border-bottom: none; }
    .section h2 {
      font-size: 18px;
      color: #0f172a;
      margin-bottom: 16px;
    }
    .map-container {
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 16px;
    }
    .map-container img {
      width: 100%;
      height: auto;
      display: block;
    }
    .map-legend {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #64748b;
      margin-top: 12px;
    }
    .map-legend span { display: flex; align-items: center; gap: 6px; }
    .map-legend .dot { width: 12px; height: 12px; border-radius: 50%; }
    .map-legend .dot.green { background: #22c55e; }
    .map-legend .dot.red { background: #ef4444; }
    .map-legend .dot.blue { background: #0a7ea4; width: 24px; height: 4px; border-radius: 2px; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-item {
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 8px;
    }
    .info-item .label { font-size: 12px; color: #64748b; }
    .info-item .value { font-size: 14px; font-weight: 500; color: #1e293b; }
    .location-timeline {
      position: relative;
      padding-left: 28px;
    }
    .location-timeline::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e2e8f0;
    }
    .location-item {
      position: relative;
      padding: 12px 0;
      display: flex;
      align-items: flex-start;
    }
    .location-marker {
      position: absolute;
      left: -24px;
      top: 16px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #94a3b8;
      border: 3px solid white;
      box-shadow: 0 0 0 2px #94a3b8;
    }
    .location-item.start .location-marker { background: #22c55e; box-shadow: 0 0 0 2px #22c55e; }
    .location-item.end .location-marker { background: #ef4444; box-shadow: 0 0 0 2px #ef4444; }
    .location-content { flex: 1; }
    .location-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-right: 8px;
    }
    .location-item.start .location-label { color: #22c55e; }
    .location-item.end .location-label { color: #ef4444; }
    .location-time { font-size: 12px; color: #94a3b8; }
    .location-coords { font-family: monospace; font-size: 13px; color: #475569; }
    .location-address { font-size: 14px; color: #1e293b; margin-top: 2px; }
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .photo-card {
      background: #f8fafc;
      border-radius: 8px;
      overflow: hidden;
    }
    .photo-card img {
      width: 100%;
      height: 140px;
      object-fit: cover;
    }
    .photo-info { padding: 10px; }
    .photo-time { font-size: 12px; font-weight: 500; color: #1e293b; }
    .photo-address { font-size: 11px; color: #64748b; margin-top: 2px; }
    .notes-list { display: flex; flex-direction: column; gap: 12px; }
    .note-item { background: #f8fafc; padding: 12px 16px; border-radius: 8px; border-left: 3px solid #0a7ea4; }
    .note-time { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .note-text { font-size: 14px; color: #1e293b; line-height: 1.5; }
    .footer {
      padding: 20px;
      text-align: center;
      background: #f8fafc;
      color: #64748b;
      font-size: 12px;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
    @media (max-width: 600px) {
      .stats { grid-template-columns: repeat(2, 1fr); }
      .info-grid { grid-template-columns: 1fr; }
      .photos-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${shift.siteName}</h1>
      <div class="staff">${shift.staffName}</div>
      <div>
        <span class="pair-code">Code: ${shift.pairCode}</span>
        <span class="status ${shift.isActive ? 'active' : 'completed'}">
          ${shift.isActive ? '● ACTIVE' : '✓ COMPLETED'}
        </span>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${duration}</div>
        <div class="stat-label">Duration</div>
      </div>
      <div class="stat">
        <div class="stat-value">${shift.photos.length}</div>
        <div class="stat-label">Photos</div>
      </div>
      <div class="stat">
        <div class="stat-value">${shift.locations.length}</div>
        <div class="stat-label">Locations</div>
      </div>
      <div class="stat">
        <div class="stat-value">${distance}</div>
        <div class="stat-label">km Traveled</div>
      </div>
    </div>

    <div class="section">
      <h2>📋 Shift Details</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Start Time</div>
          <div class="value">${startDate}</div>
        </div>
        <div class="info-item">
          <div class="label">End Time</div>
          <div class="value">${endDate}</div>
        </div>
        <div class="info-item">
          <div class="label">Start Location</div>
          <div class="value">${startAddress}</div>
        </div>
        <div class="info-item">
          <div class="label">End Location</div>
          <div class="value">${endAddress}</div>
        </div>
      </div>
    </div>

    ${mapUrl ? `
    <div class="section">
      <h2>📍 Location Trail Map</h2>
      <div class="map-container">
        <img src="${mapUrl}" alt="Trail Map" />
      </div>
      <div class="map-legend">
        <span><div class="dot green"></div> Start (S)</span>
        <span><div class="dot red"></div> End (E)</span>
        <span><div class="dot blue"></div> Trail Path</span>
      </div>
    </div>
    ` : ''}

    ${notesHtml}
    ${locationsHtml}
    ${photosHtml}

    <div class="footer">
      <p><strong>Timestamp Tracker</strong> - Shift Report</p>
      <p>Report ID: ${shift.id} | Generated: ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
};

// Open PDF report in new window
export const openPDFReport = (shift: Shift): void => {
  const html = generatePDFReport(shift);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};

// Get static map URL (for external use)
export const getStaticMapUrl = (locations: LocationPoint[]): string => {
  return generateStaticMapUrl(locations, 600, 300);
};

// Get trail map URL for interactive viewing
export const getTrailMapUrl = (locations: LocationPoint[]): string => {
  if (locations.length === 0) return "";
  if (locations.length === 1) {
    const loc = locations[0];
    return `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
  }
  
  // Create Google Maps directions URL
  const start = locations[0];
  const end = locations[locations.length - 1];
  return `https://www.google.com/maps/dir/${start.latitude},${start.longitude}/${end.latitude},${end.longitude}`;
};
