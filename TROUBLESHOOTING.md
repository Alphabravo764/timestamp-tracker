# Troubleshooting Guide

Complete troubleshooting guide for Timestamp Tracker deployment and common issues.

---

## Table of Contents

1. [Railway Deployment Issues](#railway-deployment-issues)
2. [Database Issues](#database-issues)
3. [Mobile App Issues](#mobile-app-issues)
4. [Live Tracking Issues](#live-tracking-issues)
5. [PDF Generation Issues](#pdf-generation-issues)
6. [Performance Issues](#performance-issues)
7. [Error Messages Reference](#error-messages-reference)

---

## Railway Deployment Issues

### Issue: Railway Build Fails

**Symptoms:**
- Build fails with "command not found" error
- Deployment shows red "Failed" status
- Logs show npm/pnpm errors

**Diagnosis:**
```bash
# Check Railway logs
Railway → Your service → Deployments → Latest → View logs
```

**Solutions:**

1. **Verify package.json scripts exist:**
   ```json
   {
     "scripts": {
       "build": "esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
       "start": "NODE_ENV=production node dist/index.js"
     }
   }
   ```

2. **Check build command in Railway:**
   - Railway → Settings → Build
   - Should be: `pnpm install && pnpm build`
   - Or: `pnpm install && pnpm db:push && pnpm build`

3. **Verify pnpm-lock.yaml exists:**
   ```bash
   # In your project
   ls -la pnpm-lock.yaml
   # If missing, run: pnpm install
   ```

4. **Check Node.js version:**
   - Railway uses Node.js 22 by default
   - Verify package.json specifies compatible version
   - Add to package.json if needed:
     ```json
     "engines": {
       "node": ">=22.0.0"
     }
     ```

### Issue: Railway Deployment Succeeds But App Crashes

**Symptoms:**
- Build succeeds (green checkmark)
- App crashes immediately after start
- Logs show error then restart loop

**Diagnosis:**
```bash
# Check startup logs
Railway → Your service → Deployments → Latest → View logs

# Look for error messages right after "Starting..."
```

**Common Causes:**

1. **Missing DATABASE_URL:**
   ```
   Error: DATABASE_URL is not defined
   ```
   **Solution:** Add MySQL database (see Step 4 in deployment guide)

2. **Missing JWT_SECRET:**
   ```
   Error: JWT_SECRET is required
   ```
   **Solution:**
   ```bash
   # Generate secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Add to Railway
   Railway → Your service → Variables → + New Variable
   Name: JWT_SECRET
   Value: (paste generated secret)
   ```

3. **Port binding error:**
   ```
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   **Solution:** Railway sets PORT automatically, ensure code uses `process.env.PORT`

### Issue: Railway URL Not Generated

**Symptoms:**
- Deployment succeeds
- No public URL available
- "Generate Domain" button missing

**Solution:**
1. Railway → Your service → Settings → Networking
2. Scroll to "Public Networking"
3. Click "Generate Domain"
4. If button is disabled, check:
   - Service is running (green status)
   - No port binding errors in logs
   - Service exposes port 3000

---

## Database Issues

### Issue: "Table Does Not Exist" Error

**Symptoms:**
```
Error: Table 'railway.shifts' doesn't exist
```

**Diagnosis:**
```bash
# Check if migrations were run
Railway → MySQL database → Data
# Look for tables: shifts, locationPoints, photoEvents
```

**Solution:**

1. **Run migrations manually:**
   ```bash
   # Update Railway build command
   Railway → Your service → Settings → Build
   Change to: pnpm install && pnpm db:push && pnpm build
   
   # Redeploy
   Railway → Deployments → Redeploy
   ```

2. **Verify migration files exist:**
   ```bash
   # In your project
   ls -la drizzle/schema.ts
   ls -la drizzle/migrations/
   ```

3. **Check database connection:**
   ```bash
   # In Railway logs, look for:
   "Database connected successfully"
   ```

### Issue: Database Connection Timeout

**Symptoms:**
```
Error: connect ETIMEDOUT
Error: Connection lost: The server closed the connection
```

**Diagnosis:**
```bash
# Check MySQL database status
Railway → MySQL database → Should show "Active"

# Check DATABASE_URL is set
Railway → Your service → Variables → DATABASE_URL
```

**Solutions:**

1. **Verify MySQL database is running:**
   - Railway → MySQL database
   - Status should be green "Active"
   - If crashed, restart it

2. **Check DATABASE_URL format:**
   ```
   mysql://user:password@host:port/database
   ```
   - Should be automatically set by Railway
   - Don't modify it manually

3. **Increase connection timeout:**
   - Add to Railway environment variables:
     ```
     DATABASE_CONNECTION_TIMEOUT=30000
     ```

### Issue: Too Many Database Connections

**Symptoms:**
```
Error: Too many connections
Error: ER_CON_COUNT_ERROR
```

**Solution:**

1. **Enable connection pooling** (already configured in code):
   ```typescript
   // server/_core/db.ts
   pool: {
     min: 2,
     max: 10
   }
   ```

2. **Reduce concurrent requests:**
   - Add rate limiting
   - Optimize queries to be faster
   - Close connections properly

3. **Upgrade Railway plan:**
   - Free tier: 10 connections
   - Hobby plan: 100 connections

---

## Mobile App Issues

### Issue: App Uses manus.computer URL Instead of Railway

**Symptoms:**
- Live tracker link shows `https://8081-xxx.manus.computer`
- App can't connect after deploying APK
- "Network request failed" errors

**Diagnosis:**
```bash
# Check environment variable
echo $EXPO_PUBLIC_API_BASE_URL

# Should output your Railway URL, not manus.computer
```

**Solution:**

1. **Set environment variable before building:**
   ```bash
   # Create/update .env file
   echo "EXPO_PUBLIC_API_BASE_URL=https://your-app.up.railway.app" > .env
   
   # Rebuild app
   eas build --platform android --profile production
   ```

2. **Verify in code:**
   ```typescript
   // constants/oauth.ts
   const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
   console.log('API Base URL:', API_BASE_URL);
   // Should log your Railway URL
   ```

3. **Clear cache and rebuild:**
   ```bash
   # Clear Metro cache
   pnpm start --clear
   
   # Clear build cache
   rm -rf .expo
   rm -rf node_modules/.cache
   ```

### Issue: "Network Request Failed" on Mobile

**Symptoms:**
- App can't sync data
- Error: "Network request failed"
- Works on WiFi but not on mobile data

**Diagnosis:**
```bash
# Test backend from mobile browser
# Open: https://your-app.up.railway.app/api/health
# Should return: {"ok":true,"timestamp":...}
```

**Solutions:**

1. **Check Railway URL is accessible:**
   ```bash
   curl https://your-app.up.railway.app/api/health
   ```

2. **Verify HTTPS (not HTTP):**
   - Railway provides HTTPS automatically
   - Ensure URL starts with `https://`
   - Mobile apps require HTTPS for security

3. **Check CORS configuration:**
   - Backend already allows all origins
   - If still blocked, check Railway logs for CORS errors

4. **Test on different network:**
   - Try WiFi vs mobile data
   - Some corporate networks block external APIs

### Issue: GPS Location Not Working

**Symptoms:**
- "Location error: Current location is unavailable"
- GPS coordinates show as null
- Location permission denied

**Solutions:**

1. **Grant location permission:**
   - Android: Settings → Apps → Timestamp Tracker → Permissions → Location → Allow all the time
   - iOS: Settings → Privacy → Location Services → Timestamp Tracker → Always

2. **Enable location services:**
   - Android: Settings → Location → On
   - iOS: Settings → Privacy → Location Services → On

3. **Test GPS outside:**
   - GPS may not work indoors
   - Go outside with clear sky view
   - Wait 30-60 seconds for GPS lock

4. **Check code handles errors:**
   ```typescript
   // Already implemented in app/(tabs)/index.tsx
   try {
     const location = await Location.getCurrentPositionAsync({
       accuracy: Location.Accuracy.High,
     });
   } catch (error) {
     // Falls back to last known location
     const lastLocation = await Location.getLastKnownPositionAsync();
   }
   ```

### Issue: Photos Not Uploading

**Symptoms:**
- Photos taken but don't appear in live tracker
- "Photo upload failed" error
- Photos show in app but not in PDF

**Diagnosis:**
```bash
# Check Railway logs for photo upload
Railway → Your service → Deployments → View logs
# Look for: "Sync photo" messages
```

**Solutions:**

1. **Check photo size:**
   - Large photos may timeout
   - Compress photos before upload
   - Already implemented in code (max 1MB)

2. **Verify storage permissions:**
   - Android: Settings → Apps → Timestamp Tracker → Permissions → Storage → Allow
   - iOS: Settings → Privacy → Photos → Timestamp Tracker → All Photos

3. **Check network connection:**
   - Photos upload when online
   - Offline photos queue and upload later
   - Check sync queue in AsyncStorage

---

## Live Tracking Issues

### Issue: Live Tracker Returns 404

**Symptoms:**
- Opening `/live/ABC123` shows "Not Found"
- Link works in development but not production
- "Shift not found" error

**Diagnosis:**
```bash
# Check if shift exists in database
Railway → MySQL database → Data → shifts table
# Look for shift with matching pairCode

# Check Railway logs
Railway → Your service → Deployments → View logs
# Look for: "Sync shift" messages
```

**Solutions:**

1. **Verify shift was synced:**
   - Start shift in mobile app
   - Check Railway logs show "Sync shift" message
   - Verify shift appears in database

2. **Check pair code is correct:**
   - Pair codes are case-sensitive
   - Must be exact match (e.g., "ABC123" not "abc123")
   - Check share link shows correct code

3. **Verify live route exists:**
   ```bash
   # Check file exists
   ls -la app/live/[token].tsx
   ```

4. **Test API endpoint directly:**
   ```bash
   curl https://your-app.up.railway.app/api/sync/shift/ABC123
   # Should return shift data
   ```

### Issue: Live Tracker Not Updating

**Symptoms:**
- Live tracker shows old location
- New GPS points don't appear
- Map doesn't update in real-time

**Solutions:**

1. **Check polling interval:**
   - Live tracker polls every 5 seconds
   - Check browser console for errors
   - Verify API returns new data

2. **Verify location sync:**
   - Check Railway logs for "Sync location" messages
   - Verify GPS is working in mobile app
   - Check locationPoints table in database

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or open in incognito/private window

### Issue: Live Tracker Shows Wrong Location

**Symptoms:**
- Map shows location in ocean or wrong country
- Coordinates are swapped (lat/long reversed)
- Location jumps around randomly

**Solutions:**

1. **Check coordinate format:**
   - Latitude: -90 to 90
   - Longitude: -180 to 180
   - Verify database stores correct values

2. **Verify GPS accuracy:**
   - Low accuracy GPS can cause jumps
   - Check accuracy value in locationPoints table
   - Filter out points with accuracy > 100m

3. **Check Google Maps API key:**
   - Verify API key is valid
   - Check API key has Maps JavaScript API enabled
   - Check quota not exceeded

---

## PDF Generation Issues

### Issue: Photos Not Showing in PDF

**Symptoms:**
- PDF shows "Photo" text but no images
- Photos appear as broken images
- PDF generation succeeds but photos missing

**Solution:**

This issue is already fixed in the latest version. If you still see it:

1. **Verify fix is applied:**
   ```typescript
   // lib/pdf-generator.ts should have:
   if (photo.fileUrl) {
     html += `<img src="${photo.fileUrl}" class="photo-image" />`;
   }
   ```

2. **Check photo URLs are accessible:**
   ```bash
   # Test photo URL in browser
   # Should load the image
   ```

3. **Verify CSS is correct:**
   ```css
   .photo-image {
     width: 100%;
     height: auto;
     border-radius: 8px;
   }
   ```

### Issue: PDF Generation Fails

**Symptoms:**
- "Failed to generate PDF" error
- PDF download doesn't start
- App crashes when generating PDF

**Diagnosis:**
```bash
# Check browser console for errors
# Look for: PDF generation errors
```

**Solutions:**

1. **Check shift has data:**
   - At least one location point
   - At least one photo (optional)
   - Valid start/end times

2. **Verify Google Maps Static API:**
   - Check API key has Static Maps API enabled
   - Check quota not exceeded
   - Test static map URL directly

3. **Reduce PDF size:**
   - Limit photos to 10 per PDF
   - Compress images before adding
   - Reduce map size

---

## Performance Issues

### Issue: App Slow to Start Shift

**Symptoms:**
- "Start Shift" button takes long to respond
- App freezes when starting shift
- Slow GPS lock

**Solutions:**

1. **Optimize GPS acquisition:**
   - Use `Location.Accuracy.Balanced` instead of `High`
   - Increase timeout to 10 seconds
   - Fall back to last known location

2. **Reduce database queries:**
   - Cache shift list
   - Lazy load history
   - Index database columns

3. **Profile performance:**
   ```typescript
   // Add timing logs
   console.time('Start Shift');
   // ... code ...
   console.timeEnd('Start Shift');
   ```

### Issue: Live Tracker Slow to Load

**Symptoms:**
- Live tracker page takes 10+ seconds to load
- Map doesn't render
- Browser shows "Page Unresponsive"

**Solutions:**

1. **Optimize database queries:**
   - Add index on pairCode column
   - Limit location points to last 1000
   - Cache shift data

2. **Reduce map markers:**
   - Show only recent 100 points
   - Cluster nearby markers
   - Use polyline for route

3. **Enable caching:**
   - Cache shift data for 5 seconds
   - Use Redis for session storage
   - Enable browser caching

### Issue: Railway App Sleeps After 30 Minutes

**Symptoms:**
- First request after inactivity takes 30 seconds
- "Service Unavailable" error
- App works after retry

**This is normal on Railway free tier.** Solutions:

1. **Accept the behavior:**
   - Free tier sleeps after 30 min inactivity
   - First request wakes it up (~30 sec)
   - Subsequent requests are fast

2. **Keep app awake (not recommended):**
   - Ping health endpoint every 10 minutes
   - Uses more execution hours
   - May exceed free tier limits

3. **Upgrade to Hobby plan ($5/month):**
   - Always-on (no sleep)
   - Better performance
   - More resources

---

## Error Messages Reference

### Backend Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `DATABASE_URL is not defined` | MySQL not added | Add MySQL database in Railway |
| `JWT_SECRET is required` | Missing env var | Add JWT_SECRET to Railway variables |
| `Table 'railway.shifts' doesn't exist` | Migrations not run | Run `pnpm db:push` in build command |
| `connect ETIMEDOUT` | Database offline | Check MySQL status in Railway |
| `Too many connections` | Connection pool exhausted | Enable pooling, upgrade plan |
| `CORS error` | Wrong origin | Already fixed, check URL |

### Mobile App Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Network request failed` | Can't reach backend | Check EXPO_PUBLIC_API_BASE_URL |
| `Location error: unavailable` | GPS disabled | Enable location services |
| `Permission denied` | Missing permissions | Grant location/storage permissions |
| `Photo upload failed` | Network timeout | Check connection, retry |
| `Shift not found` | Not synced yet | Wait for sync, check logs |

### Live Tracker Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `404 Not Found` | Invalid pair code | Check code is correct |
| `Shift not found` | Not in database | Verify shift was synced |
| `Failed to load map` | Maps API error | Check API key, quota |
| `No location data` | GPS not working | Check mobile app GPS |

---

## Getting Help

If you can't resolve an issue:

1. **Check Railway logs:**
   ```
   Railway → Your service → Deployments → View logs
   ```

2. **Check browser console:**
   ```
   F12 → Console tab
   ```

3. **Check mobile app logs:**
   ```
   Expo Go → Shake device → View logs
   ```

4. **Search existing issues:**
   - GitHub repository issues
   - Railway Discord
   - Expo Discord

5. **Create new issue:**
   - Include error message
   - Include steps to reproduce
   - Include logs (sanitize sensitive data)

---

## Preventive Maintenance

### Weekly Tasks

- Check Railway credit usage
- Review error logs
- Monitor database size
- Test live tracking

### Monthly Tasks

- Update dependencies: `pnpm update`
- Review and optimize slow queries
- Check for security updates
- Backup database

### As Needed

- Scale Railway resources if needed
- Optimize images and assets
- Add caching for frequently accessed data
- Monitor and fix performance issues

---

**Last Updated:** January 2026
