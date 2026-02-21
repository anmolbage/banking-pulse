# Banking Pulse — Deployment Guide

## Project Structure

```
bankingpulse-netlify/
├── public/                    # Static files (served by Netlify)
│   ├── index.html             # Landing page (bankingpulse.app)
│   └── app/
│       ├── index.html         # The PWA (bankingpulse.app/app)
│       └── manifest.json      # PWA manifest
├── netlify/
│   └── functions/
│       ├── fetch-news.mjs     # CRON: Fetches news 4x/day via Claude API
│       ├── get-news.mjs       # API: Serves cached news (free/pro gating)
│       ├── auth.mjs           # API: Google Sign-In verification
│       └── razorpay-webhook.mjs # Webhook: Payment events from Razorpay
├── netlify.toml               # Netlify config (functions, redirects, headers)
├── package.json
├── supabase-schema.sql        # Run this in Supabase SQL Editor
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## Setup Steps (Do in This Order)

### Step 1: Supabase (10 minutes)

1. Go to https://supabase.com → New Project (free tier)
2. Pick a region (Mumbai if available, Singapore otherwise)
3. Save the project URL and service_role key from Settings → API
4. Go to SQL Editor → New Query → paste contents of `supabase-schema.sql` → Run
5. Verify: Tables `users` and `news_cache` appear in Table Editor

### Step 2: Google OAuth (10 minutes)

1. Go to https://console.cloud.google.com
2. Create a new project: "Banking Pulse"
3. APIs & Services → Credentials → Create Credentials → OAuth Client ID
4. Application type: Web application
5. Authorized JavaScript origins: `https://bankingpulse.app`
6. Authorized redirect URIs: `https://bankingpulse.app/app`
7. Copy the Client ID (ends with .apps.googleusercontent.com)

### Step 3: Razorpay (start now, takes 1-3 days)

1. Go to https://razorpay.com → Sign Up
2. Complete KYC (PAN, bank account, business details)
3. While waiting for activation, use Test Mode:
   - Dashboard → Settings → API Keys → Generate Test Key
4. Create subscription plan:
   - Dashboard → Products → Subscriptions → Plans → Create
   - Plan 1: "Pro Monthly" — ₹149/month
   - Plan 2: "Pro Annual" — ₹1,199/year
5. Set up webhook:
   - Dashboard → Settings → Webhooks → Add New
   - URL: `https://bankingpulse.app/.netlify/functions/razorpay-webhook`
   - Events: subscription.charged, payment.captured, subscription.cancelled
   - Copy webhook secret

### Step 4: Deploy to Netlify (10 minutes)

1. Push this folder to a GitHub repo:
   ```bash
   cd bankingpulse-netlify
   git init
   git add -A
   git commit -m "Initial deploy"
   gh repo create bankingpulse --private --push
   ```

2. Go to https://app.netlify.com → Add New Site → Import from Git → Select repo

3. Build settings:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`

4. Add environment variables (Site Settings → Environment Variables):
   ```
   ANTHROPIC_API_KEY     = sk-ant-api03-xxxxx
   SUPABASE_URL          = https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY  = eyJxxxxx
   RAZORPAY_KEY_ID       = rzp_test_xxxxx (switch to rzp_live_ after activation)
   RAZORPAY_KEY_SECRET   = xxxxx
   GOOGLE_CLIENT_ID      = xxxxx.apps.googleusercontent.com
   ```

5. Deploy!

### Step 5: Connect Domain (5 minutes)

1. In Netlify: Domain Settings → Add Custom Domain → `bankingpulse.app`
2. Netlify gives you a target: `something.netlify.app`
3. In Hostinger DNS:
   - Delete any existing A records for `@`
   - Add CNAME record: `@` → `your-site.netlify.app`
   - Add CNAME record: `www` → `your-site.netlify.app`
   
   (If Hostinger doesn't allow CNAME on root, use Netlify's IP addresses instead:
   A record: `@` → `75.2.60.5`
   CNAME: `www` → `your-site.netlify.app`)
4. Back in Netlify: Verify → Enable HTTPS

### Step 6: Test the Scheduled Function

The cron runs automatically 4x/day. To test immediately:
1. Go to Netlify Dashboard → Functions → `fetch-news`
2. Or trigger manually via Netlify CLI:
   ```bash
   netlify functions:invoke fetch-news
   ```
3. Check Supabase → Table Editor → news_cache → should have a row with `id: latest`

### Step 7: Verify Everything

- [ ] `bankingpulse.app` → Landing page loads
- [ ] `bankingpulse.app/app` → PWA loads
- [ ] `bankingpulse.app/api/news` → Returns JSON (free tier data)
- [ ] Google Sign-In works
- [ ] Razorpay test payment works
- [ ] News cache updates every 6 hours

---

## How It All Connects

```
User opens app
    ↓
Google Sign-In → /api/auth → Supabase (users table)
    ↓
App calls /api/news with auth token
    ↓
get-news function checks:
  - Is token valid?
  - Is user Pro? (plan + expiry)
    ↓
Returns full data (Pro) or truncated data (Free)
    ↓
Separately, 4x/day:
  fetch-news cron → Claude API → Supabase (news_cache)
    ↓
Razorpay payment → webhook → Supabase (update user plan)
```

## Cost Breakdown

| Item | Cost |
|------|------|
| Netlify | Free (100GB bandwidth, 125K function calls/month) |
| Supabase | Free (500MB database, 50K auth users) |
| Claude API | ~₹600/month (4 calls/day × 30 days × ₹5/call) |
| Domain | ~₹1,400/year (bankingpulse.app) |
| Razorpay | 2% of revenue (no fixed cost) |
| **Total fixed** | **~₹700/month** |

Break-even: 5 Pro users at ₹149/month = ₹745/month ✓

## Next Steps After Launch

1. Use the app yourself for a week, tune the AI prompt
2. Share with 5-10 banker friends
3. Post in banking WhatsApp groups
4. Goal: 50 free + 5 Pro in first month
