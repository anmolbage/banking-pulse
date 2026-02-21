-- ============================================
-- BANKING PULSE — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  picture TEXT DEFAULT '',
  google_id TEXT DEFAULT '',
  token TEXT DEFAULT '',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  plan_expires_at TIMESTAMPTZ DEFAULT NULL,
  razorpay_payment_id TEXT DEFAULT '',
  last_login TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookups (used on every API call)
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. News cache table (stores latest fetch)
CREATE TABLE IF NOT EXISTS news_cache (
  id TEXT PRIMARY KEY DEFAULT 'latest',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable Row Level Security (good practice)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;

-- Allow service key full access (our backend functions use service key)
CREATE POLICY "Service key full access on users"
  ON users FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service key full access on news_cache"
  ON news_cache FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================
-- DONE! Your tables are ready.
-- ============================================
