import type { Shift, LocationPoint } from "./shift-types";
import { generateStaticMapUrlEncoded } from "./google-maps";
import { photoToBase64DataUri } from "./photo-to-base64";

// Batch reverse geocode locations that don't have addresses
const batchReverseGeocode = async (locations: LocationPoint[]): Promise<LocationPoint[]> => {
  const results: LocationPoint[] = [];
  
  for (const loc of locations) {
    // If already has a valid address, keep it
    if (loc.address && loc.address !== "Unknown location" && loc.address !== "Location unavailable") {
      results.push(loc);
      continue;
    }
    
    // Try to reverse geocode
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.latitude}&lon=${loc.longitude}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "TimestampCamera/1.0" } }
      );
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        const parts: string[] = [];
        
        // Build address: street, city, postcode
        if (addr.road || addr.street) parts.push(addr.road || addr.street);
        if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
        if (addr.postcode) parts.push(addr.postcode);
        
        const address = parts.length > 0 ? parts.join(", ") : data.display_name?.split(",").slice(0, 3).join(",") || "Unknown";
        results.push({ ...loc, address });
      } else {
        results.push(loc);
      }
      
      // Rate limit: wait 100ms between requests to respect Nominatim limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      console.log("Geocode error:", e);
      results.push(loc);
    }
  }
  
  return results;
};

// Format duration from shift
const formatDuration = (shift: Shift): string => {
  const start = new Date(shift.startTime);
  const end = shift.endTime ? new Date(shift.endTime) : new Date();
  const diff = end.getTime() - start.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Calculate total distance traveled
const calculateDistance = (locations: LocationPoint[]): number => {
  let total = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    const R = 6371; // Earth's radius in km
    const dLat = ((curr.latitude - prev.latitude) * Math.PI) / 180;
    const dLon = ((curr.longitude - prev.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((prev.latitude * Math.PI) / 180) *
        Math.cos((curr.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
};

// Format location for display - ALWAYS prefer address, show postcode prominently
const formatLocationDisplay = (loc: LocationPoint): string => {
  if (loc.address && loc.address !== "Unknown location" && loc.address !== "Location unavailable") {
    return loc.address;
  }
  // Fallback to coordinates only if no address
  return `Lat: ${loc.latitude.toFixed(5)}, Lng: ${loc.longitude.toFixed(5)}`;
};

// Format time for display
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-GB", { 
    hour: "2-digit", 
    minute: "2-digit",
    second: "2-digit"
  });
};

// Format date for display
const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
};

// Generate HTML report with Google Maps trail
export const generatePDFReport = async (shift: Shift, isInterim: boolean = false): Promise<string> => {
  const duration = formatDuration(shift);
  const startDate = formatDate(shift.startTime);
  const startTime = formatTime(shift.startTime);
  const endTime = shift.endTime ? formatTime(shift.endTime) : "In Progress";
  const distance = calculateDistance(shift.locations).toFixed(2);
  
  // Batch reverse geocode locations that don't have addresses
  const geocodedLocations = await batchReverseGeocode(shift.locations);
  
  // Update shift with geocoded locations for this report
  const shiftWithAddresses = { ...shift, locations: geocodedLocations };
  
  // Generate Google Maps static image with trail - high quality (1200x700 for better detail)
  const mapUrl = geocodedLocations.length > 0 
    ? generateStaticMapUrlEncoded(geocodedLocations, 1200, 700) 
    : "";
  
  // Get start and end addresses - MUST show address not coords
  const startLoc = geocodedLocations[0];
  const endLoc = geocodedLocations.length > 1 
    ? geocodedLocations[geocodedLocations.length - 1] 
    : startLoc;
  
  const startAddress = startLoc?.address || "Address not recorded";
  const endAddress = endLoc?.address || startAddress;

  // Build photos HTML with actual images - convert to base64 for PDF embedding
  let photosHtml = "";
  if (shift.photos.length > 0) {
    // Limit to 12 photos to prevent WebView memory issues
    const limitedPhotos = shift.photos.slice(0, 12);
    
    // Convert all photos to base64 data URIs
    const photoDataUris = await Promise.all(
      limitedPhotos.map(photo => photoToBase64DataUri(photo.uri))
    );
    
    const photoItems = limitedPhotos.map((photo, index) => {
      const photoTime = formatTime(photo.timestamp);
      const photoDate = formatDate(photo.timestamp);
      const photoAddress = photo.address || photo.location?.address || "Location not recorded";
      
      // Use the converted base64 data URI
      const dataUri = photoDataUris[index];
      const hasValidPhoto = dataUri && dataUri.startsWith('data:');
      
      const photoContent = hasValidPhoto 
        ? `<img src="${dataUri}" alt="Photo ${index + 1}" class="photo-image" />`
        : `<div class="photo-placeholder">
             <div class="photo-icon">📷</div>
             <div class="photo-number">Photo ${index + 1}</div>
           </div>`;
      
      return `
        <div class="photo-card">
          ${photoContent}
          <div class="photo-info">
            <div class="photo-time">🕐 ${photoDate} at ${photoTime}</div>
            <div class="photo-address">📍 ${photoAddress}</div>
          </div>
        </div>
      `;
    }).join("");
    
    const photoCountNote = shift.photos.length > 12 
      ? ` (showing first 12 of ${shift.photos.length})` 
      : "";
    
    photosHtml = `
      <div class="section">
        <h2>📷 Photo Evidence${photoCountNote}</h2>
        <div class="photos-grid">${photoItems}</div>
      </div>
    `;
  }

  // Build combined activity timeline with locations AND notes merged chronologically
  let activityHtml = "";
  if (geocodedLocations.length > 0 || (shift.notes && shift.notes.length > 0)) {
    // Create timeline events from locations and notes
    interface TimelineEvent {
      type: 'location' | 'note';
      timestamp: string;
      data: LocationPoint | { text: string };
    }
    
    const events: TimelineEvent[] = [];
    
    // Add significant locations to timeline
    const significantLocations = getSignificantLocations(geocodedLocations);
    significantLocations.forEach((loc) => {
      events.push({ type: 'location', timestamp: loc.timestamp, data: loc });
    });
    
    // Add notes to timeline
    if (shift.notes) {
      shift.notes.forEach((note) => {
        events.push({ type: 'note', timestamp: note.timestamp, data: { text: note.text } });
      });
    }
    
    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const activityItems = events.map((event, index) => {
      const time = formatTime(event.timestamp);
      
      if (event.type === 'note') {
        const note = event.data as { text: string };
        return `
          <div class="timeline-item note">
            <div class="timeline-marker">📝</div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-label">NOTE</span>
                <span class="timeline-time">${time}</span>
              </div>
              <div class="timeline-text">${note.text}</div>
            </div>
          </div>
        `;
      } else {
        const loc = event.data as LocationPoint;
        const isStart = index === 0 && event.type === 'location';
        const isEnd = index === events.length - 1 && event.type === 'location';
        
        let label = "LOCATION";
        let icon = "📍";
        let className = "";
        
        if (isStart) { label = "START"; icon = "🟢"; className = "start"; }
        else if (isEnd) { label = shift.isActive ? "CURRENT" : "END"; icon = shift.isActive ? "🟢" : "🔴"; className = "end"; }
        
        const locationDisplay = formatLocationDisplay(loc);
        
        return `
          <div class="timeline-item location ${className}">
            <div class="timeline-marker">${icon}</div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-label">${label}</span>
                <span class="timeline-time">${time}</span>
              </div>
              <div class="timeline-address">${locationDisplay}</div>
            </div>
          </div>
        `;
      }
    }).join("");
    
    const noteCount = shift.notes?.length || 0;
    const locationCount = significantLocations.length;
    
    activityHtml = `
      <div class="section">
        <h2>📊 Activity Timeline</h2>
        <p class="section-subtitle">${locationCount} locations, ${noteCount} notes</p>
        <div class="activity-timeline">${activityItems}</div>
      </div>
    `;
  }
  
  // Keep notesHtml empty since notes are now in activity timeline
  const notesHtml = "";
  const locationsHtml = "";

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
      background: #f8fafc;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0a7ea4 0%, #0891b2 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin-bottom: 8px; 
    }
    .header .site-name {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .header .staff { 
      font-size: 16px; 
      opacity: 0.9; 
    }
    .header .pair-code {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 6px 16px;
      border-radius: 20px;
      font-family: monospace;
      font-size: 14px;
      margin-top: 12px;
    }
    
    /* Interim banner */
    .interim-banner {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      color: #92400e;
      padding: 14px 24px;
      font-size: 15px;
      font-weight: 700;
      text-align: center;
      border-bottom: 2px solid #f59e0b;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 24px;
      background: #f1f5f9;
    }
    .summary-item {
      background: white;
      padding: 16px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .summary-item .value {
      font-size: 28px;
      font-weight: 700;
      color: #0a7ea4;
    }
    .summary-item .label {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-item {
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .info-item .label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-item .value {
      font-size: 15px;
      font-weight: 500;
      color: #1e293b;
      word-break: break-word;
    }
    
    .map-section {
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .map-section h2 {
      font-size: 18px;
      margin-bottom: 16px;
      color: #1e293b;
    }
    .map-container {
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    }
    .map-container img {
      width: 100%;
      height: auto;
      display: block;
    }
    .map-legend {
      display: flex;
      gap: 20px;
      margin-top: 12px;
      font-size: 13px;
      color: #64748b;
    }
    .map-legend span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .section {
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section h2 {
      font-size: 18px;
      margin-bottom: 16px;
      color: #1e293b;
    }
    .section-subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: -12px;
      margin-bottom: 16px;
    }
    
    .location-timeline {
      position: relative;
      padding-left: 40px;
    }
    .location-timeline::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, #22c55e, #0a7ea4, #ef4444);
    }
    .location-item {
      position: relative;
      margin-bottom: 20px;
      padding: 14px 16px;
      background: #f8fafc;
      border-radius: 10px;
      border-left: 3px solid #0a7ea4;
    }
    .location-item.start {
      border-left-color: #22c55e;
      background: #f0fdf4;
    }
    .location-item.end {
      border-left-color: #ef4444;
      background: #fef2f2;
    }
    .location-marker {
      position: absolute;
      left: -33px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 16px;
    }
    .location-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .location-label {
      font-weight: 600;
      font-size: 13px;
      color: #0a7ea4;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .location-item.start .location-label { color: #22c55e; }
    .location-item.end .location-label { color: #ef4444; }
    .location-time {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .location-address {
      font-size: 14px;
      color: #475569;
      line-height: 1.5;
    }
    
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .photo-card {
      background: #f8fafc;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .photo-image {
      width: 100%;
      height: 180px;
      object-fit: cover;
      display: block;
    }
    .photo-placeholder {
      height: 140px;
      background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #64748b;
    }
    .photo-icon {
      font-size: 36px;
      margin-bottom: 8px;
    }
    .photo-number {
      font-weight: 600;
      font-size: 14px;
    }
    .photo-info {
      padding: 12px;
    }
    .photo-time {
      font-size: 13px;
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .photo-address {
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
    
    /* Activity Timeline Styles */
    .activity-timeline {
      display: flex;
      flex-direction: column;
      gap: 0;
      position: relative;
      padding-left: 24px;
    }
    .activity-timeline::before {
      content: '';
      position: absolute;
      left: 11px;
      top: 20px;
      bottom: 20px;
      width: 2px;
      background: #e2e8f0;
    }
    .timeline-item {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      position: relative;
    }
    .timeline-marker {
      font-size: 16px;
      width: 24px;
      text-align: center;
      position: relative;
      z-index: 1;
      background: white;
    }
    .timeline-content {
      flex: 1;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 10px;
      border-left: 3px solid #0a7ea4;
    }
    .timeline-item.note .timeline-content {
      background: #fffbeb;
      border-left-color: #f59e0b;
    }
    .timeline-item.start .timeline-content {
      border-left-color: #22c55e;
    }
    .timeline-item.end .timeline-content {
      border-left-color: #ef4444;
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .timeline-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0a7ea4;
    }
    .timeline-item.note .timeline-label {
      color: #b45309;
    }
    .timeline-item.start .timeline-label {
      color: #16a34a;
    }
    .timeline-item.end .timeline-label {
      color: #dc2626;
    }
    .timeline-time {
      font-size: 12px;
      color: #64748b;
      font-family: monospace;
    }
    .timeline-address {
      font-size: 14px;
      color: #334155;
      line-height: 1.4;
    }
    .timeline-text {
      font-size: 14px;
      color: #78350f;
      line-height: 1.5;
    }
    
    .notes-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .note-item {
      padding: 14px;
      background: #fffbeb;
      border-radius: 10px;
      border-left: 3px solid #f59e0b;
    }
    .note-time {
      font-size: 12px;
      color: #92400e;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .note-text {
      font-size: 14px;
      color: #78350f;
      line-height: 1.5;
    }
    
    .footer {
      padding: 20px;
      text-align: center;
      background: #f1f5f9;
      font-size: 12px;
      color: #64748b;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${isInterim ? `
    <div class="interim-banner">
      ⚠️ INTERIM REPORT - Shift Still Active
    </div>
    ` : ''}
    <div class="header">
      <h1>📋 ${isInterim ? 'Interim ' : ''}Shift Report</h1>
      <div class="site-name">${shift.siteName}</div>
      <div class="staff">Staff: ${shift.staffName}</div>
      <div class="pair-code">Code: ${shift.pairCode}</div>
    </div>
    
    <div class="summary">
      <div class="summary-item">
        <div class="value">${duration}</div>
        <div class="label">Duration</div>
      </div>
      <div class="summary-item">
        <div class="value">${shift.locations.length}</div>
        <div class="label">Locations</div>
      </div>
      <div class="summary-item">
        <div class="value">${shift.photos.length}</div>
        <div class="label">Photos</div>
      </div>
      <div class="summary-item">
        <div class="value">${distance} km</div>
        <div class="label">Distance</div>
      </div>
    </div>
    
    <div class="info-grid">
      <div class="info-item">
        <div class="label">Date</div>
        <div class="value">${startDate}</div>
      </div>
      <div class="info-item">
        <div class="label">Time</div>
        <div class="value">${startTime} - ${endTime}</div>
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
    
    ${mapUrl ? `
    <div class="map-section">
      <h2>🗺️ Route Map</h2>
      <div class="map-container">
        <img src="${mapUrl}" alt="Route Map" />
      </div>
      <div class="map-legend">
        <span>🟢 Start Point</span>
        <span>🔴 End Point</span>
        <span>━━ Trail Path</span>
      </div>
    </div>
    ` : ""}
    
    ${activityHtml}
    ${photosHtml}
    
    <div class="footer">
      Generated on ${new Date().toLocaleString("en-GB")} • Timestamp Camera App
    </div>
  </div>
</body>
</html>`;
};

// Get significant locations (filter out nearby duplicates)
function getSignificantLocations(locations: LocationPoint[]): LocationPoint[] {
  if (locations.length <= 10) return locations;
  
  const significant: LocationPoint[] = [];
  const minDistance = 0.05; // 50 meters minimum between points
  
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    
    // Always include first and last
    if (i === 0 || i === locations.length - 1) {
      significant.push(loc);
      continue;
    }
    
    // Check distance from last significant point
    const lastSig = significant[significant.length - 1];
    const dist = getDistanceKm(lastSig, loc);
    
    // Include if moved more than minimum distance
    if (dist > minDistance) {
      significant.push(loc);
    }
  }
  
  // Ensure we have at least start and end
  if (significant.length < 2 && locations.length >= 2) {
    return [locations[0], locations[locations.length - 1]];
  }
  
  return significant;
}

// Calculate distance between two points in km
function getDistanceKm(p1: LocationPoint, p2: LocationPoint): number {
  const R = 6371;
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
