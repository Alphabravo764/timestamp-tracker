# Railway Deployment Guide

Deploy your Timestamp Tracker backend to Railway for free permanent hosting.

## Prerequisites

- GitHub account
- Railway account (sign up at https://railway.app with GitHub)
- Free Railway tier: 500 hours/month, $5 credit

## Step 1: Push Code to GitHub

1. **Create a new GitHub repository**
   - Go to https://github.com/new
   - Name it: `timestamp-tracker-backend`
   - Make it **Private** (recommended)
   - Don't initialize with README

2. **Push your code to GitHub**
   ```bash
   cd /path/to/timestamp-tracker
   git init
   git add .
   git commit -m "Initial commit - Timestamp Tracker Backend"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/timestamp-tracker-backend.git
   git push -u origin main
   ```

## Step 2: Deploy to Railway

1. **Go to Railway**
   - Visit https://railway.app
   - Click "Login" and sign in with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `timestamp-tracker-backend` repository
   - Click "Deploy Now"

3. **Railway will automatically:**
   - Detect the Node.js project
   - Install dependencies with pnpm
   - Build the server
   - Deploy and start it

## Step 3: Add Database

1. **In your Railway project dashboard:**
   - Click "+ New"
   - Select "Database" → "Add MySQL"
   - Railway will create a MySQL database

2. **Connect database to your service:**
   - Click on your backend service
   - Go to "Variables" tab
   - Railway automatically adds `DATABASE_URL`
   - Your app will use this automatically

## Step 4: Configure Environment Variables

In Railway project → Your service → Variables tab, add:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=(automatically set by Railway)
JWT_SECRET=(generate a random 32-character string)
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 5: Get Your Permanent URL

1. **In Railway project → Your service:**
   - Go to "Settings" tab
   - Scroll to "Networking"
   - Click "Generate Domain"
   - Railway will give you a URL like: `your-app.up.railway.app`

2. **Copy this URL** - this is your permanent backend URL!

Example: `https://timestamp-tracker-backend.up.railway.app`

## Step 6: Update Mobile App Configuration

You need to configure the mobile app to use your Railway backend URL.

### Option A: Using Manus Secrets (Recommended)

If you're using Manus to build the app, I'll request the secret from you through the Manus UI.

### Option B: Manual Configuration

1. Create a `.env` file in the project root:
   ```
   EXPO_PUBLIC_API_BASE_URL=https://your-app.up.railway.app
   ```

2. Rebuild the mobile app with this environment variable set.

## Step 7: Test Your Deployment

1. **Test the health endpoint:**
   ```bash
   curl https://your-app.up.railway.app/api/health
   ```
   
   Should return: `{"ok":true,"timestamp":1234567890}`

2. **Test from mobile app:**
   - Start a shift
   - Check if data syncs (watch Railway logs)
   - Share the live tracker link
   - Open it in a browser

## Railway Free Tier Limits

- **500 execution hours/month** (enough for 24/7 uptime)
- **$5 credit/month** (usually enough for small apps)
- **100 GB outbound bandwidth**
- **Automatic sleep after 30 min inactivity** (wakes up on request)

## Monitoring Your App

1. **View logs:**
   - Railway project → Your service → "Deployments" tab
   - Click on latest deployment
   - See real-time logs

2. **Check metrics:**
   - Railway project → Your service → "Metrics" tab
   - See CPU, memory, network usage

## Troubleshooting

### App won't start
- Check logs in Railway dashboard
- Verify `DATABASE_URL` is set
- Ensure `pnpm build` succeeded

### Database connection fails
- Verify MySQL database is running
- Check `DATABASE_URL` format
- Run migrations: Add `pnpm db:push` to build command

### App sleeps after 30 minutes
- This is normal on free tier
- First request after sleep takes ~30 seconds
- Upgrade to Hobby plan ($5/month) for always-on

### Out of credits
- Railway gives $5/month free
- Monitor usage in dashboard
- Optimize by reducing database queries
- Upgrade to Hobby plan if needed

## Alternative Free Hosting Options

If Railway doesn't work for you:

### Render (https://render.com)
- 750 hours/month free
- Automatic sleep after 15 min inactivity
- Similar setup process

### Vercel (https://vercel.com)
- Free serverless functions
- Good for API endpoints
- May need to adapt code for serverless

### Fly.io (https://fly.io)
- 3 VMs free
- Always-on (no sleep)
- More complex setup

## Cost Optimization Tips

1. **Enable database connection pooling**
2. **Add caching for frequently accessed data**
3. **Compress API responses**
4. **Use CDN for static assets**
5. **Monitor and optimize slow queries**

## Security Checklist

- ✅ Use HTTPS (Railway provides this automatically)
- ✅ Set strong `JWT_SECRET`
- ✅ Keep repository private
- ✅ Don't commit `.env` files
- ✅ Enable CORS only for your app domain
- ✅ Add rate limiting for API endpoints
- ✅ Regularly update dependencies

## Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- GitHub Issues: Create an issue in your repository

---

## Quick Reference

**Your Backend URL:** `https://your-app.up.railway.app`

**API Endpoints:**
- Health: `GET /api/health`
- Sync shift: `POST /api/sync/shift`
- Sync location: `POST /api/sync/location`
- Sync photo: `POST /api/sync/photo`
- Get shift: `GET /api/sync/shift/:pairCode`
- Live tracker: `GET /live/:pairCode`

**Database:**
- Managed MySQL by Railway
- Automatic backups
- Connection pooling enabled

**Monitoring:**
- Railway dashboard for logs and metrics
- Set up alerts for downtime
- Monitor credit usage
