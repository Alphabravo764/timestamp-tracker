# Deployment Flow Diagram

## Complete Deployment Process

```
┌─────────────────────────────────────────────────────────────────┐
│                     TIMESTAMP TRACKER DEPLOYMENT                 │
└─────────────────────────────────────────────────────────────────┘

STEP 1: SETUP LOCAL DEVELOPMENT
┌──────────────────────────────────────────────────────────────────┐
│ 1. Clone/Download code from GitHub or Manus                      │
│ 2. Run: pnpm install                                             │
│ 3. Create .env file with Google Maps API key                    │
│ 4. Run: pnpm test (verify all 36 tests pass)                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 2: PUSH TO GITHUB
┌──────────────────────────────────────────────────────────────────┐
│ 1. Create new GitHub repository (private recommended)            │
│ 2. git init && git add . && git commit -m "Initial commit"      │
│ 3. git remote add origin https://github.com/USER/REPO.git       │
│ 4. git push -u origin main                                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 3: DEPLOY TO RAILWAY
┌──────────────────────────────────────────────────────────────────┐
│ 1. Go to railway.app → Login with GitHub                        │
│ 2. New Project → Deploy from GitHub repo                        │
│ 3. Select your repository → Deploy Now                          │
│ 4. Wait 2-3 minutes for first deployment                        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 4: ADD MYSQL DATABASE
┌──────────────────────────────────────────────────────────────────┐
│ 1. In Railway project → Click "+ New"                           │
│ 2. Select "Database" → "Add MySQL"                              │
│ 3. Railway auto-sets DATABASE_URL environment variable          │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 5: RUN DATABASE MIGRATIONS
┌──────────────────────────────────────────────────────────────────┐
│ 1. Railway → Your service → Settings → Build                    │
│ 2. Change Build Command to:                                     │
│    "pnpm install && pnpm db:push && pnpm build"                 │
│ 3. Click "Redeploy" to create database tables                   │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 6: CONFIGURE ENVIRONMENT VARIABLES
┌──────────────────────────────────────────────────────────────────┐
│ Railway → Your service → Variables tab                           │
│                                                                  │
│ ✓ NODE_ENV=production (auto-set)                                │
│ ✓ PORT=3000 (auto-set)                                          │
│ ✓ DATABASE_URL=(auto-set from MySQL)                            │
│ ✗ JWT_SECRET=(ADD THIS MANUALLY)                                │
│                                                                  │
│ Generate JWT_SECRET:                                            │
│ node -e "console.log(require('crypto').randomBytes(32).        │
│          toString('hex'))"                                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 7: GENERATE PUBLIC URL
┌──────────────────────────────────────────────────────────────────┐
│ 1. Railway → Your service → Settings → Networking               │
│ 2. Click "Generate Domain"                                      │
│ 3. Copy URL: https://your-app.up.railway.app                    │
│ 4. SAVE THIS URL - you need it for mobile app!                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 8: TEST BACKEND
┌──────────────────────────────────────────────────────────────────┐
│ curl https://your-app.up.railway.app/api/health                 │
│                                                                  │
│ Expected response:                                               │
│ {"ok":true,"timestamp":1234567890}                              │
│                                                                  │
│ ✓ If you see this, backend is deployed successfully!            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 9: CONFIGURE MOBILE APP
┌──────────────────────────────────────────────────────────────────┐
│ Update .env file in project root:                               │
│                                                                  │
│ GOOGLE_MAPS_API_KEY=your_key_here                               │
│ EXPO_PUBLIC_API_BASE_URL=https://your-app.up.railway.app        │
│ JWT_SECRET=same_as_railway                                      │
│                                                                  │
│ ⚠️  CRITICAL: Must set EXPO_PUBLIC_API_BASE_URL before build!   │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 10: TEST MOBILE APP LOCALLY
┌──────────────────────────────────────────────────────────────────┐
│ 1. Run: pnpm dev:metro                                          │
│ 2. Scan QR code with Expo Go app                                │
│ 3. Start a shift → verify data syncs to Railway                 │
│ 4. Share live tracker link → open in browser                    │
│ 5. Verify URL is Railway (not manus.computer)                   │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 11: BUILD PRODUCTION APK
┌──────────────────────────────────────────────────────────────────┐
│ Option A: Using EAS Build (recommended)                         │
│   1. npm install -g eas-cli                                     │
│   2. eas login                                                  │
│   3. eas build --platform android --profile production          │
│                                                                  │
│ Option B: Local Build                                           │
│   1. npx expo build:android                                     │
│                                                                  │
│ Download APK and test on real device                            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
STEP 12: PUBLISH TO GOOGLE PLAY STORE
┌──────────────────────────────────────────────────────────────────┐
│ 1. Create Google Play Console account ($25 one-time fee)        │
│ 2. Create new app in console                                    │
│ 3. Upload APK                                                   │
│ 4. Fill in app details, screenshots, privacy policy             │
│ 5. Submit for review (1-3 days)                                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                         ┌─────────┐
                         │ SUCCESS │
                         └─────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        FINAL RESULT                              │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Backend: https://your-app.up.railway.app                      │
│ ✓ Live Tracker: https://your-app.up.railway.app/live/ABC123     │
│ ✓ Mobile App: Published on Google Play Store                    │
│ ✓ Database: MySQL on Railway with automatic backups             │
│ ✓ Cost: $0/month (Railway free tier)                            │
└─────────────────────────────────────────────────────────────────┘
```

## Key URLs to Save

| Component | URL | Example |
|-----------|-----|---------|
| **Backend API** | `https://your-app.up.railway.app` | `https://timestamp-tracker.up.railway.app` |
| **Health Check** | `https://your-app.up.railway.app/api/health` | Test backend is running |
| **Live Tracker** | `https://your-app.up.railway.app/live/[CODE]` | `https://timestamp-tracker.up.railway.app/live/ABC123` |
| **Railway Dashboard** | `https://railway.app/project/[ID]` | Monitor logs and metrics |
| **GitHub Repo** | `https://github.com/[USER]/[REPO]` | Source code |

## Critical Checkpoints

Before moving to the next step, verify:

### ✓ After Step 4 (Database Added)
```bash
# Check Railway logs show database connection
Railway → Your service → Deployments → View logs
# Should see: "Database connected successfully"
```

### ✓ After Step 5 (Migrations Run)
```bash
# Check database tables exist
Railway → MySQL database → Data
# Should see tables: shifts, locationPoints, photoEvents, etc.
```

### ✓ After Step 8 (Backend Tested)
```bash
curl https://your-app.up.railway.app/api/health
# Must return: {"ok":true,"timestamp":...}
```

### ✓ After Step 10 (Mobile App Tested)
- Start shift → Check Railway logs for "Sync shift" message
- Share link → URL must be Railway (not manus.computer)
- Open link in browser → See live tracking page

### ✓ After Step 11 (APK Built)
- Install APK on real Android device
- Start shift → Verify syncs to Railway
- Check live tracker uses Railway URL
- Generate PDF → Verify photos appear

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| Railway build fails | Check `package.json` scripts are correct |
| Database connection error | Verify MySQL database is added and running |
| "Table not found" error | Run `pnpm db:push` in Railway build command |
| Mobile app uses manus.computer | Set `EXPO_PUBLIC_API_BASE_URL` before building |
| Live tracker returns 404 | Verify shift was synced (check Railway logs) |
| Photos not in PDF | Already fixed in latest version |
| CORS error | Backend already configured, check URL is correct |

## Time Estimates

| Step | Time Required |
|------|---------------|
| Local setup | 10-15 minutes |
| Push to GitHub | 5 minutes |
| Deploy to Railway | 5-10 minutes |
| Configure database | 5 minutes |
| Test backend | 2 minutes |
| Configure mobile app | 5 minutes |
| Test mobile app | 10-15 minutes |
| Build APK | 15-30 minutes |
| **Total** | **60-90 minutes** |

Publishing to Google Play Store adds 1-3 days for review.

## Support Contacts

- **Railway Support**: https://discord.gg/railway
- **Expo Support**: https://chat.expo.dev
- **GitHub Issues**: Create issue in your repository
