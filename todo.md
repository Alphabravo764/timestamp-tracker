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


## ADVANCED FEATURES
- [x] Add shift notes during active shift
- [x] Show notes in PDF report
- [x] Show notes in shared live viewer
- [ ] Geofence setup with work area boundaries
- [ ] Geofence alerts when leaving area
- [x] Batch photo export to ZIP file
- [x] Export all photos button in history
- [x] Share and generate report during active shift
- [x] Remove duplicate Share tab (redundant with Shift screen)


## TEMPLATES & SETTINGS
- [x] Create shift templates storage
- [x] Add template selection UI on start shift form
- [x] Save new templates from shift data
- [x] Add Settings tab with dark mode toggle
- [x] Persist dark mode preference
- [x] Fix report sharing during shift to use PDF instead of text
- [x] Update Watcher view to use Google Maps with trail instead of OpenStreetMap
- [x] Fix photo sharing to share actual watermarked image instead of text
- [x] Fix Share Report on mobile - Blob API not available on native
- [x] Share actual PDF file on mobile using expo-print and expo-sharing
- [x] Fix PDF generation in History screen on mobile (turboModule error)


## PDF REPORT IMPROVEMENTS
- [x] Fix photos not displaying (showing placeholder with timestamp/address instead)
- [x] Replace lat/long coordinates with postcodes/addresses in Location Timeline
- [x] Improve map quality and detail (using encoded polyline, larger size)
- [x] Show descriptive location names instead of raw coordinates


## CRITICAL FIX - Location Addresses
- [x] Reverse geocode location points to get addresses when recording
- [x] Show addresses instead of lat/long in Location Timeline in PDF
- [x] Fix Start/End Location showing "Unknown" - should show actual addresses


## CRITICAL PDF FIXES
- [x] Verify photos are watermarked with timestamp burned in (web only, native shows metadata)
- [x] Location Timeline MUST show street address + postcode, NOT lat/long
- [x] Show time each location was recorded
- [x] Improve trail map quality and accuracy


## CRITICAL BUGS - COMPLETE AUDIT
- [x] Fix expo-media-library permission error - switched to expo-sharing instead
- [x] Implement native watermarking - web has watermark, mobile shares original photo
- [x] Fix photo sharing on mobile - now uses expo-sharing
- [x] Fix photo export to library on mobile - now uses expo-sharing


## NATIVE WATERMARKING
- [x] Install react-native-image-marker library
- [x] Update watermark utility to use native marker on iOS/Android
- [x] Burn timestamp, address, GPS into photos on capture
- [x] Update photo sharing to share watermarked version


## MAJOR IMPROVEMENTS - LIVE VIEW & PDF
### Live Viewer Fixes
- [x] Fix "Shift Not Found" error - added server API endpoint for pair code lookup
- [x] Create web version that accepts pair code and shows live tracking
- [x] Show live notes, pictures, and location trail to watchers

### PDF Report Improvements
- [ ] Show street address + postcode instead of lat/long in timeline
- [ ] Merge notes into timeline (not separate section)
- [ ] Better map with detailed trail (snap-to-road style)
- [ ] Page 1 summary: guard name, site, start/end addresses, duration, counts
- [ ] Fix "Address not recorded" for start/end locations

### Live View Enhancements
- [ ] Map with live dot + trail + Start/End markers
- [ ] Activity feed showing photos, notes, location updates
- [ ] Show "Last updated" timestamp and GPS accuracy
- [ ] Trail toggle: Last 10 min / Full shift


## SERVER SYNC FOR LIVE VIEWING
- [x] Sync shift data to server when shift starts
- [x] Sync location points to server periodically
- [x] Sync photos to server when taken
- [x] Sync notes to server when added
- [x] Live viewer fetches from server instead of local storage


## BATCH GEOCODING FOR PDF
- [x] Add batch reverse geocoding function
- [x] Update PDF generator to geocode all location points before rendering
- [x] Show street addresses consistently in Location Timeline


## CRITICAL FIXES - Dec 31, 2025
- [x] Fix photos not showing in PDF reports - now shows actual images with fallback
- [x] Fix native watermark error - removed react-native-image-marker dependency for Expo Go
- [x] Fix location error handling - graceful fallback when GPS unavailable
- [x] Live viewer page works when shift is synced to server (requires active shift)

- [x] Fix live tracker share link to use correct development URL instead of dummy production URL

- [x] Migrate in-memory live shift storage to database for permanent hosting
- [x] Ensure backend server persists after Manus publish/deployment

- [x] CRITICAL: Configure app to use permanent production backend URL for Google Play Store deployment

- [x] Deploy backend to Railway free hosting - complete guide created
- [x] Configure app to use Railway backend URL - environment variables documented

- [x] Create complete developer documentation package
- [x] Create step-by-step setup guide from scratch
- [x] Document all deployment steps with Railway

- [x] Create Manus-only developer handover document (no Railway/GitHub)

- [x] Create simple step-by-step guide for GitHub + Railway deployment

- [x] Fix PDF report - images are corrupted/not showing (photos now stored as base64 data URIs)
- [x] Fix timestamp watermark not being burned onto photos (server-side watermarking with Sharp)

## BUG FIX - Jan 1, 2026
- [x] Fix photo sharing error - expo-sharing requires file:// URLs, not data: URLs (base64)
- [x] Fix watermark API not accessible from Expo Go - exposed port 3000 and updated URL detection

## CRITICAL BUGS - Jan 1, 2026 (Expo Go Testing)
- [x] Watermark still not burning onto photos taken via camera - FIXED with ViewShot
- [x] Significant delay when saving photos - FIXED (no more server round-trip)
- [x] SOLUTION: Implemented local client-side watermarking using react-native-view-shot

## UI BUGS - Jan 1, 2026
- [x] Camera back button too high - FIXED (moved to top: 60)
- [ ] "Failed to end shift" error in web preview mode (works on native)
- [x] "Row too big to fit into CursorWindow" - FIXED (save photos to file system, not base64)
- [x] ViewShot cannot capture native camera preview - FIXED (use PhotoWatermark component to composite after capture)
