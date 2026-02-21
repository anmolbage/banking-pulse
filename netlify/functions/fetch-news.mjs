// netlify/functions/fetch-news.mjs
// SCHEDULED: Runs 4x/day (6am, 12pm, 6pm, 11pm IST)
// Calls Claude API ONCE, stores result in Supabase for all users

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// This is a Netlify Scheduled Function
export const config = {
  schedule: "30 0,6,12,17 * * *",  // UTC: 0:30, 6:30, 12:30, 17:30 = IST: 6am, 12pm, 6pm, 11pm
  timeout: 120,  // Allow up to 2 minutes (Claude + web search takes ~60s)
};

export default async function handler(req) {
  console.log('[fetch-news] Starting scheduled fetch...');

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  const sysPrompt = `You are "Banking Pulse" — a friendly, sharp AI news curator for Indian bankers. Today is ${today}.

Readers: Branch managers at Regional Rural Banks. Busy, practical people.

VOICE: Like a smart colleague over chai. Lead with impact. Warm but crisp. Explain jargon in parentheses.

JOB 1 — NEWS (12-18 items):
Search for LATEST Indian banking/finance news (past 7 days). Mix of big, medium, small stories.
Categories (use these exact values): rbi, banking, msme, digital, rrb, markets, budget, nabard
Importance: "must-read" / "good-to-know" / "fyi"

JOB 2 — CIRCULARS (3-6 items):
Recent RBI, NABARD, DFS, SEBI circulars (past 14 days). Include action items, deadlines, circular links.

JOB 3 — TREND DATA:
For 2-3 stories with numerical changes, add "trend" array showing progression (last 3-5 data points).

JOB 4 — HINDI:
For title/summary/whyItMatters/morningBrief, also provide Hindi in fields suffixed "Hi". Natural, everyday Hindi.

RESPOND IN VALID JSON ONLY — NO markdown, NO backticks, NO preamble:
{"morningBrief":"...","morningBriefHi":"...","news":[{"id":"id","category":"rbi","badge":"LATEST","importance":"must-read","title":"...","titleHi":"...","summary":"...","summaryHi":"...","whyItMatters":"...","whyItMattersHi":"...","keyNumbers":[{"label":"...","value":"..."}],"trend":[{"label":"Jun 25","value":"6.5%"}],"sources":[{"name":"...","url":"..."}],"date":"..."}],"circulars":[{"id":"c1","issuer":"RBI","number":"RBI/2025-26/XX","date":"...","title":"...","titleHi":"...","summary":"...","summaryHi":"...","deadline":"...","actions":["..."],"actionsHi":["..."],"url":"..."}]}

CRITICAL: NEVER include <cite>, , [1], or any markup. Clean plain text only. Real URLs. 12-18 news + 3-6 circulars.`;

  try {
    // Call Claude API
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 12000,
        system: sysPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: 'Search for latest Indian banking news + recent circulars. Include Hindi translations and trend data. 12-18 news + 3-6 circulars. Clean JSON only.'
        }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API Error ${resp.status}`);
    }

    const data = await resp.json();
    let txt = '';
    for (const b of data.content) {
      if (b.type === 'text') txt += b.text;
    }

    // Parse JSON from response
    txt = txt.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const match = txt.match(/\{[\s\S]*"news"[\s\S]*\}/);
    if (!match) throw new Error('Could not parse response');

    const parsed = JSON.parse(match[0]);
    if (!parsed.news || !Array.isArray(parsed.news)) throw new Error('Invalid format');

    // Clean all text fields
    const clean = (t) => {
      if (!t) return '';
      return t
        .replace(/<\/?cite[^>]*>/gi, '')
        .replace(/<\/?antml:cite[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    parsed.news = parsed.news.map(n => ({
      ...n,
      title: clean(n.title),
      titleHi: clean(n.titleHi),
      summary: clean(n.summary),
      summaryHi: clean(n.summaryHi),
      whyItMatters: clean(n.whyItMatters),
      whyItMattersHi: clean(n.whyItMattersHi),
      importance: ['must-read', 'good-to-know', 'fyi'].includes(n.importance) ? n.importance : 'fyi',
      sources: (n.sources || []).map(s => ({ name: clean(s.name), url: s.url || '' })),
      keyNumbers: (n.keyNumbers || []).map(k => ({ label: clean(k.label), value: clean(k.value) })),
      trend: (n.trend || []).map(t => ({ label: clean(t.label), value: clean(t.value) })),
    }));

    const circulars = (parsed.circulars || []).map(c => ({
      ...c,
      title: clean(c.title),
      titleHi: clean(c.titleHi),
      summary: clean(c.summary),
      summaryHi: clean(c.summaryHi),
      actions: (c.actions || []).map(clean),
      actionsHi: (c.actionsHi || []).map(clean),
    }));

    const result = {
      morningBrief: clean(parsed.morningBrief || ''),
      morningBriefHi: clean(parsed.morningBriefHi || ''),
      news: parsed.news,
      circulars,
      fetchedAt: new Date().toISOString(),
    };

    // Store in Supabase
    const { error: upsertError } = await supabase
      .from('news_cache')
      .upsert({
        id: 'latest',
        data: result,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[fetch-news] Supabase upsert error:', upsertError);
      throw upsertError;
    }

    console.log(`[fetch-news] Success: ${parsed.news.length} news, ${circulars.length} circulars`);

    return new Response(JSON.stringify({ success: true, newsCount: parsed.news.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[fetch-news] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
