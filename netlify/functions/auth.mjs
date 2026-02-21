// netlify/functions/auth.mjs
// POST: Verify Google token, create/get user, return session token + plan status

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { googleToken } = body;

    if (!googleToken) {
      return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers });
    }

    // Verify Google token
    const googleResp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${googleToken}`
    );

    if (!googleResp.ok) {
      return new Response(JSON.stringify({ error: 'Invalid Google token' }), { status: 401, headers });
    }

    const googleUser = await googleResp.json();
    const { email, name, picture, sub: googleId } = googleUser;

    if (!email) {
      return new Response(JSON.stringify({ error: 'No email in token' }), { status: 400, headers });
    }

    // Generate a simple session token
    const sessionToken = crypto.randomUUID() + '-' + Date.now().toString(36);

    // Upsert user in Supabase
    const { data: user, error: userErr } = await supabase
      .from('users')
      .upsert({
        email,
        name: name || '',
        picture: picture || '',
        google_id: googleId,
        token: sessionToken,
        last_login: new Date().toISOString(),
      }, {
        onConflict: 'email',
      })
      .select('id, email, name, plan, plan_expires_at, created_at')
      .single();

    if (userErr) {
      console.error('[auth] Supabase error:', userErr);
      return new Response(JSON.stringify({ error: 'Database error' }), { status: 500, headers });
    }

    const isPro = user.plan === 'pro' && new Date(user.plan_expires_at) > new Date();

    return new Response(JSON.stringify({
      success: true,
      token: sessionToken,
      user: {
        email: user.email,
        name: user.name,
        plan: isPro ? 'pro' : 'free',
        planExpiresAt: user.plan_expires_at,
        memberSince: user.created_at,
      },
    }), { status: 200, headers });

  } catch (err) {
    console.error('[auth] Error:', err.message);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers });
  }
}
