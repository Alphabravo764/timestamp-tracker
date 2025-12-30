# Timestamp Camera App - TODO

## Core Features

### Camera with Timestamp Overlay
- [ ] Main camera screen with live preview
- [ ] Timestamp overlay (date + time) on camera view
- [ ] Location overlay (coordinates) on camera view
- [ ] Capture button with haptic feedback
- [ ] Photo preview after capture
- [ ] Save photo to local storage

### Photo History
- [ ] Gallery view showing all captured photos
- [ ] Display timestamp and location for each photo
- [ ] Tap to view full-screen photo
- [ ] Delete photo functionality
- [ ] Pull-to-refresh

### Live Location Sharing
- [ ] Toggle to enable/disable live location tracking
- [ ] Generate shareable link when tracking is enabled
- [ ] Share link via native share sheet
- [ ] Public viewer page showing real-time location on map
- [ ] Auto-update location every 30 seconds when tracking

### Report Generation
- [ ] Generate PDF report from selected date range
- [ ] Include all photos with timestamps and locations
- [ ] Show location map with photo markers
- [ ] Download/share PDF report

## Implementation Status

### Phase 1: Core Camera (DONE)
- [x] Remove complex shift management
- [x] Simplify to single camera tab
- [x] Add timestamp/location overlay to camera
- [x] Implement photo capture and local storage

### Phase 2: Photo History (DONE)
- [x] Build gallery view
- [x] Add photo metadata display
- [x] Implement delete functionality

### Phase 3: Live Sharing (DONE)
- [x] Background location tracking toggle
- [x] Shareable link generation (OpenStreetMap)
- [x] Location history recording

### Phase 4: Reports
- [ ] PDF generation with photos
- [ ] Location map visualization
