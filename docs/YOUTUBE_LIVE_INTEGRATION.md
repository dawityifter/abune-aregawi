# YouTube Live Stream Integration - Implementation Summary

## ✅ What Was Implemented

### Backend Components

1. **YouTube Service** (`../backend/src/services/youtubeService.js`)
   - Calls YouTube Data API v3 to check if channel is live
   - Returns live status, video ID, title, and thumbnail
   - Handles API errors gracefully

2. **YouTube Controller** (`../backend/src/controllers/youtubeController.js`)
   - Endpoint handler for `/api/youtube/live-status`
   - Uses channel ID from environment variable or defaults to your channel

3. **YouTube Routes** (`../backend/src/routes/youtubeRoutes.js`)
   - Defines GET `/api/youtube/live-status` endpoint
   - Public access (no authentication required)

4. **Server Integration** (`../backend/src/server.js`)
   - Registered YouTube routes
   - Added route import

### Frontend Components

1. **LiveStreamBanner** (`../frontend/src/components/LiveStreamBanner.tsx`)
   - Automatically checks backend API every 5 minutes
   - Shows animated "LIVE NOW" banner when streaming
   - "Watch Live" button toggles embedded YouTube player
   - "Visit Channel" button opens YouTube channel in new tab
   - Hidden by default when not live

2. **HomePage Integration** (`../frontend/src/components/HomePage.tsx`)
   - Banner appears after Hero section
   - Removed old "Watch Live" button from Hero

3. **Hero Component** (`../frontend/src/components/Hero.tsx`)
   - Removed duplicate "Watch Live" button
   - Kept only "Give Online" button

---

## 🔧 Configuration Required

### Backend `.env` File

Make sure your `../backend/.env` has:

```env
YOUTUBE_API_KEY=your_api_key_here
YOUTUBE_CHANNEL_ID=UCvK6pJUKU2pvoX7bQ3PN2aA
```

### Frontend `.env` File (Optional)

If deploying to production, add:

```env
REACT_APP_API_URL=https://api.abunearegawi.church
```

For local development, it defaults to `http://localhost:5000`

---

## 🧪 How to Test

### 1. Start Backend
```bash
cd ../backend
npm start
```

### 2. Test API Endpoint Directly
```bash
curl http://localhost:5000/api/youtube/live-status
```

Expected response when **not live**:
```json
{
  "isLive": false
}
```

Expected response when **live**:
```json
{
  "isLive": true,
  "videoId": "abc123xyz",
  "title": "Sunday Service - Live",
  "thumbnail": "https://..."
}
```

### 3. Start Frontend
```bash
cd ../frontend
npm start
```

### 4. Check Homepage
- Visit `http://localhost:3000`
- Banner should be **hidden** (no live stream currently)
- When you go live on YouTube, banner will appear within 5 minutes

---

## 📊 How It Works

1. **Frontend** polls `/api/youtube/multi-live-status` every 2 minutes — but only while
   the tab is visible. Hiding the tab stops the polling; revealing it triggers an
   immediate check.
2. **Backend** serves a 60s cached status. Concurrent misses share one API round trip
   (single-flight), so quota burn scales with time, not with visitor count.
3. **On a cache miss** the service resolves the uploads playlist, lists recent uploads,
   and asks `videos.list` which of them has `liveBroadcastContent === 'live'` with no
   `actualEndTime`.
4. **Banner** shows/hides automatically based on the response.

Responses carry `Cache-Control: public, max-age=30` so repeat polls from the same
browser need not reach the origin at all.

### Endpoints

| Route | Access | Notes |
|---|---|---|
| `GET /api/youtube/multi-live-status` | Public | What the homepage banner polls |
| `GET /api/youtube/live-status` | Public | First live channel, or the main channel |
| `GET /api/youtube/config` | Public | Channel IDs |
| `POST /api/youtube/refresh` | **Admin** | Bypasses the cache |

`force` is deliberately not readable from the query string on the public routes: a
public cache bypass lets any caller spend quota on demand and take the banner down for
everyone. Use the admin `POST /api/youtube/refresh` route instead.

### If a live stream is not detected

A broadcast is found through the channel's uploads playlist, which is how "go live"
streams appear. If a stream is live on YouTube but the banner stays hidden, check that
the broadcast is public (unlisted/private streams are not in the uploads feed) and hit
`POST /api/youtube/refresh` as an admin to skip the cache.

---

## 🎯 YouTube API Quota Usage

Quota is the binding constraint on this feature. Costs per call:

| Endpoint | Cost | Used for |
|---|---|---|
| `search.list` | **100 units** | ❌ not used — 100 checks would exhaust the day |
| `channels.list` | 1 unit | uploads playlist id, resolved once per channel per process |
| `playlistItems.list` | 1 unit | most recent uploads |
| `videos.list` | 1 unit | live status of those uploads |

Detection reads the channel's uploads playlist rather than searching, so a check costs
**2 units** in steady state instead of 100.

- **Cost per check**: 2 units per channel
- **Cache TTL**: 60s (override with `YOUTUBE_CACHE_TTL_MS`)
- **Worst case**: 2 channels × 2 units × 1,440 checks = **5,760 units/day**
- **Daily quota**: 10,000 units

An earlier version used `search.list` on a 2-minute cache during "core broadcasting
hours." That cost 6,000 units/hour and drained the daily quota in under two hours,
after which every check failed and the banner stayed hidden during the actual service.
The core-hours throttle existed only to ration that expense and has been removed —
the cheap path is affordable 24/7, so a stream is detected whenever it starts.

---

## 🚀 Next Steps

1. **Test locally** - Start both backend and frontend
2. **Verify API key** - Make sure it's in `../backend/.env`
3. **Test when live** - Start a live stream on YouTube and wait up to 5 minutes
4. **Deploy** - When ready, deploy both backend and frontend

---

## 🔒 Security Notes

✅ API key is stored in backend (secure)  
✅ API key is never exposed to frontend  
✅ API key is restricted to YouTube Data API v3  
✅ API key should be restricted to your domains in Google Cloud Console

---

## Files Modified

**Backend:**
- ✅ `../backend/src/services/youtubeService.js` (new)
- ✅ `../backend/src/controllers/youtubeController.js` (new)
- ✅ `../backend/src/routes/youtubeRoutes.js` (new)
- ✅ `../backend/src/server.js` (modified)

**Frontend:**
- ✅ `../frontend/src/components/LiveStreamBanner.tsx` (new)
- ✅ `../frontend/src/components/HomePage.tsx` (modified)
- ✅ `../frontend/src/components/Hero.tsx` (modified)

All changes are ready to test locally!
