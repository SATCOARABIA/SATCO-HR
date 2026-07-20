// Server-only, automatic resume extraction.
//
// Triggered by a Supabase Database Webhook that fires on every INSERT into
// job_applications (i.e. every website job application). It runs regardless
// of whether anyone has the app open — that's the whole point: previously
// resume field extraction only happened if an HR staff member had a
// specific screen open in their browser, which doesn't scale to hundreds/
// thousands of applications.
//
// What it does for each new application:
//   1. Reads the uploaded CV from Supabase Storage.
//   2. Asks Claude to extract structured fields (same schema as the
//      existing manual "AI Scan" feature in the Hiring Pipeline editor, so
//      results are consistent whichever path a candidate came in through).
//   3. Writes those fields back onto the job_applications row.
//   4. Upserts a matching row into hiring_pipeline (Talent Pool) so the
//      candidate is immediately searchable/exportable from
//      Candidates -> All / Search / Export — no manual "move" step.
//
// Auth: the webhook must send header x-webhook-secret matching
// RESUME_WEBHOOK_SECRET (set in Vercel). Without it this endpoint refuses
// the request — it's reachable at a public URL, so this is what stops
// randoms from spamming it.

const SUPA_URL = process.env.SUPABASE_URL || 'https://oaerqjrkdpuhiproppaz.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.RESUME_WEBHOOK_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const EXTRACT_PROMPT = `Read this resume/CV and extract the following fields. For meExperience: answer "yes" if the candidate has worked in any Middle East country (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Iraq), otherwise "no". For workHistory: list the top 8 experience rows as "Company | Role/Designation | Work Location/Country/Site | Period" separated by semicolons. For eduLevel: the highest qualification stated (e.g. Diploma, Bachelor's, ITI, High School). Reply ONLY with valid JSON, no markdown:
{"fullName":"...","passportNo":"...","passportExpiry":"YYYY-MM-DD","experienceYears":"...","position":"...","phone":"...","email":"...","nationality":"...","currentEmployer":"...","currentDesignation":"...","skills":"comma-separated technical skills/tools/certifications/trade skills max 25","eduLevel":"...","meExperience":"yes or no","workHistory":"Company | Role | Location | Period; Company | Role | Location | Period","resumeStrengthScore":"integer 0-100 rating overall resume strength"}
Use null for missing fields.`;

async function sbFetch(path, opts = {}) {
  return fetch(`${SUPA_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPA_KEY) return res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_ROLE_KEY is not set' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Server not configured: ANTHROPIC_API_KEY is not set' });

  const record = req.body?.record;
  if (!record || !record.id) return res.status(400).json({ error: 'No record in payload' });

  const cvPath = record.cv_file_path || record.cv_path || null;
  if (!cvPath) return res.status(200).json({ skipped: true, reason: 'No CV attached to this application' });

  try {
    // 1. Pull the CV bytes straight from Storage. service_role bypasses RLS,
    // so this works regardless of the bucket's access policy.
    const fileRes = await fetch(`${SUPA_URL}/storage/v1/object/cv-uploads/${cvPath}`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    if (!fileRes.ok) throw new Error(`Could not read CV from storage (${fileRes.status})`);
    const arrBuf = await fileRes.arrayBuffer();
    const base64 = Buffer.from(arrBuf).toString('base64');
    const isPdf = cvPath.toLowerCase().endsWith('.pdf');

    let extracted = null;
    if (isPdf) {
      // 2. Claude document-block extraction (PDF only — .doc/.docx CVs skip
      // this step and still get a Talent Pool row from the raw form fields
      // below, so nothing gets lost, it's just not auto-enriched).
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: EXTRACT_PROMPT },
            ],
          }],
        }),
      });
      if (!claudeRes.ok) throw new Error(`Claude extraction failed (${claudeRes.status})`);
      const claudeData = await claudeRes.json();
      const text = (claudeData.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      const clean = text.replace(/```json|```/g, '').trim();
      extracted = JSON.parse(clean);
    }

    const candidateName = record.full_name || record.applicant_name || extracted?.fullName || 'Unknown Candidate';

    // 3. Patch the job_applications row with whatever we found.
    if (extracted) {
      await sbFetch(`/rest/v1/job_applications?id=eq.${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          education: extracted.eduLevel || null,
          work_history: extracted.workHistory || record.work_history || null,
          current_role: extracted.currentDesignation || record.current_role || null,
          current_employer: extracted.currentEmployer || record.current_employer || null,
        }),
      });
    }

    // 4. Upsert into hiring_pipeline (Talent Pool). Idempotency key is
    // source_application_id, not email — a webhook retry must not create a
    // second row, but a candidate applying to two different roles should
    // still get two Talent Pool entries (matches how the rest of the app
    // already behaves for manual "Save to Resume DB" actions).
    const chk = await sbFetch(`/rest/v1/hiring_pipeline?source_application_id=eq.${record.id}&select=id&limit=1`);
    const existingRows = await chk.json();
    const existingId = Array.isArray(existingRows) && existingRows[0] ? existingRows[0].id : null;

    const pipelinePayload = {
      candidate_name: candidateName,
      email: record.email || null,
      phone: record.phone || null,
      nationality: extracted?.nationality || record.nationality || null,
      current_location: record.current_location || null,
      position: record.vacancy_title || extracted?.position || null,
      experience: extracted?.experienceYears || record.years_experience || null,
      current_designation: extracted?.currentDesignation || null,
      current_employer: extracted?.currentEmployer || null,
      education: extracted?.eduLevel || null,
      skills: extracted?.skills || null,
      work_history: extracted?.workHistory || null,
      resume_url: `cv-uploads::${cvPath}`,
      pipeline_location: 'resume_db',
      status: 'Resume DB',
      step: 'Offer Pending',
      hiring_scenario: 'S3',
      source_application_id: record.id,
    };

    const pipelineRes = existingId
      ? await sbFetch(`/rest/v1/hiring_pipeline?id=eq.${existingId}`, { method: 'PATCH', body: JSON.stringify(pipelinePayload) })
      : await sbFetch('/rest/v1/hiring_pipeline', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(pipelinePayload) });

    return res.status(200).json({
      ok: true,
      extracted: !!extracted,
      pipelineSaved: pipelineRes.ok,
      candidateName,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
