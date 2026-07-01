const SUPA_URL = 'https://oaerqjrkdpuhiprompaz.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9tcGF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk1NDQ2OSwiZXhwIjoyMDk1NTMwNDY5fQ.ryXu5fVsxTkRYnEm9CF8unP0sBnu8uzGhbxx4248GrU';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
