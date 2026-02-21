// netlify/functions/get-news.mjs
// GET endpoint: Returns cached news from Supabase
// Free users: morning brief + 5 truncated stories
// Pro users: everything

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300', // 5 min browser cache
  };

  try {
    // Check auth token (optional — free tier works without login too)
    let isPro = false;
    const authHeader = req.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      // Verify user in Supabase
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, plan, plan_expires_at')
        .eq('token', token)
        .single();

      if (user && !userErr) {
        isPro = user.plan === 'pro' && new Date(user.plan_expires_at) > new Date();
      }
    }

    // Fetch cached news
    const { data, error } = await supabase
      .from('news_cache')
      .select('data, updated_at')
      .eq('id', 'latest')
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'No news available yet' }), {
        status: 404, headers
      });
    }

    const news = data.data;

    if (isPro) {
      // PRO: Return everything
      return new Response(JSON.stringify({
        plan: 'pro',
        morningBrief: news.morningBrief,
        morningBriefHi: news.morningBriefHi,
        news: news.news,
        circulars: news.circulars,
        fetchedAt: news.fetchedAt,
      }), { status: 200, headers });
    } else {
      // FREE: Morning brief + 5 truncated stories, no circulars
      const freeNews = news.news.slice(0, 5).map(n => ({
        id: n.id,
        category: n.category,
        badge: n.badge,
        importance: n.importance,
        title: n.title,
        titleHi: n.titleHi,
        date: n.date,
        // No summary, no whyItMatters, no keyNumbers, no trend, no sources
        // These are Pro-only
        locked: true,
      }));

      return new Response(JSON.stringify({
        plan: 'free',
        morningBrief: news.morningBrief,
        morningBriefHi: news.morningBriefHi,
        news: freeNews,
        circulars: [], // No circulars for free
        fetchedAt: news.fetchedAt,
      }), { status: 200, headers });
    }

  } catch (err) {
    console.error('[get-news] Error:', err.message);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers
    });
  }
}
