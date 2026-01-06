import type { Shift, ShiftPhoto, LocationPoint, ShiftNote } from "./shift-types";
import { generateMapboxStaticUrl, reverseGeocodeMapbox, formatMapboxAddress } from "./mapbox";
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

    // Try to reverse geocode using Mapbox
    try {
      const geocoded = await reverseGeocodeMapbox(loc.latitude, loc.longitude);
      if (geocoded) {
        results.push({ ...loc, address: formatMapboxAddress(geocoded) });
      } else {
        results.push(loc);
      }

      // Rate limit: wait 50ms between requests
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (e) {
      console.log("Geocode error:", e);
      results.push(loc);
    }
  }

  return results;
};

// Format duration from shift - returns HH:MM format
const formatDuration = (shift: Shift): string => {
  const start = new Date(shift.startTime);
  const end = shift.endTime ? new Date(shift.endTime) : new Date();
  const diff = end.getTime() - start.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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

// Get address from coordinates using Mapbox
const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
  try {
    const geocoded = await reverseGeocodeMapbox(lat, lng);
    if (geocoded) {
      return formatMapboxAddress(geocoded);
    }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
};

// Build activity list from shift data
interface Activity {
  type: 'start' | 'photo' | 'note' | 'end';
  time: string;
  title: string;
  content: string;
  photoUri?: string;
  noteText?: string;
  noteLocation?: string;
}

const buildActivities = async (shift: Shift, locations: LocationPoint[]): Promise<Activity[]> => {
  const activities: Activity[] = [];

  // Add shift start
  if (locations.length > 0) {
    const startLoc = locations[0];
    const startAddress = startLoc.address || await getAddressFromCoords(startLoc.latitude, startLoc.longitude);
    activities.push({
      type: 'start',
      time: shift.startTime,
      title: 'Shift Started',
      content: startAddress
    });
  }

  // Add photos
  if (shift.photos) {
    for (const photo of shift.photos) {
      let content = 'Location unavailable';
      if (photo.location?.latitude && photo.location?.longitude) {
        content = photo.address || await getAddressFromCoords(photo.location.latitude, photo.location.longitude);
      } else if (photo.address) {
        content = photo.address;
      }

      activities.push({
        type: 'photo',
        time: photo.timestamp,
        title: 'Photo Captured',
        content: content,
        photoUri: photo.uri
      });
    }
  }

  // Add notes
  if (shift.notes && shift.notes.length > 0) {
    for (const note of shift.notes) {
      let noteLocation = 'Location not recorded';
      const noteLat = note.location?.latitude;
      const noteLng = note.location?.longitude;
      if (noteLat && noteLng) {
        noteLocation = await getAddressFromCoords(noteLat, noteLng);
      }

      activities.push({
        type: 'note',
        time: note.timestamp,
        title: 'Note Added',
        content: noteLocation,
        noteText: note.text,
        noteLocation: noteLocation
      });
    }
  }

  // Add shift end
  if (shift.endTime) {
    const durationText = formatDuration(shift);
    activities.push({
      type: 'end',
      time: shift.endTime,
      title: 'Shift Ended',
      content: `Duration: ${durationText}`
    });
  }

  // Sort by time
  activities.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return activities;
};

/**
 * Generate PDF HTML that matches the viewer design
 * This creates a unified look between mobile app and web viewer
 */
export const generatePdfHtml = async (shift: Shift): Promise<string> => {
  // Get locations with addresses
  const locations = shift.locations ? await batchReverseGeocode(shift.locations) : [];

  // Calculate stats
  const durationText = formatDuration(shift);
  const distance = calculateDistance(locations);
  const distanceText = distance > 0 ? `${distance.toFixed(2)} km` : '0 km';
  const photoCount = shift.photos?.length || 0;
  const noteCount = shift.notes?.length || 0;

  // Get initials
  const initials = (shift.staffName || 'U').substring(0, 2).toUpperCase();

  // Get latest location
  const latestLocation = locations.length > 0 ? locations[locations.length - 1] : null;
  let latestAddress = '';
  if (latestLocation) {
    latestAddress = latestLocation.address || await getAddressFromCoords(latestLocation.latitude, latestLocation.longitude);
  }

  // Build activities
  const activities = await buildActivities(shift, locations);

  // Generate map URL
  let mapUrl = '';
  if (locations.length > 0) {
    mapUrl = generateMapboxStaticUrl(locations, 800, 400) || '';
  }

  // Convert photos to base64 and burn watermark
  const photoDataUris: Map<string, string> = new Map();
  if (shift.photos) {
    const { burnWatermark } = await import("./burn-watermark");

    for (const photo of shift.photos) {
      try {
        // First convert to base64
        let dataUri = await photoToBase64DataUri(photo.uri || '');
        if (!dataUri) continue;

        // Then burn watermark for PDF
        if (photo.location) {
          const watermarkedUri = await burnWatermark(dataUri, {
            timestamp: formatTime(photo.timestamp),
            date: formatDate(photo.timestamp),
            address: photo.address || "Location unavailable",
            latitude: photo.location.latitude,
            longitude: photo.location.longitude,
            staffName: shift.staffName,
            siteName: shift.siteName,
          });
          dataUri = watermarkedUri;
        }

        photoDataUris.set(photo.uri, dataUri);
      } catch (e) {
        console.log("Photo conversion/watermark error:", e);
      }
    }
  }

  // Generate HTML matching viewer design
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shift Report - ${shift.pairCode}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4 portrait;
      margin: 0;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      font-size: 14px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Header */
    .header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 20px 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .guard-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 20px;
      border: 3px solid ${shift.endTime ? '#94a3b8' : '#22c55e'};
      position: relative;
    }
    
    .live-badge {
      position: absolute;
      bottom: -4px;
      right: -4px;
      background: ${shift.endTime ? '#94a3b8' : '#22c55e'};
      color: white;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      border: 2px solid white;
    }
    
    .guard-details h1 {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }
    
    .guard-details p {
      font-size: 14px;
      color: #64748b;
      margin-top: 4px;
    }
    
    .header-stats {
      display: flex;
      gap: 32px;
    }
    
    .stat {
      text-align: right;
    }
    
    .stat-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 4px;
    }
    
    /* Location Bar */
    .location-bar {
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      padding: 16px 24px;
    }
    
    .location-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .location-icon {
      width: 40px;
      height: 40px;
      background: #3b82f6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
    }
    
    .location-details {
      flex: 1;
    }
    
    .location-address {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }
    
    .location-coords {
      font-size: 13px;
      color: #64748b;
      margin-top: 2px;
      font-family: 'Courier New', monospace;
    }
    
    /* Main Content */
    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    /* Map */
    .map-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
      position: relative;
    }
    
    .map-image {
      width: 100%;
      height: 400px;
      object-fit: cover;
      display: block;
    }
    
    .map-overlay {
      position: absolute;
      top: 16px;
      left: 16px;
      background: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-size: 13px;
      color: #64748b;
    }
    
    .map-placeholder {
      width: 100%;
      height: 400px;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 16px;
    }
    
    /* Activity Feed */
    .activity-feed {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 20px;
    }
    
    .feed-header {
      margin-bottom: 20px;
    }
    
    .feed-header h2 {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
    }
    
    .feed-count {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }
    
    .feed-content {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
    }
    
    .feed-item {
      display: flex;
      flex-direction: column;
      min-width: 200px;
      max-width: 280px;
    }
    
    .timeline-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .timeline-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: white;
    }
    
    .timeline-dot.start { background: #22c55e; }
    .timeline-dot.photo { background: #8b5cf6; }
    .timeline-dot.note { background: #f59e0b; }
    .timeline-dot.end { background: #64748b; }
    
    .feed-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px;
      border: 1px solid #e2e8f0;
    }
    
    .feed-time-location {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .feed-time {
      font-size: 12px;
      color: #64748b;
    }
    
    .feed-date {
      font-size: 12px;
      color: #94a3b8;
    }
    
    .feed-location {
      font-size: 13px;
      color: #475569;
      margin-bottom: 8px;
    }
    
    .feed-photo {
      border-radius: 8px;
      overflow: hidden;
      margin-top: 8px;
    }
    
    .feed-photo img {
      width: 100%;
      height: 150px;
      object-fit: cover;
      display: block;
    }
    
    .note-text {
      font-size: 14px;
      color: #1e293b;
      line-height: 1.5;
      background: white;
      padding: 12px;
      border-radius: 8px;
      border-left: 3px solid #f59e0b;
      margin-top: 8px;
    }
    
    .empty-state {
      padding: 32px;
      text-align: center;
      color: #94a3b8;
      font-size: 14px;
      width: 100%;
    }
    
    /* Shift Summary */
    .shift-summary {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: white;
    }
    
    .shift-summary .feed-header h2 {
      color: white;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    
    .summary-item {
      text-align: center;
      padding: 16px;
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
    }
    
    .summary-value {
      font-size: 28px;
      font-weight: 700;
      color: white;
    }
    
    .summary-label {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Footer */
    .report-footer {
      text-align: center;
      padding: 24px;
      color: #64748b;
      font-size: 12px;
      border-top: 1px solid #e2e8f0;
      margin-top: 24px;
    }
    
    .report-id {
      font-family: 'Courier New', monospace;
      color: #94a3b8;
      margin-top: 8px;
    }
    
    /* Print styles */
    @media print {
      body {
        background: white;
      }
      
      .main-content {
        padding: 16px;
      }
      
      .feed-item {
        page-break-inside: avoid;
      }
      
      .activity-feed {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-content">
      <div class="guard-info">
        <div class="avatar">
          ${initials}
          <span class="live-badge">${shift.endTime ? 'ENDED' : 'LIVE'}</span>
        </div>
        <div class="guard-details">
          <h1>${shift.staffName || 'Unknown Staff'}</h1>
          <p>${shift.siteName}</p>
        </div>
      </div>
      <div class="header-stats">
        <div class="stat">
          <div class="stat-label">Duration</div>
          <div class="stat-value">${durationText}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Locations</div>
          <div class="stat-value">${locations.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Photos</div>
          <div class="stat-value">${photoCount}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Distance</div>
          <div class="stat-value">${distanceText}</div>
        </div>
      </div>
    </div>
  </div>
  
  ${latestLocation ? `
  <div class="location-bar">
    <div class="location-content">
      <div class="location-icon">📍</div>
      <div class="location-details">
        <div class="location-address">${latestAddress}</div>
        <div class="location-coords">
          ${latestLocation.latitude.toFixed(6)}, ${latestLocation.longitude.toFixed(6)}
          ${latestLocation.accuracy ? ` • ±${Math.round(latestLocation.accuracy)}m` : ''}
        </div>
      </div>
    </div>
  </div>
  ` : ''}
  
  <div class="main-content">
    <!-- Map -->
    <div class="map-container">
      ${mapUrl ? `
        <img class="map-image" src="${mapUrl}" alt="Route Map" />
        <div class="map-overlay">${locations.length} GPS points recorded</div>
      ` : `
        <div class="map-placeholder">No location data available</div>
      `}
    </div>
    
    <!-- Photos Timeline -->
    <div class="activity-feed">
      <div class="feed-header">
        <h2>📷 Photos Timeline</h2>
        <div class="feed-count">${photoCount} photos</div>
      </div>
      <div class="feed-content">
        ${activities.filter(a => a.type === 'photo').length === 0 ? '<div class="empty-state">No photos captured</div>' : ''}
        ${activities.filter(a => a.type === 'photo').map(activity => {
    const photoUri = activity.photoUri ? (photoDataUris.get(activity.photoUri) || activity.photoUri) : '';
    return `
            <div class="feed-item">
              <div class="timeline-connector">
                <div class="timeline-dot photo">📷</div>
              </div>
              <div class="feed-card">
                <div class="feed-time-location">
                  <span class="feed-time">🕐 ${formatTime(activity.time)}</span>
                  <span class="feed-date">${formatDate(activity.time)}</span>
                </div>
                <div class="feed-location">📍 ${activity.content}</div>
                ${photoUri ? `
                  <div class="feed-photo">
                    <img src="${photoUri}" alt="Photo" />
                  </div>
                ` : ''}
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
    
    <!-- Notes Timeline -->
    <div class="activity-feed">
      <div class="feed-header">
        <h2>📝 Notes Timeline</h2>
        <div class="feed-count">${noteCount} notes</div>
      </div>
      <div class="feed-content">
        ${activities.filter(a => a.type === 'note').length === 0 ? '<div class="empty-state">No notes added</div>' : ''}
        ${activities.filter(a => a.type === 'note').map(activity => `
          <div class="feed-item">
            <div class="timeline-connector">
              <div class="timeline-dot note">📝</div>
            </div>
            <div class="feed-card">
              <div class="feed-time-location">
                <span class="feed-time">🕐 ${formatTime(activity.time)}</span>
                <span class="feed-date">${formatDate(activity.time)}</span>
              </div>
              <div class="feed-location">📍 ${activity.noteLocation || 'Location not recorded'}</div>
              <div class="note-text">${activity.noteText || activity.content}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Shift Summary -->
    ${shift.endTime ? `
    <div class="activity-feed shift-summary">
      <div class="feed-header">
        <h2>📊 Shift Summary</h2>
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${durationText}</div>
          <div class="summary-label">Duration</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${distanceText}</div>
          <div class="summary-label">Distance</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${photoCount}</div>
          <div class="summary-label">Photos</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${noteCount}</div>
          <div class="summary-label">Notes</div>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Report Footer -->
    <div class="report-footer">
      <p>Generated by Timestamp Tracker</p>
      <p class="report-id">Report ID: ${shift.pairCode} • ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
};

// Alias for backward compatibility
export const generatePDFReport = generatePdfHtml;

export default generatePdfHtml;
