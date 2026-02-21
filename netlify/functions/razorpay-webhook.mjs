// netlify/functions/razorpay-webhook.mjs
// POST: Razorpay sends payment events here
// On subscription.charged → mark user as Pro

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('[webhook] Invalid signature');
      return new Response('Invalid signature', { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;

    console.log(`[webhook] Event: ${eventType}`);

    if (eventType === 'subscription.charged' || eventType === 'payment.captured') {
      // Extract email from payment
      const payment = event.payload?.payment?.entity || event.payload?.subscription?.entity;
      const email = payment?.email || payment?.customer?.email;

      if (!email) {
        console.error('[webhook] No email in payment');
        return new Response('No email', { status: 400 });
      }

      // Calculate expiry (1 month or 1 year based on amount)
      const amount = payment.amount / 100; // Razorpay sends in paise
      let expiresAt;
      const now = new Date();

      if (amount >= 1100) {
        // Annual plan (₹1,199)
        expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
      } else {
        // Monthly plan (₹149)
        expiresAt = new Date(now.setMonth(now.getMonth() + 1));
      }

      // Update user to Pro
      const { error } = await supabase
        .from('users')
        .update({
          plan: 'pro',
          plan_expires_at: expiresAt.toISOString(),
          razorpay_payment_id: payment.id,
        })
        .eq('email', email);

      if (error) {
        console.error('[webhook] Supabase update error:', error);
        return new Response('DB error', { status: 500 });
      }

      console.log(`[webhook] User ${email} upgraded to Pro until ${expiresAt.toISOString()}`);
    }

    if (eventType === 'subscription.cancelled' || eventType === 'subscription.halted') {
      const sub = event.payload?.subscription?.entity;
      const email = sub?.customer?.email;

      if (email) {
        await supabase
          .from('users')
          .update({ plan: 'free' })
          .eq('email', email);

        console.log(`[webhook] User ${email} downgraded to Free`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[webhook] Error:', err.message);
    return new Response('Server error', { status: 500 });
  }
}
