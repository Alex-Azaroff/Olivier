const { createClient } = require('@supabase/supabase-js');

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function getSupabaseAdminConfigError() {
  const missing = [];
  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing.length ? `missing_env:${missing.join(',')}` : null;
}

module.exports = { getSupabaseAdmin, getSupabaseAdminConfigError };

