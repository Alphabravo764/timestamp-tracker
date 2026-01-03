# Data Expiration Policy

## Overview

This document clarifies what data expires and what data is stored permanently in the Timestamp Tracker app.

## Pair Code Expiration (24 Hours)

**What expires:**
- The **pair code** used for live shift monitoring expires **24 hours** after the shift starts
- After expiration, the live viewer link (`/viewer/{PAIR_CODE}`) will no longer work
- Supervisors/managers cannot watch the shift in real-time after expiration

**What this means:**
- Live monitoring is only available during and shortly after the shift
- Pair codes are temporary security tokens for real-time access
- After 24 hours, the pair code becomes invalid

## Permanent Data Storage

**What is stored permanently:**
- ✅ **Shift records** - All shift data (start/end times, duration, site, staff)
- ✅ **Location history** - All GPS coordinates and timestamps
- ✅ **Photos** - All captured photos with timestamps and watermarks
- ✅ **Notes** - All shift notes and observations
- ✅ **Addresses** - Reverse-geocoded street addresses

**Where to access historical data:**
- **History tab** in the mobile app shows all past shifts
- **Web viewer** (via pair code) works for 24 hours
- **PDF reports** can be generated anytime from History tab
- **Photo exports** available anytime from History tab

## Data Retention

| Data Type | Retention Period | Access Method |
|-----------|------------------|---------------|
| Pair Code (Live Link) | 24 hours | Web viewer URL |
| Shift Records | Permanent | History tab |
| Location Points | Permanent | History tab, PDF reports |
| Photos | Permanent | History tab, Photo gallery |
| Notes | Permanent | History tab, PDF reports |

## Why 24-Hour Expiry for Pair Codes?

1. **Security** - Prevents unauthorized long-term access to shift data
2. **Privacy** - Guards' real-time locations aren't accessible indefinitely
3. **Performance** - Reduces server load from expired live monitoring sessions
4. **Compliance** - Aligns with GDPR data minimization principles

## Accessing Expired Shift Data

After the 24-hour pair code expiry:

1. **Open the mobile app**
2. **Go to History tab**
3. **Select the shift**
4. **Use these options:**
   - 🔗 View Web Report (opens full web viewer)
   - 📄 Download PDF (generates PDF report)
   - 📤 Share as Text (creates text summary)
   - 🗺️ View Trail on Map (opens Google Maps route)
   - 📦 Export All Photos (downloads all photos)

## Data Deletion

Users can manually delete shift data:
- **Delete individual shifts** from History tab
- **Download My Data** from Settings (GDPR compliance)
- Deleted data is permanently removed from the database

## Questions?

If you have questions about data retention or expiration, please contact support at https://help.manus.im
