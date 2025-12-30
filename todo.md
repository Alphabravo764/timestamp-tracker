# Timestamp Camera App - TODO

## Core Requirements
1. Staff can START a shift (begin tracking location)
2. During shift: take timestamped photos with location
3. Location tracked continuously during shift (trail)
4. Staff can END the shift
5. Generate PDF report showing:
   - All photos with timestamps and locations
   - Trail/path map showing where staff has been
   - Shift summary (start time, end time, duration)
6. Shareable link with pair code for watchers
7. Watchers can view multiple staff at same time

## Implementation

### Shift Workflow
- [ ] Start shift button on home screen
- [ ] Active shift indicator
- [ ] Location tracking during active shift (every 30 sec)
- [ ] End shift button
- [ ] Shift stored locally with all data

### Camera Integration
- [ ] Camera only available during active shift
- [ ] Photos linked to current shift
- [ ] Timestamp and location burned into photo metadata

### Shift History & Reports
- [ ] List of completed shifts
- [ ] View shift details (photos, trail, duration)
- [ ] Generate PDF report with trail map
- [ ] Share report

### Watcher/Pairing
- [ ] Generate pair code when shift starts
- [ ] Watcher can add staff by pair code
- [ ] View all paired staff locations
- [ ] Remove staff from watch list

## Progress
- [x] Basic camera with timestamp overlay
- [x] Gallery view
- [x] Tracking tab with pair code
- [x] Watcher tab for multi-staff
- [x] Shift workflow (start/end)
- [x] Photos linked to shifts
- [x] Shift history screen
- [x] Report generation (text format, shareable)


## BUGS TO FIX (URGENT)
- [x] End shift not working - FIXED
- [x] Pair code not visible/accessible - FIXED (prominent card)
- [x] Flow is confusing and unprofessional - FIXED (cleaner states)
- [x] Need clearer UI for active shift state - FIXED (dashboard view)
- [x] Need visible pair code during shift - FIXED (big pair code card)
- [x] Need working end shift button - FIXED (red button)


## BUGS REPORTED BY USER
- [x] End shift not working - FIXED (added confirm screen, web-compatible alerts)
- [x] Watch tab stuck on "Waiting for location data" - FIXED (simplified approach, manual refresh)


## NEW BUGS & FEATURES
- [x] Photo capture error - FIXED (added base64, better error handling)
- [x] Add reverse geocoding - DONE (using Nominatim API, shows street name + postcode)
- [x] Add trail visualization - DONE (bounding box URL shows all points on OpenStreetMap)


## CRITICAL BUGS
- [x] "Failed to end shift" error - FIXED (improved error handling, better storage keys)
- [x] Start shift issues - FIXED (clear existing shift before starting new one)

## NEW FEATURES REQUESTED
- [x] Burn timestamp watermark on photos (canvas overlay on web)
- [x] PDF export with static map image showing trail
- [x] PDF includes all photos with timestamps and addresses


## NEW REQUIREMENTS (User Feedback)
- [ ] Share Live Location - generate our own link instead of direct OpenStreetMap link
- [ ] Live Location Page - must show trail (polyline path) not just markers
- [ ] Live Location Page - must have "Download Report" button
- [ ] Share Report - should be PDF, not just text
- [ ] PDF Report - must show actual trail path (polyline), not just start/end points
- [ ] Trail visualization using Leaflet.js for interactive map


## NEW USER REQUESTS
- [x] Fix PDF view error
- [x] Add photo gallery to view taken photos with timestamps
- [x] Enable individual photo sharing
- [x] Update PDF to use Google Maps static image with trail


## LIVE VIEWER PAGE
- [x] Create /live/[token] route for live location viewing
- [x] Google Maps integration with trail polyline
- [x] Real-time location updates (auto-refresh)
- [x] Download Report button that generates PDF
- [x] Show staff name, site, shift duration
- [x] Display recent photos
- [x] Update share link to use custom live page URL


## ADDITIONAL FIX
- [x] Change share location to use Google Maps trail instead of OpenStreetMap


## OFFLINE & EXPORT FEATURES
- [x] Implement offline support with local caching
- [x] Add sync queue for pending uploads
- [x] Show offline indicator when no internet
- [x] Add watermarked photo export to device library
- [x] Export button on photo viewer
- [ ] Test offline workflow
