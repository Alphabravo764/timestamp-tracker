# Timestamp Tracker - Project TODO

## Core Features

### Setup & Authentication
- [ ] First-time setup screen with name, phone, email inputs
- [ ] Optional profile photo capture
- [ ] User data persistence with AsyncStorage
- [ ] Profile editing functionality

### Shift Management
- [ ] Start shift screen with site name and notes
- [ ] Location permission handling
- [ ] Active shift screen with timer and status
- [ ] End shift with mandatory final photo
- [ ] Shift data model and state management

### Location Tracking
- [ ] Background location tracking during active shift
- [ ] Adaptive location update frequency (moving vs stationary)
- [ ] Location permission requests with explanations
- [ ] GPS accuracy monitoring
- [ ] Offline location queueing and sync

### Camera & Photos
- [ ] Timestamp camera with date/time overlay
- [ ] Location overlay on camera view
- [ ] Photo capture with EXIF metadata
- [ ] Photo preview and confirmation
- [ ] Photo compression before upload
- [ ] Photo storage and retrieval

### Live Sharing
- [ ] Generate unique live link for each shift
- [ ] Share live link via native share sheet
- [ ] Generate 6-digit pair code for company pairing
- [ ] QR code generation for live link
- [ ] QR code generation for pair code
- [ ] Copy to clipboard functionality

### Shift Reports
- [ ] Shift complete screen with summary
- [ ] Static report page (web view)
- [ ] Timeline view of photos and events
- [ ] Report link transitions from live to static after shift ends

### PDF Generation
- [ ] Server-side PDF generation endpoint
- [ ] PDF with shift details, photos, and timestamps
- [ ] PDF with location data and route map
- [ ] PDF download functionality
- [ ] PDF metadata and integrity hash

### Database Schema
- [ ] Guards table
- [ ] Shifts table
- [ ] LocationPoints table
- [ ] PhotoEvents table
- [ ] PairCodes table
- [ ] Pairings table (for company portal)
- [ ] PdfReports table

### Backend API
- [ ] Create shift endpoint
- [ ] Update shift endpoint (end shift)
- [ ] Upload photo endpoint with pre-signed URLs
- [ ] Batch location points endpoint
- [ ] Generate pair code endpoint
- [ ] Validate pair code endpoint
- [ ] Get shift details endpoint
- [ ] Generate PDF endpoint
- [ ] Real-time location updates (WebSocket or polling)

### UI Components
- [ ] ScreenContainer with proper safe areas
- [ ] Custom button components (primary, secondary, destructive)
- [ ] Status badges and indicators
- [ ] Card components with tap feedback
- [ ] Input fields with validation
- [ ] Camera overlay components
- [ ] QR code display component
- [ ] Share sheet modal

### Settings & Preferences
- [ ] Settings screen with profile management
- [ ] Location update frequency preferences
- [ ] Photo quality settings
- [ ] Notifications toggle
- [ ] Sign out functionality

### Error Handling & Edge Cases
- [ ] Handle denied location permissions
- [ ] Handle denied camera permissions
- [ ] Handle offline mode with queuing
- [ ] Handle incorrect device time (use server time)
- [ ] Handle network errors gracefully
- [ ] Handle battery optimization warnings

### Testing & Polish
- [ ] Test complete shift flow end-to-end
- [ ] Test photo capture and upload
- [ ] Test location tracking accuracy
- [ ] Test offline mode and sync
- [ ] Test share functionality
- [ ] Test PDF generation
- [ ] Add haptic feedback to key actions
- [ ] Add loading states and progress indicators
- [ ] Add error messages and retry options

## Future Features (Not MVP)
- [ ] Company portal (web interface)
- [ ] Multi-guard live map view
- [ ] Client sharing links
- [ ] Billing and subscription management
- [ ] Shift history view
- [ ] Route playback animation
- [ ] Geofencing alerts
- [ ] Voice notes during shift


## Completed Features (Phase 1)

- [x] Database schema with all required tables
- [x] Backend API routes for shifts, locations, and photos
- [x] User authentication integration
- [x] Home screen with shift status display
- [x] Start shift screen with site name input
- [x] Active shift screen with timer
- [x] Camera integration for timestamp photos
- [x] Location tracking during active shift
- [x] Share live link functionality
- [x] Pair code generation and display
- [x] App logo and branding
- [x] Permission handling for camera and location


## New Features to Implement

### Shift Ending Flow
- [ ] End shift confirmation screen
- [ ] Mandatory final photo capture
- [ ] Final photo upload with location
- [ ] Shift completion summary screen
- [ ] Update shift status to completed
- [ ] Stop location tracking on shift end

### PDF Report Generation
- [ ] Server-side PDF generation endpoint
- [ ] PDF template with shift details
- [ ] Include all photos with timestamps
- [ ] Add location timeline/map to PDF
- [ ] Generate integrity hash for verification
- [ ] Store PDF URL in database
- [ ] Download PDF functionality

### Live Viewer Page
- [ ] Public viewer route (/live/[token])
- [ ] Real-time location display on map
- [ ] Show shift status and elapsed time
- [ ] Display photo feed during active shift
- [ ] Transition to static report after shift ends
- [ ] PDF download button on static report
- [ ] Auto-refresh for live updates


## Progress Update

### Shift Ending Flow (Completed)
- [x] End shift confirmation screen
- [x] Mandatory final photo capture
- [x] Final photo upload with location
- [x] Shift completion summary screen
- [x] Update shift status to completed
- [x] Navigation from active shift to end flow


### PDF Report Generation (Completed)
- [x] Server-side PDF generation endpoint
- [x] PDF template with shift details
- [x] Include all photos with timestamps
- [x] Add location timeline to PDF
- [x] Generate integrity hash for verification
- [x] Store PDF URL in database
- [x] Download PDF functionality in app

### Live Viewer Page (Completed)
- [x] Public viewer route (/live/[token])
- [x] Real-time location display
- [x] Show shift status and elapsed time
- [x] Display photo feed during active shift
- [x] Transition to static report after shift ends
- [x] PDF download button on static report
- [x] Auto-refresh for live updates (5s interval)
- [x] Pull-to-refresh functionality
- [x] Google Maps integration for location viewing


## Bug Fixes

### Routing Issues
- [x] Fix "Unmatched Route" error on app launch
- [x] Verify all navigation paths are correct
- [x] Ensure tab routes are properly configured
- [x] Add missing route files if needed
