# Timestamp Tracker - Complete Setup Guide

**A mobile app for tracking security guard shifts with GPS, photos, and live monitoring.**

This guide provides step-by-step instructions to recreate this app from scratch with permanent deployment. Follow these instructions exactly to avoid common mistakes.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Backend Deployment (Railway)](#backend-deployment-railway)
5. [Mobile App Configuration](#mobile-app-configuration)
6. [Testing](#testing)
7. [Publishing to Google Play Store](#publishing-to-google-play-store)
8. [Common Mistakes to Avoid](#common-mistakes-to-avoid)

---

## Overview

### What This App Does

The Timestamp Tracker app allows security guards to track their shifts with automatic GPS logging and timestamped photos. Supervisors can view live tracking through a web interface.

**Key Features:**

- **Shift Tracking**: Start/end shifts with automatic GPS logging every 30 seconds
- **Photo Capture**: Take timestamped photos with GPS coordinates and watermarks
- **Live Monitoring**: Share a link for real-time shift tracking via web browser
- **PDF Reports**: Generate detailed shift reports with map, photos, and timeline
- **Offline Support**: Works without internet, syncs when connection returns

### Architecture

The app consists of two main components:

1. **Mobile App** (React Native + Expo)
   - Built with Expo SDK 54
   - Runs on iOS and Android
   - Stores data locally with AsyncStorage
   - Syncs to backend when online

2. **Backend Server** (Node.js + Express + MySQL)
   - REST API for shift synchronization
   - MySQL database for persistent storage
   - Serves live tracking web page
   - Deployed on Railway (free hosting)

---

## Prerequisites

Before starting, ensure you have:

### Required Accounts

- **GitHub account** (free) - for code hosting
- **Railway account** (free) - for backend hosting
- **Google account** (free) - for Google Maps API
- **Expo account** (optional) - for building mobile app

### Required Software

- **Node.js 22+** - [Download](https://nodejs.org/)
- **pnpm 9+** - Install: `npm install -g pnpm`
- **Git** - [Download](https://git-scm.com/)
- **Expo Go app** - Install on your phone for testing

### Required API Keys

- **Google Maps API Key** - [Get it here](https://developers.google.com/maps/documentation/javascript/get-api-key)
  - Enable: Maps JavaScript API, Geocoding API, Static Maps API

---

## Project Setup

### Step 1: Download the Code

If you're starting from the Manus checkpoint:

```bash
# Download the project files from Manus
# Extract to a folder, e.g., ~/timestamp-tracker
cd ~/timestamp-tracker
```

If you're cloning from GitHub:

```bash
git clone https://github.com/YOUR_USERNAME/timestamp-tracker.git
cd timestamp-tracker
```

### Step 2: Install Dependencies

```bash
# Install all dependencies
pnpm install

# This will install:
# - React Native and Expo dependencies
# - Backend server dependencies
# - Database tools (Drizzle ORM)
# - Testing frameworks
```

### Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Google Maps API Key (REQUIRED)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Backend API URL (will be set after Railway deployment)
EXPO_PUBLIC_API_BASE_URL=

# Database URL (will be set by Railway automatically)
DATABASE_URL=

# JWT Secret (generate a random string)
JWT_SECRET=your_random_32_character_string_here
```

**Generate JWT_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Verify Installation

```bash
# Run tests to verify everything is set up correctly
pnpm test

# Expected output: All 36 tests should pass
```

---

## Backend Deployment (Railway)

This section explains how to deploy the backend to Railway for permanent hosting.

### Why Railway?

Railway provides free hosting with these benefits:

- **500 execution hours/month** (enough for 24/7 uptime)
- **$5 free credit/month**
- **Automatic SSL/HTTPS**
- **MySQL database included**
- **No credit card required** for free tier

### Step 1: Push Code to GitHub

First, create a GitHub repository for your backend:

1. Go to [https://github.com/new](https://github.com/new)
2. Repository name: `timestamp-tracker-backend`
3. Visibility: **Private** (recommended)
4. Do NOT initialize with README

Then push your code:

```bash
cd ~/timestamp-tracker

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Timestamp Tracker"

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/timestamp-tracker-backend.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Project

1. **Sign up for Railway**
   - Go to [https://railway.app](https://railway.app)
   - Click "Login with GitHub"
   - Authorize Railway to access your GitHub

2. **Create new project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `timestamp-tracker-backend`
   - Click "Deploy Now"

3. **Wait for deployment**
   - Railway will automatically detect Node.js
   - It will run `pnpm install` and `pnpm build`
   - First deployment takes 2-3 minutes

### Step 3: Add MySQL Database

1. **In your Railway project dashboard:**
   - Click "+ New" button
   - Select "Database"
   - Choose "Add MySQL"
   - Railway creates a MySQL database

2. **Database connection is automatic:**
   - Railway automatically sets `DATABASE_URL` environment variable
   - Your app connects to the database automatically
   - No manual configuration needed

### Step 4: Run Database Migrations

After the database is created, you need to create the tables:

1. **In Railway project → Your service:**
   - Go to "Settings" tab
   - Scroll to "Build"
   - Change "Build Command" to:
     ```
     pnpm install && pnpm db:push && pnpm build
     ```

2. **Redeploy:**
   - Click "Deploy" → "Redeploy"
   - This will create all database tables

### Step 5: Configure Environment Variables

In Railway project → Your service → "Variables" tab, verify these are set:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Set automatically |
| `PORT` | `3000` | Set automatically |
| `DATABASE_URL` | (auto-set) | From MySQL database |
| `JWT_SECRET` | (your secret) | Add manually |

**To add JWT_SECRET:**

1. Click "+ New Variable"
2. Name: `JWT_SECRET`
3. Value: (paste the random string you generated earlier)
4. Click "Add"

### Step 6: Generate Public URL

1. **In Railway project → Your service:**
   - Go to "Settings" tab
   - Scroll to "Networking" section
   - Click "Generate Domain"

2. **Copy your permanent URL:**
   - Railway gives you a URL like: `https://timestamp-tracker-backend.up.railway.app`
   - **Save this URL** - you'll need it for the mobile app

### Step 7: Test Your Backend

Test that your backend is working:

```bash
# Replace with your actual Railway URL
curl https://your-app.up.railway.app/api/health

# Expected response:
# {"ok":true,"timestamp":1234567890}
```

If you get this response, your backend is deployed successfully!

---

## Mobile App Configuration

Now configure the mobile app to use your permanent Railway backend.

### Step 1: Update Environment Variables

Update your `.env` file with the Railway URL:

```env
# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Railway Backend URL (ADD THIS)
EXPO_PUBLIC_API_BASE_URL=https://your-app.up.railway.app

# JWT Secret (same as Railway)
JWT_SECRET=your_random_32_character_string_here
```

### Step 2: Test Locally

Start the development server:

```bash
# Start Metro bundler
pnpm dev:metro

# In another terminal, start local backend (optional, for testing)
pnpm dev:server
```

Open Expo Go on your phone and scan the QR code.

### Step 3: Test Live Tracking

1. **Start a shift** in the app
2. **Share the live tracker link**
3. **Open the link in a browser**
4. **Verify** you see the live tracking page with your Railway URL

The link should look like:
```
https://your-app.up.railway.app/live/ABC123
```

---

## Testing

### Local Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test tests/shifts.test.ts

# Run tests in watch mode
pnpm test --watch
```

### Manual Testing Checklist

Test these features before publishing:

**Shift Management:**
- [ ] Start a shift with site name and staff name
- [ ] GPS location is tracked every 30 seconds
- [ ] End shift and verify duration is calculated

**Photo Capture:**
- [ ] Take a photo during shift
- [ ] Verify timestamp watermark appears
- [ ] Verify GPS coordinates are saved

**Live Tracking:**
- [ ] Share live tracker link
- [ ] Open link in browser
- [ ] Verify real-time location updates
- [ ] Verify photos appear on live map

**PDF Reports:**
- [ ] Generate PDF report after shift
- [ ] Verify map shows route
- [ ] Verify photos appear in PDF
- [ ] Verify timeline is accurate

**Offline Mode:**
- [ ] Turn off WiFi/data
- [ ] Start a shift
- [ ] Take photos
- [ ] Turn on WiFi/data
- [ ] Verify data syncs to server

---

## Publishing to Google Play Store

### Step 1: Build APK

```bash
# Build production APK
eas build --platform android --profile production

# Or build locally
npx expo build:android
```

### Step 2: Test the APK

1. Download the APK to your Android device
2. Install and test all features
3. Verify live tracking uses Railway URL (not manus.computer)

### Step 3: Create Google Play Console Account

1. Go to [Google Play Console](https://play.google.com/console)
2. Pay one-time $25 registration fee
3. Create a new app

### Step 4: Upload APK

1. In Google Play Console → Your app
2. Go to "Production" → "Create new release"
3. Upload your APK
4. Fill in app details:
   - Title: "Timestamp Tracker"
   - Description: (write a description)
   - Screenshots: (take screenshots from app)
   - Privacy policy: (required)

5. Submit for review

### Step 5: Wait for Approval

Google typically reviews apps within 1-3 days.

---

## Common Mistakes to Avoid

### Mistake 1: Using Temporary manus.computer URL

**Problem:** App uses `https://8081-xxx.manus.computer` which expires.

**Solution:** Always set `EXPO_PUBLIC_API_BASE_URL` to your Railway URL before building.

**Verify:**
```bash
# Check environment variable is set
echo $EXPO_PUBLIC_API_BASE_URL

# Should output your Railway URL, not manus.computer
```

### Mistake 2: Forgetting Database Migrations

**Problem:** Backend starts but API returns "table not found" errors.

**Solution:** Run `pnpm db:push` on Railway:

1. Railway → Settings → Build Command
2. Change to: `pnpm install && pnpm db:push && pnpm build`
3. Redeploy

### Mistake 3: Missing Google Maps API Key

**Problem:** Maps don't load, shows gray screen.

**Solution:** 
1. Get API key from Google Cloud Console
2. Enable required APIs: Maps JavaScript API, Geocoding API, Static Maps API
3. Add to `.env` file
4. Rebuild app

### Mistake 4: JWT_SECRET Not Set

**Problem:** Backend crashes with "JWT_SECRET is required".

**Solution:** Add `JWT_SECRET` to Railway environment variables.

### Mistake 5: CORS Errors

**Problem:** Mobile app can't connect to backend, shows CORS error.

**Solution:** The backend is already configured to allow all origins. If you still get CORS errors, check:

1. Railway URL is correct in `EXPO_PUBLIC_API_BASE_URL`
2. Railway service is running (check logs)
3. No typos in the URL

### Mistake 6: Live Tracker Returns 404

**Problem:** Opening `/live/ABC123` shows "Not Found".

**Solution:**
1. Verify shift was synced to server (check Railway logs)
2. Verify pair code is correct (case-sensitive)
3. Verify database has the shift record

### Mistake 7: Photos Not Showing in PDF

**Problem:** PDF shows "Photo" text but no actual images.

**Solution:** This is already fixed in the latest version. If you still see this:

1. Verify photos are being uploaded (check Railway logs)
2. Verify photo URLs are accessible
3. Check PDF generator code in `lib/pdf-generator.ts`

### Mistake 8: App Crashes on Expo Go

**Problem:** App crashes with "react-native-image-marker" error.

**Solution:** This is already fixed. The watermark feature now works without native modules.

---

## Architecture Details

### Database Schema

The app uses MySQL with these tables:

**shifts** - Main shift records
- `id`, `userId`, `siteName`, `status`, `startTimeUtc`, `endTimeUtc`
- `pairCode` - For live tracking (e.g., "ABC123")
- `liveToken` - Unique shift identifier

**locationPoints** - GPS coordinates
- `id`, `shiftId`, `latitude`, `longitude`, `accuracy`
- `capturedAt` - When GPS was recorded

**photoEvents** - Photos taken during shifts
- `id`, `shiftId`, `fileUrl`, `latitude`, `longitude`
- `capturedAt` - When photo was taken

### API Endpoints

**Sync Endpoints** (used by mobile app):
- `POST /api/sync/shift` - Start/update shift
- `POST /api/sync/location` - Add GPS point
- `POST /api/sync/photo` - Add photo
- `POST /api/sync/shift-end` - End shift
- `GET /api/sync/shift/:pairCode` - Get shift data

**Web Endpoints** (for live tracking):
- `GET /live/:pairCode` - Live tracking page
- `GET /api/health` - Health check

### File Structure

```
timestamp-tracker/
├── app/                    # React Native screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Shifts tab (main screen)
│   │   ├── history.tsx    # History tab
│   │   └── watch.tsx      # Watch tab (live tracking)
│   └── live/              # Live tracking web page
│       └── [token].tsx    # Dynamic route for pair codes
├── server/                # Backend server
│   ├── _core/            # Server core (don't modify)
│   │   └── index.ts      # Express server with sync endpoints
│   ├── db.ts             # Database query helpers
│   ├── sync-db.ts        # Sync-specific database functions
│   └── routers.ts        # tRPC API routes
├── drizzle/              # Database schema
│   ├── schema.ts         # Table definitions
│   └── migrations/       # Auto-generated migrations
├── lib/                  # Shared utilities
│   ├── shift-storage.ts  # Local shift storage
│   ├── server-sync.ts    # Backend sync logic
│   ├── pdf-generator.ts  # PDF report generation
│   └── watermark.ts      # Photo watermarking
├── components/           # React components
├── constants/            # App constants
└── tests/               # Test files
```

---

## Monitoring and Maintenance

### Check Railway Logs

```bash
# View logs in Railway dashboard
Railway → Your service → Deployments → Latest → View logs
```

### Monitor Database Usage

```bash
# In Railway → MySQL database → Metrics
# Check:
# - Storage used
# - Connection count
# - Query performance
```

### Update Dependencies

```bash
# Check for outdated packages
pnpm outdated

# Update all dependencies
pnpm update

# Test after updating
pnpm test
```

### Backup Database

Railway automatically backs up your database. To create manual backup:

1. Railway → MySQL database → Settings
2. Click "Create Backup"
3. Download backup file

---

## Support and Resources

### Documentation

- **Expo Docs**: [https://docs.expo.dev](https://docs.expo.dev)
- **Railway Docs**: [https://docs.railway.app](https://docs.railway.app)
- **React Native Docs**: [https://reactnative.dev](https://reactnative.dev)

### Community

- **Expo Discord**: [https://chat.expo.dev](https://chat.expo.dev)
- **Railway Discord**: [https://discord.gg/railway](https://discord.gg/railway)

### Troubleshooting

If you encounter issues:

1. **Check Railway logs** - Most backend issues show up here
2. **Check mobile app console** - Use React Native Debugger
3. **Verify environment variables** - Print them in code to debug
4. **Test API endpoints** - Use curl or Postman
5. **Check database** - Use Railway's database viewer

---

## License

This project is provided as-is for your use. Modify and deploy as needed for your business.

---

## Credits

Built with:
- **React Native** - Mobile framework
- **Expo** - Development platform
- **Express** - Backend server
- **MySQL** - Database
- **Railway** - Hosting platform
- **Google Maps** - Maps and geocoding

---

**Last Updated:** January 2026

**Version:** 1.0.0
