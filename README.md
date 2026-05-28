# GeT Energy PyroCheck — Backend Server

## Overview
Node.js + Express API with SQLite database. Designed for Railway.app hosting.
All devices (tablets, phones) connect to this single server so data is shared in real time.

---

## Deploy to Railway (15 minutes, free)

### Step 1 — Create a Railway account
Go to https://railway.app and sign up (free, no credit card needed for starter tier).

### Step 2 — Upload the server code

**Option A — GitHub (recommended)**
1. Create a free GitHub account at https://github.com if you don't have one
2. Create a new repository called `pyrocheck-server`
3. Upload all the files from this `pyrocheck-server` folder to the repo
4. In Railway: click **New Project → Deploy from GitHub repo → select pyrocheck-server**

**Option B — Railway CLI (if you have Node installed locally)**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Step 3 — Add a persistent volume (IMPORTANT — keeps your data safe)
1. In your Railway project, click on the service
2. Go to **Settings → Volumes**
3. Click **Add Volume**
4. Mount path: `/data`
5. This ensures your database survives server restarts

### Step 4 — Set environment variables
In Railway → your service → **Variables**, add:

| Variable | Value |
|----------|-------|
| `API_KEY` | Any long random string, e.g. `pyrocheck-getenergy-2024-abc123` |
| `DATA_DIR` | `/data` |
| `PORT` | Leave blank (Railway sets this automatically) |

**Keep your API_KEY secret** — write it down, you'll need it in the app.

### Step 5 — Get your URL
After deployment, Railway gives you a URL like:
`https://pyrocheck-server-production-xxxx.up.railway.app`

Copy this URL.

---

## Configure the App (on each device)

1. Open the PyroCheck app (your Netlify URL)
2. Tap the **coloured dot** in the top-right corner of the nav bar
3. Enter your Railway URL and API Key
4. Tap **Save & Test Connection** — you should see "✓ Connected!"
5. The dot turns **green** = connected, **amber** = syncing, **red** = offline

Do this on every tablet and phone. Once configured, all data flows to the central server automatically.

---

## How sync works

- **Online**: Every check submitted goes to the server immediately
- **Offline**: If the device has no internet, the record is saved locally and automatically retried every 2 minutes, or when you tap the sync dot
- **Pull**: Use the sync panel to pull records from other devices (e.g. pull night shift data onto the day shift tablet for reporting)
- **Users**: Tap "Push operator list to server" once to share operators across all devices

---

## API Endpoints

```
GET    /health                    — Server health check (no auth)
GET    /api/records               — Fetch records (filter by date, shift, type)
POST   /api/records               — Submit a new record
POST   /api/records/batch         — Submit multiple records at once (offline sync)
PUT    /api/records/:id           — Update a record
DELETE /api/records/:id           — Delete a record
GET    /api/records/export        — Download all records as CSV
GET    /api/users                 — Get operator list
POST   /api/users                 — Add/update an operator
POST   /api/users/sync            — Replace entire operator list
DELETE /api/users/:id             — Remove an operator
GET    /api/settings              — Get plant settings
POST   /api/settings              — Update plant settings
```

All requests (except /health) require the `X-API-Key` header.

---

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env and set API_KEY=any-test-key
npm run dev
# Server starts on http://localhost:3000
```

---

## Backup your database

The database file is at `/data/pyrocheck.db` on Railway.
- Use the CSV export in the app (Settings → Export Records) for a data backup
- Railway volumes are persistent but you can also download via Railway's volume browser

---

## Monthly cost
Railway free tier includes 500 hours/month and 1GB volume storage.
For a plant running 24/7, upgrade to the Hobby plan at ~$5/month.
The SQLite database for a year of daily checks will be well under 100MB.
