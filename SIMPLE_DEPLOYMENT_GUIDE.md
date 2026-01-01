# Simple Deployment Guide - Get Your Permanent Backend URL

**Follow these steps exactly. Takes about 30 minutes.**

---

## What You Need

Before starting, make sure you have:

- ✅ GitHub account (free) - Sign up at github.com
- ✅ Railway account (free) - Sign up at railway.app
- ✅ Code downloaded from Manus
- ✅ Google Maps API key

---

## Part 1: Download Code from Manus (5 minutes)

### Step 1: Download Your Code

1. Open Manus in your browser
2. Find your project "Timestamp Tracker"
3. Click on the **Code** icon (right side panel)
4. Click **"Download All Files"** button
5. Save the ZIP file to your computer
6. **Extract the ZIP file** to a folder (right-click → Extract)

**You should now have a folder called `timestamp-tracker` with all your code.**

---

## Part 2: Upload Code to GitHub (10 minutes)

### Step 2: Create GitHub Repository

1. Go to **github.com** and log in
2. Click the **"+"** button (top right)
3. Click **"New repository"**

4. Fill in these details:
   - **Repository name:** `timestamp-tracker`
   - **Description:** "Security guard shift tracking app"
   - **Public** (must be public for free Railway)
   - **DO NOT** check "Add README"
   - **DO NOT** add .gitignore or license

5. Click **"Create repository"**

**GitHub will show you a page with instructions. Keep this page open.**

### Step 3: Upload Code Using GitHub Website (Easiest Method)

**Option A: Upload via Web (No terminal needed)**

1. On the GitHub repository page, click **"uploading an existing file"** link
2. Drag and drop ALL files from your `timestamp-tracker` folder
3. Wait for upload to complete (may take 2-3 minutes)
4. Scroll down and click **"Commit changes"**

**Done! Your code is now on GitHub.**

**Option B: Upload via Terminal (If you prefer command line)**

1. Open Terminal (Mac) or Command Prompt (Windows)
2. Navigate to your folder:
   ```bash
   cd path/to/timestamp-tracker
   ```

3. Run these commands one by one:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/timestamp-tracker.git
   git push -u origin main
   ```

**Replace `YOUR_USERNAME` with your actual GitHub username.**

---

## Part 3: Deploy Backend to Railway (10 minutes)

### Step 4: Create Railway Project

1. Go to **railway.app** and log in
2. Click **"New Project"**
3. Click **"Deploy from GitHub repo"**
4. If asked, click **"Configure GitHub App"** and give Railway access to your repositories
5. Select **"timestamp-tracker"** repository
6. Click **"Deploy Now"**

**Railway will start building your backend. This takes 3-5 minutes.**

### Step 5: Add MySQL Database

While the build is running:

1. In Railway project, click **"+ New"** button
2. Click **"Database"**
3. Click **"Add MySQL"**
4. Wait for MySQL to start (30 seconds)

**Railway automatically connects the database to your backend.**

### Step 6: Add Environment Variables

1. Click on your **backend service** (the one that's building)
2. Click **"Variables"** tab
3. Click **"+ New Variable"**
4. Add these variables one by one:

**Variable 1:**
- Name: `GOOGLE_MAPS_API_KEY`
- Value: (paste your Google Maps API key)

**Variable 2:**
- Name: `JWT_SECRET`
- Value: (paste this random string)
  ```
  a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
  ```

**Variable 3:**
- Name: `NODE_ENV`
- Value: `production`

5. Click **"Save"** or just close the variables panel

**Railway will automatically redeploy with these variables.**

### Step 7: Generate Public URL

1. Click on your **backend service**
2. Click **"Settings"** tab
3. Scroll down to **"Networking"** section
4. Click **"Generate Domain"** button

**Railway will give you a permanent URL like:**
```
https://timestamp-tracker-production-xxxx.up.railway.app
```

**Copy this URL! You need it for the next step.**

### Step 8: Run Database Migrations

1. In Railway, click on your **backend service**
2. Click **"Settings"** tab
3. Scroll to **"Build"** section
4. Change **Build Command** to:
   ```
   pnpm install && pnpm db:push && pnpm build
   ```
5. Click **"Redeploy"** button (top right)

**Wait for redeploy to complete (2-3 minutes).**

### Step 9: Test Your Backend

1. Copy your Railway URL from Step 7
2. Open a new browser tab
3. Go to: `https://your-railway-url.up.railway.app/api/health`
4. You should see: `{"ok":true,"timestamp":1234567890}`

**If you see this, your backend is working! 🎉**

---

## Part 4: Configure Mobile App (5 minutes)

### Step 10: Update App to Use Railway Backend

1. Go back to **Manus**
2. Open **Management UI** → **Settings** → **Secrets**
3. Find or add: `EXPO_PUBLIC_API_BASE_URL`
4. Set value to your Railway URL (from Step 7)
5. Click **"Save"**

### Step 11: Rebuild Mobile App

1. Manus UI → **Publish** panel
2. Click **"Build APK"**
3. Wait for build to complete (10-15 minutes)
4. Download the APK

### Step 12: Test Everything

1. Install the APK on your phone
2. Start a shift
3. The app should now connect to your permanent Railway backend
4. Share the live tracker link
5. Open the link in a browser
6. You should see live tracking!

**The live tracker URL will now be:**
```
https://your-railway-url.up.railway.app/live/ABC123
```

**This URL is permanent and will never expire!**

---

## Troubleshooting

### Problem: Railway Build Fails

**Solution:**
1. Check Railway logs: Click service → Deployments → View logs
2. Look for error messages
3. Most common: Missing `package.json` or `pnpm-lock.yaml`
4. Make sure you uploaded ALL files from Manus

### Problem: Database Connection Error

**Solution:**
1. Make sure MySQL database is running (green status)
2. Check that `DATABASE_URL` variable exists (Railway adds this automatically)
3. Redeploy the service

### Problem: "Shift not found" in Live Tracker

**Solution:**
1. Make sure you started a shift in the mobile app
2. Wait 5-10 seconds for sync to complete
3. Check Railway logs for sync errors
4. Verify the pair code is correct

### Problem: Mobile App Can't Connect

**Solution:**
1. Verify `EXPO_PUBLIC_API_BASE_URL` is set correctly in Manus
2. Make sure the URL starts with `https://` (not `http://`)
3. Test the backend health endpoint in browser
4. Rebuild the mobile app after changing the URL

---

## Summary

**What You Did:**

1. ✅ Downloaded code from Manus
2. ✅ Uploaded code to GitHub (public repository)
3. ✅ Deployed backend to Railway
4. ✅ Added MySQL database
5. ✅ Set environment variables
6. ✅ Generated permanent URL
7. ✅ Configured mobile app to use Railway backend
8. ✅ Built and tested the app

**What You Got:**

- ✅ Permanent backend URL (never expires)
- ✅ Live database (MySQL on Railway)
- ✅ Live tracker that works forever
- ✅ Mobile app connected to permanent backend

**Your Permanent URLs:**

- Backend API: `https://your-app.up.railway.app`
- Live Tracker: `https://your-app.up.railway.app/live/[PAIRCODE]`
- Health Check: `https://your-app.up.railway.app/api/health`

---

## Free Tier Limits

Railway free tier includes:

- **$5 credit per month** (renews monthly)
- **500 hours execution time**
- **100 GB bandwidth**
- **1 GB storage**

This is enough for:
- **~50-100 shifts per month**
- **~500 live tracker views per month**
- **~1000 photos uploaded per month**

If you exceed limits, upgrade to Hobby plan ($5/month) for unlimited usage.

---

## Next Steps

Now that your backend is deployed:

1. **Test thoroughly** - Start multiple shifts, test live tracking
2. **Share with your team** - Give them the APK to install
3. **Monitor usage** - Check Railway dashboard for usage stats
4. **Upgrade if needed** - If you exceed free tier, upgrade to Hobby plan

---

## Need Help?

**Railway Issues:**
- Railway Discord: discord.gg/railway
- Railway Docs: docs.railway.app

**GitHub Issues:**
- GitHub Docs: docs.github.com

**App Issues:**
- Check TROUBLESHOOTING.md in your code
- Check Railway logs for errors

---

**Congratulations! Your app is now deployed with a permanent backend! 🎉**

---

**Last Updated:** January 2026  
**Prepared By:** Manus AI
