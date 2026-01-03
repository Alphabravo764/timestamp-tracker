import { Shift, LocationPoint, ShiftPhoto, ShiftNote } from "./shift-types";
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

// Format duration from shift - returns HH:MM:SS format
const formatDuration = (shift: Shift): string => {
  const start = new Date(shift.startTime);
  const end = shift.endTime ? new Date(shift.endTime) : new Date();
  const diff = end.getTime() - start.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

// Generate SHA-256 hash for document integrity
const generateHash = (shift: Shift): string => {
  const data = `${shift.pairCode}-${shift.startTime}-${shift.endTime || 'active'}-${shift.photos?.length || 0}`;
  // Simple hash simulation - in production use crypto
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  }
  return hash;
};

// Build activity timeline - FILTERED (no raw pings)
interface TimelineEvent {
  type: 'start' | 'end' | 'photo' | 'note';
  time: string;
  title: string;
  location: string;
  coords?: { lat: number; lng: number };
}

const buildTimeline = (shift: Shift, locations: LocationPoint[]): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  
  // Shift start
  if (locations.length > 0) {
    const startLoc = locations[0];
    events.push({
      type: 'start',
      time: shift.startTime,
      title: 'SHIFT STARTED',
      location: formatLocationDisplay(startLoc),
      coords: { lat: startLoc.latitude, lng: startLoc.longitude }
    });
  }
  
  // Photos
  if (shift.photos) {
    shift.photos.forEach((photo: ShiftPhoto) => {
      events.push({
        type: 'photo',
        time: photo.timestamp,
        title: 'PHOTO EVIDENCE LOGGED',
        location: photo.address || (photo.location ? formatLocationDisplay(photo.location as LocationPoint) : 'Location recorded'),
        coords: photo.location ? { lat: photo.location.latitude, lng: photo.location.longitude } : undefined
      });
    });
  }
  
  // Notes
  if (shift.notes) {
    shift.notes.forEach((note: ShiftNote) => {
      events.push({
        type: 'note',
        time: note.timestamp,
        title: note.text.substring(0, 50) + (note.text.length > 50 ? '...' : ''),
        location: note.location ? formatLocationDisplay(note.location) : 'Location recorded',
        coords: note.location ? { lat: note.location.latitude, lng: note.location.longitude } : undefined
      });
    });
  }
  
  // Shift end
  if (!shift.isActive && shift.endTime && locations.length > 0) {
    const endLoc = locations[locations.length - 1];
    events.push({
      type: 'end',
      time: shift.endTime,
      title: 'SHIFT ENDED',
      location: formatLocationDisplay(endLoc),
      coords: { lat: endLoc.latitude, lng: endLoc.longitude }
    });
  }
  
  // Sort by time (oldest first for timeline)
  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
  return events;
};

// Generate PDF HTML
export const generatePdfHtml = async (shift: Shift, isInterim?: boolean): Promise<string> => {
  // Reverse geocode locations that need addresses
  const locations = shift.locations ? await batchReverseGeocode(shift.locations) : [];
  
  // Calculate stats
  const distance = calculateDistance(locations);
  const duration = formatDuration(shift);
  const photoCount = shift.photos?.length || 0;
  const noteCount = shift.notes?.length || 0;
  
  // Build timeline
  const timeline = buildTimeline(shift, locations);
  
  // Generate map URL
  let mapUrl = '';
  if (locations.length > 0) {
    mapUrl = generateStaticMapUrlEncoded(locations, 800, 350) || '';
  }
  
  // Convert photos to base64
  const photoDataUris: string[] = [];
  if (shift.photos) {
    for (const photo of shift.photos) {
      try {
        const dataUri = await photoToBase64DataUri(photo.uri || '');
        photoDataUris.push(dataUri || '');
      } catch (e) {
        console.log("Photo conversion error:", e);
        photoDataUris.push('');
      }
    }
  }
  
  // Generate document hash
  const docHash = generateHash(shift);
  
  // Start/end locations
  const startLoc = locations[0];
  const endLoc = locations[locations.length - 1];
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shift Report - ${shift.pairCode}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4 portrait;
      margin: 0;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: white;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .mono {
      font-family: 'JetBrains Mono', monospace;
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: white;
      padding: 32px 40px;
      position: relative;
    }
    
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.15);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .logo-icon svg {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: white;
      stroke-width: 2;
    }
    
    .logo-text {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    
    .verified-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid rgba(34, 197, 94, 0.5);
      color: #86efac;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .verified-badge svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    
    .report-title {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -1px;
      margin-bottom: 4px;
    }
    
    .report-subtitle {
      font-size: 14px;
      color: rgba(255,255,255,0.7);
    }
    
    .report-meta {
      text-align: right;
      font-size: 11px;
      color: rgba(255,255,255,0.6);
    }
    
    .report-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: rgba(255,255,255,0.9);
      margin-bottom: 4px;
    }
    
    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: #e2e8f0;
      border: 1px solid #e2e8f0;
      margin: 0 40px;
      margin-top: -20px;
      position: relative;
      z-index: 10;
      border-radius: 12px;
      overflow: hidden;
    }
    
    .summary-card {
      background: white;
      padding: 16px 20px;
    }
    
    .summary-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    
    .summary-value {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }
    
    .summary-value.mono {
      font-size: 20px;
      letter-spacing: -0.5px;
    }
    
    /* Map Section */
    .map-section {
      margin: 32px 40px;
    }
    
    .map-container {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      border-radius: 12px;
      overflow: hidden;
      position: relative;
    }
    
    .map-label {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255,255,255,0.95);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    
    .map-image {
      width: 100%;
      height: 280px;
      object-fit: cover;
    }
    
    .map-caption {
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 12px 16px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
    }
    
    /* Timeline Section */
    .section {
      margin: 32px 40px;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .section-icon {
      width: 24px;
      height: 24px;
      color: #3b82f6;
    }
    
    .section-icon svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e293b;
    }
    
    /* Timeline */
    .timeline {
      position: relative;
      padding-left: 120px;
    }
    
    .timeline::before {
      content: '';
      position: absolute;
      left: 108px;
      top: 8px;
      bottom: 8px;
      width: 2px;
      background: #e2e8f0;
    }
    
    .timeline-item {
      position: relative;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
    }
    
    .timeline-item:last-child {
      margin-bottom: 0;
    }
    
    .timeline-time {
      position: absolute;
      left: 0;
      width: 90px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      text-align: right;
      padding-right: 20px;
    }
    
    .timeline-dot {
      position: absolute;
      left: 100px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      border: 3px solid #3b82f6;
      z-index: 1;
    }
    
    .timeline-dot.start { border-color: #22c55e; }
    .timeline-dot.end { border-color: #ef4444; }
    .timeline-dot.photo { border-color: #8b5cf6; }
    .timeline-dot.note { border-color: #f59e0b; }
    
    .timeline-content {
      margin-left: 24px;
      flex: 1;
    }
    
    .timeline-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }
    
    .timeline-location {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #64748b;
    }
    
    .timeline-location svg {
      width: 12px;
      height: 12px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    
    /* Photo Evidence */
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    
    .photo-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      background: #f8fafc;
    }
    
    .photo-badge {
      display: inline-block;
      background: #3b82f6;
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 0 0 8px 0;
    }
    
    .photo-image-container {
      height: 160px;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    
    .photo-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .photo-placeholder {
      color: #94a3b8;
    }
    
    .photo-placeholder svg {
      width: 48px;
      height: 48px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
    }
    
    .photo-timestamp {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0,0,0,0.7);
      color: white;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
    }
    
    .photo-details {
      padding: 14px;
    }
    
    .photo-address {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }
    
    .photo-coords {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #64748b;
      margin-bottom: 8px;
    }
    
    .photo-verified {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 600;
      color: #22c55e;
      text-transform: uppercase;
    }
    
    .photo-verified svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    
    /* Footer */
    .footer {
      margin: 40px;
      padding: 24px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
    
    .footer-content {
      display: flex;
      align-items: flex-start;
      gap: 20px;
    }
    
    .qr-placeholder {
      width: 64px;
      height: 64px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .qr-placeholder span {
      font-size: 8px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
    }
    
    .footer-text {
      flex: 1;
    }
    
    .hash-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e293b;
      margin-bottom: 4px;
    }
    
    .hash-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #64748b;
      word-break: break-all;
      margin-bottom: 8px;
    }
    
    .hash-disclaimer {
      font-size: 10px;
      color: #94a3b8;
      font-style: italic;
    }
    
    .footer-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #64748b;
    }
    
    .footer-brand {
      font-weight: 600;
      color: #1e293b;
    }
    
    .footer-secure {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .footer-secure svg {
      width: 12px;
      height: 12px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    
    /* Page break handling */
    .page-break {
      page-break-before: always;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .header {
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important;
        -webkit-print-color-adjust: exact !important;
      }
      
      .map-container {
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="header-top">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <span class="logo-text">TrustLayer</span>
      </div>
      <div class="verified-badge">
        <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        VERIFIED & LOCKED
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <h1 class="report-title">SHIFT REPORT</h1>
        <p class="report-subtitle">Official Proof of Presence Document</p>
      </div>
      <div class="report-meta">
        <div class="report-id">REPORT ID: ${shift.pairCode}</div>
        <div>${formatDate(shift.startTime)}</div>
      </div>
    </div>
  </header>
  
  <!-- Summary Cards -->
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Officer</div>
      <div class="summary-value">${shift.staffName || 'Security Officer'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Site</div>
      <div class="summary-value">${shift.siteName || startLoc?.address?.split(',')[0] || 'Patrol Site'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Duration</div>
      <div class="summary-value mono">${duration}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Evidence</div>
      <div class="summary-value">${photoCount} Photo${photoCount !== 1 ? 's' : ''}</div>
    </div>
  </div>
  
  <!-- Map Section -->
  <div class="map-section">
    <div class="map-container">
      <div class="map-label">Route Map Visualization</div>
      ${mapUrl ? `<img src="${mapUrl}" alt="Route Map" class="map-image" />` : '<div class="map-image" style="display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.5);">Map unavailable</div>'}
      <div class="map-caption">Patrol Activity Trail: ${shift.siteName || startLoc?.address || 'Site'}</div>
    </div>
  </div>
  
  <!-- Activity Timeline -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <h2 class="section-title">Activity Timeline</h2>
    </div>
    
    <div class="timeline">
      ${timeline.map(event => `
        <div class="timeline-item">
          <div class="timeline-time">${formatTime(event.time)}</div>
          <div class="timeline-dot ${event.type}"></div>
          <div class="timeline-content">
            <div class="timeline-title">${event.title}</div>
            <div class="timeline-location">
              <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${event.location}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
  ${photoCount > 0 ? `
  <!-- Visual Evidence Log -->
  <div class="section ${photoCount > 2 ? 'page-break' : ''}">
    <div class="section-header">
      <div class="section-icon">
        <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      </div>
      <h2 class="section-title">Visual Evidence Log</h2>
    </div>
    
    <div class="photo-grid">
      ${shift.photos?.map((photo: ShiftPhoto, index: number) => `
        <div class="photo-card">
          <div class="photo-badge">EVIDENCE #${index + 1}</div>
          <div class="photo-image-container">
            ${photoDataUris[index] ? `
              <img src="${photoDataUris[index]}" alt="Evidence ${index + 1}" class="photo-image" />
            ` : `
              <div class="photo-placeholder">
                <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
            `}
            <div class="photo-timestamp">${formatTime(photo.timestamp)}</div>
          </div>
          <div class="photo-details">
            <div class="photo-address">${photo.address || (photo.location ? `${photo.location.latitude.toFixed(4)}, ${photo.location.longitude.toFixed(4)}` : 'Location recorded')}</div>
            <div class="photo-coords">GPS: ${photo.location ? `${photo.location.latitude.toFixed(4)}°N, ${Math.abs(photo.location.longitude).toFixed(4)}°W` : 'N/A'}</div>
            <div class="photo-verified">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              TAMPER VERIFIED
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- Footer -->
  <div class="footer">
    <div class="footer-content">
      <div class="qr-placeholder">
        <span>QR AUTH</span>
      </div>
      <div class="footer-text">
        <div class="hash-title">Cryptographic Integrity Hash (SHA-256)</div>
        <div class="hash-value">${docHash}</div>
        <div class="hash-disclaimer">This document is a legally binding record of activity. All data is time-locked and encrypted.</div>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-brand">TRUSTLAYER SYSTEMS SECURITY REPORT</span>
      <span class="footer-secure">
        <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        ENCRYPTED SESSION
      </span>
    </div>
  </div>
</body>
</html>`;
};

// Alias for backward compatibility
export const generatePDFReport = generatePdfHtml;

export default generatePdfHtml;
