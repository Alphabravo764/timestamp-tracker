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
