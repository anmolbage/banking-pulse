# ₹ Banking Pulse

AI-powered banking & finance news digest for Indian bankers. Fresh news every day, explained in simple language with actionable insights.

## Features

- **AI-curated news** — Claude searches the web and picks the most relevant stories
- **Simple language** — every story explained without jargon
- **"Why It Matters"** — personalized insights for branch-level banking operations
- **Key numbers** — important stats at a glance
- **9 categories** — RBI, Banking, MSME, Digital, Gramin Banks, Markets, Budget & Tax, NABARD
- **This Week / Earlier** — latest news always on top
- **Source links** — click through to original articles
- **Auto-refreshes** every 6 hours
- **Offline access** — cached news available without internet
- **PWA** — add to home screen, works like a native app
- **Beautiful editorial design** — warm, clean, distraction-free reading

## Setup

### 1. Get an Anthropic API Key

Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) and create a key.

### 2. Deploy to GitHub Pages

```bash
# Create a new repo on GitHub called "banking-pulse"
# Upload these 3 files: index.html, manifest.json, README.md
# Go to Settings → Pages → Source: main branch → Save
```

Your app: `https://YOUR_USERNAME.github.io/banking-pulse/`

### 3. Open on Phone

1. Visit the URL on your phone
2. Enter your API key (one-time, stored only on your device)
3. News fetches automatically
4. **Add to Home Screen** for app-like experience

## Cost

Each refresh ≈ $0.03-0.05 (Claude Sonnet + web search). With 2-4 refreshes/day, expect roughly **$2-5/month**.

## Privacy

- API key stored **only in your browser** (localStorage)
- Calls go directly from your browser to `api.anthropic.com`
- **No backend, no server, no tracking, no analytics**
- Clear everything anytime: Settings → Clear All Data

## Files

```
banking-pulse/
├── index.html      ← Entire app
├── manifest.json   ← PWA manifest
└── README.md
```

---

Built for busy branch managers who want to stay informed without the noise.
