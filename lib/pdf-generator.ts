import type { Shift, LocationPoint } from "./shift-types";

// Generate static map URL showing trail
export const getStaticMapUrl = (locations: LocationPoint[]): string => {
  if (locations.length === 0) return "";
  
  // Use OpenStreetMap static map service
  const lats = locations.map(l => l.latitude);
  const lngs = locations.map(l => l.longitude);
  
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  
  // Calculate zoom level based on spread
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const maxSpread = Math.max(latSpread, lngSpread);
  
  let zoom = 15;
  if (maxSpread > 0.1) zoom = 12;
  else if (maxSpread > 0.05) zoom = 13;
  else if (maxSpread > 0.01) zoom = 14;
  
  // Create markers for start and end
  const start = locations[0];
  const end = locations[locations.length - 1];
  
  // Use staticmap.openstreetmap.de for static map
  const markers = `${start.latitude},${start.longitude},green|${end.latitude},${end.longitude},red`;
  
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=600x400&markers=${markers}`;
};

// Generate trail map URL for viewing
export const getTrailMapUrl = (locations: LocationPoint[]): string => {
  if (locations.length === 0) return "";
  if (locations.length === 1) {
    const loc = locations[0];
    return `https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}&zoom=17`;
  }
  
  const lats = locations.map(l => l.latitude);
  const lngs = locations.map(l => l.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padding = 0.002;
  
  return `https://www.openstreetmap.org/?bbox=${minLng - padding},${minLat - padding},${maxLng + padding},${maxLat + padding}&layer=mapnik`;
};

// Format duration
const formatDuration = (shift: Shift): string => {
  const start = new Date(shift.startTime).getTime();
  const end = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

// Generate HTML report that can be printed as PDF
export const generatePDFReport = (shift: Shift): string => {
  const duration = formatDuration(shift);
  const startDate = new Date(shift.startTime).toLocaleString();
  const endDate = shift.endTime ? new Date(shift.endTime).toLocaleString() : "In Progress";
  
  const mapUrl = getStaticMapUrl(shift.locations);
  const trailUrl = getTrailMapUrl(shift.locations);
  
  // Build location trail HTML
  let locationHtml = "";
  if (shift.locations.length > 0) {
    const first = shift.locations[0];
    const last = shift.locations[shift.locations.length - 1];
    
    locationHtml = `
      <div class="section">
        <h2>📍 Location Trail</h2>
        <div class="location-card start">
          <span class="label">START</span>
          <p class="coords">${first.latitude.toFixed(6)}, ${first.longitude.toFixed(6)}</p>
          <p class="time">${new Date(first.timestamp).toLocaleTimeString()}</p>
          ${first.address ? `<p class="address">${first.address}</p>` : ""}
        </div>
        <div class="location-card end">
          <span class="label">END</span>
          <p class="coords">${last.latitude.toFixed(6)}, ${last.longitude.toFixed(6)}</p>
          <p class="time">${new Date(last.timestamp).toLocaleTimeString()}</p>
          ${last.address ? `<p class="address">${last.address}</p>` : ""}
        </div>
        <p class="count">${shift.locations.length} location points recorded</p>
        ${mapUrl ? `<img src="${mapUrl}" alt="Trail Map" class="map-image" />` : ""}
        <a href="${trailUrl}" target="_blank" class="map-link">View Interactive Trail Map →</a>
      </div>
    `;
  }
  
  // Build photos HTML
  let photosHtml = "";
  if (shift.photos.length > 0) {
    const photoItems = shift.photos.map((photo, index) => `
      <div class="photo-item">
        <img src="${photo.uri}" alt="Photo ${index + 1}" />
        <div class="photo-info">
          <p class="photo-time">${new Date(photo.timestamp).toLocaleString()}</p>
          ${photo.address ? `<p class="photo-address">${photo.address}</p>` : ""}
          ${photo.location ? `<p class="photo-coords">${photo.location.latitude.toFixed(6)}, ${photo.location.longitude.toFixed(6)}</p>` : ""}
        </div>
      </div>
    `).join("");
    
    photosHtml = `
      <div class="section">
        <h2>📷 Photos (${shift.photos.length})</h2>
        <div class="photos-grid">
          ${photoItems}
        </div>
      </div>
    `;
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shift Report - ${shift.siteName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .report {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0a7ea4, #065a75);
      color: white;
      padding: 30px;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header .subtitle { opacity: 0.9; font-size: 16px; }
    .header .pair-code {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-family: monospace;
      font-size: 14px;
      margin-top: 12px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      background: #eee;
    }
    .stat {
      background: white;
      padding: 20px;
      text-align: center;
    }
    .stat-value { font-size: 28px; font-weight: bold; color: #0a7ea4; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .section {
      padding: 24px;
      border-top: 1px solid #eee;
    }
    .section h2 {
      font-size: 18px;
      margin-bottom: 16px;
      color: #333;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-label { color: #666; }
    .info-value { font-weight: 500; }
    .location-card {
      background: #f8f8f8;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      border-left: 4px solid #ccc;
    }
    .location-card.start { border-left-color: #22c55e; }
    .location-card.end { border-left-color: #ef4444; }
    .location-card .label {
      font-size: 11px;
      font-weight: bold;
      color: #666;
      text-transform: uppercase;
    }
    .location-card .coords { font-family: monospace; font-size: 14px; margin: 4px 0; }
    .location-card .time { font-size: 13px; color: #666; }
    .location-card .address { font-size: 14px; margin-top: 4px; }
    .count { font-size: 13px; color: #666; font-style: italic; margin: 12px 0; }
    .map-image {
      width: 100%;
      border-radius: 8px;
      margin: 16px 0;
    }
    .map-link {
      display: inline-block;
      color: #0a7ea4;
      text-decoration: none;
      font-weight: 500;
    }
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .photo-item {
      background: #f8f8f8;
      border-radius: 8px;
      overflow: hidden;
    }
    .photo-item img {
      width: 100%;
      height: 150px;
      object-fit: cover;
    }
    .photo-info {
      padding: 12px;
    }
    .photo-time { font-size: 13px; font-weight: 500; }
    .photo-address { font-size: 12px; color: #666; margin-top: 4px; }
    .photo-coords { font-size: 11px; color: #999; font-family: monospace; margin-top: 2px; }
    .footer {
      padding: 20px;
      text-align: center;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #eee;
    }
    @media print {
      body { background: white; padding: 0; }
      .report { box-shadow: none; }
      .map-link { display: none; }
    }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <h1>${shift.siteName}</h1>
      <p class="subtitle">${shift.staffName}</p>
      <span class="pair-code">Code: ${shift.pairCode}</span>
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
    </div>
    
    <div class="section">
      <h2>⏰ Shift Details</h2>
      <div class="info-row">
        <span class="info-label">Start Time</span>
        <span class="info-value">${startDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">End Time</span>
        <span class="info-value">${endDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Staff Name</span>
        <span class="info-value">${shift.staffName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Site Name</span>
        <span class="info-value">${shift.siteName}</span>
      </div>
    </div>
    
    ${locationHtml}
    ${photosHtml}
    
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>Timestamp Camera App</p>
    </div>
  </div>
</body>
</html>
  `;
};

// Open PDF report in new window (for printing/saving)
export const openPDFReport = (shift: Shift): void => {
  const html = generatePDFReport(shift);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};
