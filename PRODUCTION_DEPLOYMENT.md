# Production Deployment Guide

## Backend URL Configuration

### How It Works

When you publish the app through Manus, the platform automatically handles the backend deployment and URL configuration:

1. **Development Mode** (Expo Go / Local Testing):
   - Backend runs on: `http://localhost:3000` or `https://3000-xxx.manus.computer`
   - The app automatically detects the development URL from Expo Constants
   - Live tracker URL: `https://8081-xxx.manus.computer/live/[PAIRCODE]`

2. **Production Mode** (After Publish):
   - Manus platform injects `API_BASE_URL` environment variable
   - This is automatically mapped to `EXPO_PUBLIC_API_BASE_URL`
   - The app uses this permanent URL for all API calls
   - Live tracker URL: `https://your-backend.manus.app/live/[PAIRCODE]`

### Environment Variable Mapping

The `scripts/load-env.js` file maps Manus platform variables to Expo public variables:

```javascript
const mappings = {
  API_BASE_URL: "EXPO_PUBLIC_API_BASE_URL",
  VITE_API_BASE_URL: "EXPO_PUBLIC_API_BASE_URL",
  // ... other mappings
};
```

### Code Implementation

The `constants/oauth.ts` file contains the `getApiBaseUrl()` function that:

1. **First priority**: Uses `EXPO_PUBLIC_API_BASE_URL` if set (production)
2. **Second priority**: Derives URL from current hostname on web (development)
3. **Fallback**: Uses relative URL

```typescript
export function getApiBaseUrl(): string {
  // If API_BASE_URL is set, use it (production)
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  // On web, derive from current hostname (development)
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  return "";
}
```

### Verification

After publishing, verify the backend URL is correctly configured:

1. **Check the app logs** - The app should log the API base URL on startup
2. **Test live tracking** - Start a shift and share the live tracker link
3. **Verify the URL** - The shared link should use the permanent domain, not manus.computer

### Troubleshooting

**Problem**: App still uses manus.computer URL after publish

**Solution**: 
1. Ensure you've published the latest version (with the env mapping fix)
2. Check that Manus platform is injecting `API_BASE_URL` environment variable
3. Rebuild the app after publish to pick up new environment variables

**Problem**: Live tracker returns 404

**Solution**:
1. Verify the backend service is marked as "Live" in Manus UI
2. Check that the database migrations have been applied
3. Ensure the shift was synced to the server (check server logs)

### Database Persistence

The app now uses **database storage** instead of in-memory storage:

- ✅ Shifts are stored in `shifts` table
- ✅ GPS locations are stored in `locationPoints` table
- ✅ Photos are stored in `photoEvents` table
- ✅ Data persists across server restarts
- ✅ Works in production after deployment

### Next Steps After Publish

1. **Get the production backend URL** from Manus platform
2. **Test the live tracker** with a real shift
3. **Submit to Google Play Store** - the app will use the permanent backend URL
4. **Monitor server logs** for any issues

## Support

If you encounter issues with backend URL configuration after publish, contact Manus support at https://help.manus.im
