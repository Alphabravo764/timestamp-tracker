# Live Viewer Debug Notes

## Current Issue
The live viewer at `/live/[token]` shows "Shift Not Found" because:

1. The server uses **in-memory storage** (`liveShifts` Map) for live shift data
2. When a shift is started on the mobile app, it syncs to the server via `/api/sync/shift`
3. The server stores this in the `liveShifts` Map
4. When someone opens `/live/PAIRCODE`, the live viewer fetches from `/api/sync/shift/PAIRCODE`
5. If the server was restarted OR the shift wasn't synced, the data won't be found

## The Problem
- The in-memory storage is lost when the server restarts
- For testing, we need an active shift with a synced pair code

## Solution Options
1. **For testing**: Start a shift on the app, then share the link - it should work
2. **For production**: Use database storage instead of in-memory Map

## API Endpoints
- POST `/api/sync/shift` - Create/update shift data
- POST `/api/sync/location` - Add location point
- POST `/api/sync/photo` - Add photo
- POST `/api/sync/note` - Add note
- POST `/api/sync/shift-end` - End shift
- GET `/api/sync/shift/:pairCode` - Get shift data

## Testing
The API returns `{"error":"Shift not found"}` for TEST123 because no shift with that pair code exists in memory.
