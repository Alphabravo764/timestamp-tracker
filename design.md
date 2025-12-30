# Timestamp Tracker - Mobile App Design

## Design Philosophy

This mobile app follows **Apple Human Interface Guidelines (HIG)** to feel like a first-party iOS app. The design prioritizes **one-handed usage** in **portrait orientation (9:16)** with clear, functional interfaces suitable for field staff working in security, facilities management, and similar sectors.

## Color Scheme

**Primary Brand Color:** Deep Blue (#0a7ea4) - Represents trust, professionalism, and security
**Accent Colors:**
- Success Green (#22C55E) - Active shifts, completed actions
- Warning Amber (#F59E0B) - Alerts, important notices
- Error Red (#EF4444) - Critical issues, required actions

**Background Colors:**
- Light mode: Clean white (#ffffff) with subtle gray surfaces (#f5f5f5)
- Dark mode: Deep charcoal (#151718) with elevated surfaces (#1e2022)

## Screen List & Layouts

### 1. **Setup Screen** (First-time only)
**Purpose:** Collect staff identity information

**Content:**
- App logo and welcome message
- Input fields:
  - Full name (required)
  - Phone number (optional)
  - Email (optional)
- Optional: Camera button to capture profile photo
- Large "Get Started" button at bottom

**Layout:** Centered form with generous spacing, keyboard-aware scrolling

---

### 2. **Home Screen** (Main entry point)
**Purpose:** Start new shifts and view current status

**Content:**
- Header: Staff name and profile photo (small circle, top-left)
- Status card showing:
  - "Ready to Start" or "On Shift" status
  - If on shift: elapsed time, site name, live location indicator
- Large primary button:
  - "Start Shift" (when idle)
  - "View Active Shift" (when on shift)
- Bottom section: Quick access to last completed shift report (if available)

**Layout:** Card-based with prominent CTA button, safe area padding

---

### 3. **Start Shift Screen**
**Purpose:** Configure and begin a new shift

**Content:**
- Site name input field (required, large text)
- Notes field (optional, multiline)
- Location permission status indicator
- Large "Start Shift" button (disabled until site name entered)
- Cancel button (text-only, top-left)

**Layout:** Form-style with focus on site name input, keyboard dismissal on scroll

---

### 4. **Active Shift Screen** (Primary working screen)
**Purpose:** Main interface during shift with all key actions

**Content:**
- **Top section:**
  - Site name (large, bold)
  - Elapsed time (prominent, updating every second)
  - Status badge: "ON SHIFT" (green)
  
- **Action cards (vertical stack):**
  1. **Camera Card:**
     - Large camera icon
     - "Take Timestamp Photo" button
     - Photo count indicator
  
  2. **Share Card:**
     - "Share Live Link" button with share icon
     - "Show Pair Code" button with QR code icon
     - Subtitle: "Let others track your location"
  
  3. **Location Card:**
     - Mini map preview (optional, if not too complex)
     - Last location update time
     - GPS accuracy indicator
  
- **Bottom:**
  - Large "End Shift" button (red, requires confirmation)

**Layout:** Scrollable card stack with generous tap targets, fixed bottom button

---

### 5. **Camera Screen**
**Purpose:** Capture timestamped photos with location

**Content:**
- Full-screen camera viewfinder
- Timestamp overlay (top): current date/time
- Location overlay (top): coordinates or "Acquiring location..."
- Capture button (bottom center, large circular)
- Cancel button (top-left)
- Flash toggle (top-right)

**Layout:** Full-screen native camera with minimal UI overlays

---

### 6. **Photo Preview Screen**
**Purpose:** Review and confirm captured photo

**Content:**
- Full-screen photo preview
- Timestamp and location burned into image (visible overlay)
- Bottom actions:
  - "Retake" button (secondary)
  - "Save Photo" button (primary, green)

**Layout:** Full-screen image with bottom action bar

---

### 7. **Share Sheet Screen**
**Purpose:** Display and share live link and pair code

**Content:**
- Live link URL (copyable text field)
- QR code for live link (large, centered)
- "Copy Link" button
- "Share Link" button (opens native share sheet)
- Divider
- Pair code (large, bold, 6-digit format: XXX-XXX)
- QR code for pair code
- "Copy Pair Code" button
- Info text: "Pair code expires when shift ends"

**Layout:** Centered content with clear sections, easy copy actions

---

### 8. **End Shift Confirmation Screen**
**Purpose:** Require final photo before ending shift

**Content:**
- Warning icon
- Title: "End Your Shift"
- Message: "Take a final timestamp photo to complete your shift"
- "Take Final Photo" button (primary)
- "Cancel" button (secondary)

**Layout:** Modal-style centered dialog

---

### 9. **Shift Complete Screen**
**Purpose:** Confirm shift ended and provide report access

**Content:**
- Success checkmark icon (large, green)
- Title: "Shift Complete"
- Shift summary:
  - Site name
  - Duration
  - Photos taken count
  - Start/end times
- Action buttons:
  - "View Report" (primary)
  - "Share Report Link" (secondary)
  - "Done" (returns to home)

**Layout:** Centered success state with clear next actions

---

### 10. **Settings Screen** (Accessible from home)
**Purpose:** Manage profile and app preferences

**Content:**
- Profile section:
  - Photo, name, contact info
  - "Edit Profile" button
- Preferences:
  - Location update frequency
  - Photo quality settings
  - Notifications toggle
- About section:
  - App version
  - Terms & Privacy links
- "Sign Out" button (bottom, red)

**Layout:** Grouped list style (iOS Settings-like)

---

## Key User Flows

### Flow 1: Starting a Shift
1. User opens app → **Home Screen**
2. Taps "Start Shift" → **Start Shift Screen**
3. Enters site name (e.g., "Westfield Mall - North Entrance")
4. Optionally adds notes
5. Taps "Start Shift" → **Active Shift Screen**
6. Location tracking begins automatically
7. Shift timer starts counting

### Flow 2: Taking Timestamp Photos During Shift
1. From **Active Shift Screen**
2. Taps "Take Timestamp Photo" → **Camera Screen**
3. Camera opens with timestamp/location overlay
4. Taps capture button → **Photo Preview Screen**
5. Reviews photo with burned-in timestamp
6. Taps "Save Photo" → Returns to **Active Shift Screen**
7. Photo count updates

### Flow 3: Sharing Live Link
1. From **Active Shift Screen**
2. Taps "Share Live Link" → **Share Sheet Screen**
3. Sees live link URL and QR code
4. Taps "Copy Link" or "Share Link"
5. Shares via messaging app or email
6. Recipient opens link in browser → sees live location map

### Flow 4: Showing Pair Code for Company Portal
1. From **Active Shift Screen**
2. Taps "Show Pair Code" → **Share Sheet Screen**
3. Sees 6-digit pair code (e.g., "ABC-123") and QR code
4. Company admin scans QR or manually enters code in portal
5. Pairing established (auto-approved)
6. Company can now view live location in portal

### Flow 5: Ending a Shift
1. From **Active Shift Screen**
2. Taps "End Shift" → **End Shift Confirmation Screen**
3. Taps "Take Final Photo" → **Camera Screen**
4. Captures final photo → **Photo Preview Screen**
5. Confirms photo → **Shift Complete Screen**
6. Location tracking stops
7. Shift data locked
8. Report link transitions from live to static
9. User can view report or return home

### Flow 6: Viewing Completed Shift Report
1. From **Shift Complete Screen** or **Home Screen** (last shift link)
2. Taps "View Report" → Opens report URL in in-app browser
3. Sees static report page with:
   - Shift details (site, duration, times)
   - Timeline of photos with timestamps
   - Location data summary
   - "Download PDF" button
4. Optionally generates and downloads PDF

---

## Component Patterns

### Buttons
- **Primary actions:** Rounded rectangles, full width, bold text, primary color background
- **Secondary actions:** Outlined style or text-only, same width as primary
- **Destructive actions:** Red background (e.g., "End Shift", "Sign Out")

### Cards
- Rounded corners (12px radius)
- Subtle shadow in light mode
- Border in dark mode
- Padding: 16px
- Tap feedback: opacity 0.7

### Input Fields
- Single-line: Rounded rectangle with border
- Multi-line: Larger height, scrollable
- Focus state: Primary color border
- Clear button on right (when text present)

### Status Indicators
- Badges: Small rounded pills with color coding
- Icons: SF Symbols style (simple, recognizable)
- Timestamps: Relative format during shift ("2m ago"), absolute after shift ends

### Navigation
- **Modal screens:** Present from bottom with dismiss gesture
- **Full-screen flows:** Push navigation with back button
- **Tab bar:** Not needed (single-purpose app)

---

## Accessibility & Safety

- **Large tap targets:** Minimum 44x44pt for all interactive elements
- **High contrast text:** Meets WCAG AA standards
- **VoiceOver labels:** All buttons and images properly labeled
- **Dynamic Type support:** Text scales with system font size settings
- **Location permissions:** Clear explanation before requesting
- **Camera permissions:** Clear explanation before requesting
- **Battery optimization:** Adaptive location tracking to preserve battery
- **Offline resilience:** Queue photos and locations when offline, sync when reconnected

---

## Technical Considerations

- **Location tracking:** Background location updates while shift active (foreground service on Android, background modes on iOS)
- **Photo storage:** Compress photos before upload, store originals with EXIF metadata
- **Timestamp accuracy:** Use server time for authoritative timestamps, display local time to user
- **Link generation:** Unique tokens for each shift, secure and unguessable
- **Pair code format:** 6 characters (3-3 with hyphen), alphanumeric, expires at shift end
- **Real-time updates:** WebSocket or polling for live location updates on viewer page
- **PDF generation:** Server-side rendering with photos, map, and metadata

---

## Future Enhancements (Not MVP)

- Shift history view (premium feature)
- Route playback animation
- Geofencing alerts (e.g., "Staff left designated area")
- Voice notes during shift
- Incident reporting with photo attachments
- Multi-language support
- Offline shift mode with full sync later
