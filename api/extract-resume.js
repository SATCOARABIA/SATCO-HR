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
// This endpoint also supports a second request shape, { pipelineRecord },
// used for backfilling hiring_pipeline rows that were never linked to a
// job_applications row (added manually, or predate that linkage) — see
// handlePipelineRecord() below.
//
// Auth: the caller must send header x-webhook-secret matching
// RESUME_WEBHOOK_SECRET (set in Vercel). Without it this endpoint refuses
// the request — it's reachable at a public URL, so this is what stops
// randoms from spamming it.

import mammoth from 'mammoth';

const SUPA_URL = process.env.SUPABASE_URL || 'https://oaerqjrkdpuhiproppaz.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.RESUME_WEBHOOK_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const EXTRACT_PROMPT = `Read this resume/CV and extract the following fields. For meExperience: answer "yes" if the candidate has worked in any Middle East country (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Iraq), otherwise "no". For workHistory: list the top 8 experience rows as "Company | Role/Designation | Work Location/Country/Site | Period" separated by semicolons. For eduLevel: the highest qualification stated (e.g. Diploma, Bachelor's, ITI, High School). For areaOfExpertise: the candidate's primary technical/functional specialization, distinct from their literal job title — pick the single best-fit category such as "QA/QC", "Piping Supervision", "Planning & Scheduling", "HSE/Safety", "Project Management", "Construction Supervision", "Electrical", "Instrumentation", "Welding Inspection", "Civil/Structural", "Mechanical", "Procurement", "Document Control", "Commissioning", or similar — infer this from their overall work history and skills, not just their most recent title. Reply ONLY with valid JSON, no markdown:
{"fullName":"...","passportNo":"...","passportExpiry":"YYYY-MM-DD","experienceYears":"...","position":"...","phone":"...","email":"...","nationality":"...","currentEmployer":"...","currentDesignation":"...","areaOfExpertise":"...","skills":"comma-separated technical skills/tools/certifications/trade skills max 25","eduLevel":"...","meExperience":"yes or no","workHistory":"Company | Role | Location | Period; Company | Role | Location | Period","resumeStrengthScore":"integer 0-100 rating overall resume strength"}
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

// Resolves a cv_file_path / resume_url value (in any of the shapes seen
// across the data) to raw file bytes + a guessed content kind.
async function fetchCvBytes(cvPath) {
  let fileRes;
  if (/^https?:\/\//i.test(cvPath)) {
    fileRes = await fetch(cvPath, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
  } else {
    const storagePath = cvPath.startsWith('cv-uploads::') ? cvPath.replace('cv-uploads::', '') : cvPath;
    fileRes = await fetch(`${SUPA_URL}/storage/v1/object/cv-uploads/${storagePath}`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
  }
  if (!fileRes.ok) throw new Error(`Could not read CV from storage (${fileRes.status})`);
  const arrBuf = await fileRes.arrayBuffer();
  const base64 = Buffer.from(arrBuf).toString('base64');

  const lower = cvPath.toLowerCase().split('?')[0];
  const isPdf = lower.endsWith('.pdf');
  const isJpg = lower.endsWith('.jpg') || lower.endsWith('.jpeg');
  const isPng = lower.endsWith('.png');
  const isWebp = lower.endsWith('.webp');
  const isDocx = lower.endsWith('.docx');

  return {
    base64,
    isPdf,
    isImage: isJpg || isPng || isWebp,
    imageMediaType: isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg',
    isDocx,
  };
}

// Runs the Claude extraction prompt against a resolved CV (PDF, image, or
// .docx). Returns null for still-unsupported formats (old binary .doc) —
// nothing is lost in that case, the row still gets saved with whatever raw
// fields it already had, just not AI-enriched.
async function extractFields(cvBytes) {
  const { base64, isPdf, isImage, imageMediaType, isDocx } = cvBytes;
  if (!isPdf && !isImage && !isDocx) return null;

  let messageContent;
  if (isDocx) {
    // .docx isn't a format Claude's document/image blocks accept directly —
    // pull the raw text out with mammoth first and send that as plain text.
    const { value: resumeText } = await mammoth.extractRawText({ buffer: Buffer.from(base64, 'base64') });
    if (!resumeText || !resumeText.trim()) return null;
    messageContent = [{ type: 'text', text: `Resume text:\n\n${resumeText}\n\n${EXTRACT_PROMPT}` }];
  } else {
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: base64 } };
    messageContent = [contentBlock, { type: 'text', text: EXTRACT_PROMPT }];
  }

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
        content: messageContent,
      }],
    }),
  });
  if (!claudeRes.ok) throw new Error(`Claude extraction failed (${claudeRes.status})`);
  const claudeData = await claudeRes.json();
  const text = (claudeData.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// Backfill path: re-extract for an existing hiring_pipeline row directly,
// keyed by its own id (no job_applications row involved — either it was
// added manually, or predates the source_application_id linkage).
async function handlePipelineRecord(pipelineRecord) {
  const cvPath = pipelineRecord.resume_url || pipelineRecord.cv_path || null;
  if (!cvPath) return { skipped: true, reason: 'No CV attached to this pipeline record' };

  const cvBytes = await fetchCvBytes(cvPath);
  const extracted = await extractFields(cvBytes);
  if (!extracted) return { skipped: true, reason: 'Unsupported file format for AI extraction (e.g. legacy .doc)' };

  const patch = {
    nationality: extracted.nationality || pipelineRecord.nationality || null,
    position: extracted.position || pipelineRecord.position || null,
    experience: extracted.experienceYears || pipelineRecord.experience || null,
    current_designation: extracted.currentDesignation || null,
    current_employer: extracted.currentEmployer || null,
    area_of_expertise: extracted.areaOfExpertise || null,
    education: extracted.eduLevel || null,
    skills: extracted.skills || null,
    work_history: extracted.workHistory || null,
  };

  const patchRes = await sbFetch(`/rest/v1/hiring_pipeline?id=eq.${pipelineRecord.id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return { ok: true, extracted: true, pipelineSaved: patchRes.ok, candidateName: pipelineRecord.candidate_name };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPA_KEY) return res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_ROLE_KEY is not set' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Server not configured: ANTHROPIC_API_KEY is not set' });

  // Pipeline-only backfill path (see handlePipelineRecord above).
  if (req.body?.pipelineRecord) {
    try {
      const result = await handlePipelineRecord(req.body.pipelineRecord);
      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const record = req.body?.record;
  if (!record || !record.id) return res.status(400).json({ error: 'No record in payload' });

  const cvPath = record.cv_file_path || record.cv_path || null;
  if (!cvPath) return res.status(200).json({ skipped: true, reason: 'No CV attached to this application' });

  try {
    // 1. Pull the CV bytes. cv_file_path shows up in a few different shapes
    // across the data (older rows especially):
    //   - "cv-uploads::<path>"            -> Storage path in cv-uploads bucket
    //   - "https://.../storage/v1/object/public/<bucket>/<path>" -> full URL,
    //      may point at cv-uploads OR a different bucket (e.g. hr-documents)
    //   - "<path>"                        -> bare path, assume cv-uploads
    // service_role bypasses RLS for the direct-storage-path cases, so this
    // works regardless of the bucket's access policy.
    const cvBytes = await fetchCvBytes(cvPath);

    // 2. Claude extraction (PDF, image, or .docx — legacy binary .doc CVs
    // skip this step and still get a Talent Pool row from the raw form
    // fields below, so nothing gets lost, it's just not auto-enriched).
    const extracted = await extractFields(cvBytes);

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
      area_of_expertise: extracted?.areaOfExpertise || null,
      education: extracted?.eduLevel || null,
      skills: extracted?.skills || null,
      work_history: extracted?.workHistory || null,
      resume_url: /^https?:\/\//i.test(cvPath) ? cvPath : (cvPath.startsWith('cv-uploads::') ? cvPath : `cv-uploads::${cvPath}`),
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
