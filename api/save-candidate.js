// Server-only. SUPA_URL is not a secret (safe to default); SUPA_KEY is a
// Supabase service_role key, which bypasses RLS entirely, so it must come
// from the environment -- there is no fallback. Set SUPABASE_SERVICE_ROLE_KEY
// in Vercel (Project Settings -> Environment Variables) using the key from
// the Supabase dashboard (Project Settings -> API). Until it's set, this
// endpoint fails closed with a 500 instead of silently using a key that used
// to be hardcoded here.
const SUPA_URL = process.env.SUPABASE_URL || 'https://oaerqjrkdpuhiproppaz.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPA_KEY) {
    return res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_ROLE_KEY is not set' });
  }

  const { payload } = req.body || {};
  if (!payload?.candidate_name) return res.status(400).json({ error: 'candidate_name required' });

  payload.pipeline_location = 'resume_db';
  payload.status = payload.status || 'Resume DB';
  payload.step = 'Offer Pending';
  payload.hiring_scenario = 'S3';

  if (payload.email) {
    const chk = await fetch(`${SUPA_URL}/rest/v1/hiring_pipeline?email=eq.${encodeURIComponent(payload.email)}&select=id&limit=1`,
      { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY } });
    const existing = await chk.json();
    if (existing?.length > 0) return res.status(409).json({ error: 'duplicate' });
  }

  const ins = await fetch(`${SUPA_URL}/rest/v1/hiring_pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, Prefer: 'return=minimal' },
    body: JSON.stringify(payload)
  });

  if (!ins.ok) { const t = await ins.text(); return res.status(502).json({ error: t }); }
  return res.status(200).json({ ok: true });
}
