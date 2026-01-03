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

// Generate HTML report with Google Maps trail - NEW PROFESSIONAL TEMPLATE
export const generatePDFReport = async (shift: Shift, isInterim: boolean = false): Promise<string> => {
  const duration = formatDuration(shift);
  const startDate = formatDate(shift.startTime);
  const startTime = formatTime(shift.startTime);
  const endTime = shift.endTime ? formatTime(shift.endTime) : "In Progress";
  const distance = calculateDistance(shift.locations).toFixed(2);
  
  // Batch reverse geocode locations that don't have addresses
  const geocodedLocations = await batchReverseGeocode(shift.locations);
  
  // Generate Google Maps static image with trail - high quality
  const mapUrl = geocodedLocations.length > 0 
    ? generateStaticMapUrlEncoded(geocodedLocations, 1200, 700) 
    : "";
  
  // Get start and end addresses
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
      const photoAddress = photo.address || photo.location?.address || "Location not recorded";
      
      // Use the converted base64 data URI
      const dataUri = photoDataUris[index];
      const hasValidPhoto = dataUri && dataUri.startsWith('data:');
      
      return `
        <div class="photo-card">
          ${hasValidPhoto 
            ? `<img src="${dataUri}" alt="Photo ${index + 1}" class="photo-image" />`
            : `<div class="photo-placeholder">
                 <span class="photo-icon">📷</span>
                 <span>Photo ${index + 1}</span>
               </div>`
          }
          <div class="photo-meta">
            <div class="photo-time">${photoTime}</div>
            <div class="photo-address">${photoAddress}</div>
          </div>
        </div>
      `;
    }).join("");
    
    const photoCountNote = shift.photos.length > 12 
      ? ` (showing first 12 of ${shift.photos.length})` 
      : "";
    
    photosHtml = `
      <div class="section photo-section">
        <h2>📷 Photo Evidence${photoCountNote}</h2>
        <div class="photos-grid">${photoItems}</div>
      </div>
    `;
  }

  // Build combined activity timeline with locations AND notes merged chronologically
  let timelineHtml = "";
  if (geocodedLocations.length > 0 || (shift.notes && shift.notes.length > 0)) {
    interface TimelineEvent {
      type: 'location' | 'note' | 'photo';
      timestamp: string;
      data: LocationPoint | { text: string } | { index: number; address: string };
      isStart?: boolean;
      isEnd?: boolean;
    }
    
    const events: TimelineEvent[] = [];
    
    // Add significant locations to timeline
    const significantLocations = getSignificantLocations(geocodedLocations);
    significantLocations.forEach((loc, i) => {
      events.push({ 
        type: 'location', 
        timestamp: loc.timestamp, 
        data: loc,
        isStart: i === 0,
        isEnd: i === significantLocations.length - 1
      });
    });
    
    // Add notes to timeline
    if (shift.notes) {
      shift.notes.forEach((note) => {
        events.push({ type: 'note', timestamp: note.timestamp, data: { text: note.text } });
      });
    }
    
    // Add photos to timeline
    shift.photos.forEach((photo, index) => {
      events.push({ 
        type: 'photo', 
        timestamp: photo.timestamp, 
        data: { index: index + 1, address: photo.address || "Photo taken" }
      });
    });
    
    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const timelineItems = events.map((event, index) => {
      const time = formatTime(event.timestamp);
      const isLast = index === events.length - 1;
      
      if (event.type === 'note') {
        const note = event.data as { text: string };
        return `
          <div class="timeline-item">
            ${!isLast ? '<div class="timeline-line"></div>' : ''}
            <div class="timeline-dot note"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">${time}</span>
                <span class="badge badge-yellow">Note</span>
              </div>
              <div class="timeline-note">"${note.text}"</div>
            </div>
          </div>
        `;
      } else if (event.type === 'photo') {
        const photo = event.data as { index: number; address: string };
        return `
          <div class="timeline-item">
            ${!isLast ? '<div class="timeline-line"></div>' : ''}
            <div class="timeline-dot photo"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">${time}</span>
                <span class="badge badge-blue">Photo ${photo.index}</span>
              </div>
              <div class="timeline-text">${photo.address}</div>
            </div>
          </div>
        `;
      } else {
        const loc = event.data as LocationPoint;
        let dotClass = "";
        let badgeClass = "badge-gray";
        let label = "Point";
        
        if (event.isStart) { dotClass = "start"; badgeClass = "badge-green"; label = "START"; }
        else if (event.isEnd) { dotClass = shift.isActive ? "current" : "end"; badgeClass = shift.isActive ? "badge-green" : "badge-red"; label = shift.isActive ? "CURRENT" : "END"; }
        
        return `
          <div class="timeline-item">
            ${!isLast ? '<div class="timeline-line"></div>' : ''}
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">${time}</span>
                <span class="badge ${badgeClass}">${label}</span>
              </div>
              <div class="timeline-text">${formatLocationDisplay(loc)}</div>
            </div>
          </div>
        `;
      }
    }).join("");
    
    timelineHtml = `
      <div class="section timeline-section">
        <h2>📊 Activity Timeline</h2>
        <p class="section-subtitle">${events.length} events recorded</p>
        <div class="timeline">${timelineItems}</div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shift Report - ${shift.pairCode}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      padding: 24px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 32px;
      border-bottom: 2px solid #e2e8f0;
    }
    .header-left h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .header-left .subtitle {
      font-size: 14px;
      color: #64748b;
    }
    .header-right {
      text-align: right;
    }
    .header-right .code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }
    .header-right .staff {
      font-size: 16px;
      color: #64748b;
    }
    
    /* Interim Banner */
    .interim-banner {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      color: #92400e;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 700;
      text-align: center;
      border-bottom: 2px solid #f59e0b;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      padding: 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .stat-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
    }
    .stat-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .stat-value {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat-icon {
      font-size: 18px;
    }
    .stat-text {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
    }
    
    /* Map Section */
    .map-section {
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    .map-section h2 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .map-container {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .map-container img {
      width: 100%;
      height: auto;
      display: block;
    }
    .map-legend {
      display: flex;
      gap: 24px;
      margin-top: 12px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      font-size: 13px;
      color: #64748b;
    }
    .map-legend span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .legend-dot.green { background: #22c55e; }
    .legend-dot.blue { background: #3b82f6; }
    .legend-dot.red { background: #ef4444; }
    
    /* Location Cards */
    .location-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    .location-card {
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }
    .location-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .location-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .location-dot.green { background: #22c55e; }
    .location-dot.red { background: #ef4444; }
    .location-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    .location-address {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .location-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #9ca3af;
    }
    
    /* Section */
    .section {
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section h2 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: -12px;
      margin-bottom: 16px;
    }
    
    /* Timeline */
    .timeline {
      display: flex;
      flex-direction: column;
    }
    .timeline-item {
      position: relative;
      padding-left: 32px;
      padding-bottom: 16px;
    }
    .timeline-line {
      position: absolute;
      left: 9px;
      top: 24px;
      bottom: 0;
      width: 2px;
      background: #e5e7eb;
    }
    .timeline-dot {
      position: absolute;
      left: 0;
      top: 4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid #d1d5db;
      background: white;
    }
    .timeline-dot::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #d1d5db;
    }
    .timeline-dot.start { border-color: #22c55e; }
    .timeline-dot.start::after { background: #22c55e; }
    .timeline-dot.end, .timeline-dot.current { border-color: #ef4444; }
    .timeline-dot.end::after, .timeline-dot.current::after { background: #ef4444; }
    .timeline-dot.note { border-color: #f59e0b; }
    .timeline-dot.note::after { background: #f59e0b; }
    .timeline-dot.photo { border-color: #3b82f6; }
    .timeline-dot.photo::after { background: #3b82f6; }
    
    .timeline-content {
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .timeline-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
    }
    .timeline-text {
      font-size: 14px;
      color: #334155;
    }
    .timeline-note {
      font-size: 14px;
      font-style: italic;
      color: #78350f;
      background: #fffbeb;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid #f59e0b;
    }
    
    /* Badges */
    .badge {
      display: inline-flex;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
    .badge-gray { background: #f3f4f6; color: #374151; }
    
    /* Photos Grid */
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .photo-card {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      background: white;
    }
    .photo-image {
      width: 100%;
      height: 150px;
      object-fit: cover;
      display: block;
    }
    .photo-placeholder {
      width: 100%;
      height: 150px;
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      gap: 8px;
    }
    .photo-icon {
      font-size: 32px;
    }
    .photo-meta {
      padding: 12px;
      background: #f8fafc;
    }
    .photo-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .photo-address {
      font-size: 11px;
      color: #64748b;
      line-height: 1.4;
    }
    
    /* Footer */
    .footer {
      padding: 20px 24px;
      text-align: center;
      background: #f8fafc;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    
    /* Print Styles */
    @media print {
      body { 
        background: white; 
        padding: 0; 
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .container { 
        max-width: 100%; 
      }
      .section {
        page-break-inside: avoid;
      }
      .photo-section {
        page-break-before: always;
      }
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
      <div class="header-left">
        <h1>Shift Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString("en-GB", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
      <div class="header-right">
        <div class="code">${shift.pairCode}</div>
        <div class="staff">${shift.staffName}</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Staff</div>
        <div class="stat-value">
          <span class="stat-icon">👤</span>
          <span class="stat-text">${shift.staffName}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Date</div>
        <div class="stat-value">
          <span class="stat-icon">📅</span>
          <span class="stat-text">${startDate}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Duration</div>
        <div class="stat-value">
          <span class="stat-icon">⏱️</span>
          <span class="stat-text">${duration}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Distance</div>
        <div class="stat-value">
          <span class="stat-icon">📍</span>
          <span class="stat-text">${distance} km</span>
        </div>
      </div>
    </div>
    
    ${mapUrl ? `
    <div class="map-section">
      <h2>🗺️ Route Overview</h2>
      <div class="map-container">
        <img src="${mapUrl}" alt="Route Map" />
      </div>
      <div class="map-legend">
        <span><div class="legend-dot green"></div> Start Point</span>
        <span><div class="legend-dot blue"></div> Route Points</span>
        <span><div class="legend-dot red"></div> End Point</span>
      </div>
    </div>
    ` : ""}
    
    <div class="location-grid">
      <div class="location-card">
        <div class="location-card-header">
          <div class="location-dot green"></div>
          <span class="location-label">Start Location</span>
        </div>
        <div class="location-address">${startAddress}</div>
        <div class="location-time">${startTime}</div>
      </div>
      <div class="location-card">
        <div class="location-card-header">
          <div class="location-dot red"></div>
          <span class="location-label">${shift.isActive ? 'Current Location' : 'End Location'}</span>
        </div>
        <div class="location-address">${endAddress}</div>
        <div class="location-time">${endTime}</div>
      </div>
    </div>
    
    ${timelineHtml}
    ${photosHtml}
    
    <div class="footer">
      Timestamp Camera App • ${shift.siteName}
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
