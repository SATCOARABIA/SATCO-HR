// supabase/functions/daily-alert/index.ts
// Deploy: supabase functions deploy daily-alert

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')

// ── helpers ──────────────────────────────────────────────────────────
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Dubai' }) : '—'
const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Dubai' }) : '—'
const todayUAE = () => new Date(new Date().toLocaleDateString('en-CA', { timeZone:'Asia/Dubai' }))
const daysDiff = (a: string | Date, b: string | Date) => Math.round((new Date(a as string).getTime() - new Date(b as string).getTime()) / 86400000)

Deno.serve(async () => {
  const db = createClient(SUPABASE_URL!, SERVICE_KEY!)
  const today = todayUAE()
  const dateStr = today.toLocaleDateString('en-GB')
  const { data: recips } = await db.from('recipients').select('*')

  // ════════════════════════════════════════════════════════════════════
  // PART 1 — EMPLOYEE DOCUMENT EXPIRY + MISSING DATA
  // CRITICAL FIX: filter deleted_at IS NULL so soft-deleted employees
  // (e.g. duplicate IDs like SA1015) do NOT appear in alerts.
  // ════════════════════════════════════════════════════════════════════
  const [{ data: emps }, { data: trainings }] = await Promise.all([
    db.from('employees').select('*').is('deleted_at', null),   // ← FIX: was missing this filter
    db.from('employee_trainings').select('*').is('deleted_at', null),
  ])

  const THRESH: Record<string, number> = { passport:180, eid:60, visa:60, insurance:30, cicpa:15, iloe:30 }
  const COLS: Record<string, string>   = { passport:'passport_expiry', eid:'eid_expiry', visa:'visa_expiry', insurance:'insurance_expiry', cicpa:'cicpa_expiry', iloe:'iloe_expiry' }
  const LBLS: Record<string, string>   = { passport:'Passport', eid:'Emirates ID', visa:'Visa', insurance:'Insurance', cicpa:'CICPA Gate Pass', iloe:'ILOE' }
  const MISSING_COLS = [
    { col:'passport_expiry',  label:'Passport Expiry' },
    { col:'eid_expiry',       label:'Emirates ID Expiry' },
    { col:'visa_expiry',      label:'Visa Expiry' },
    { col:'insurance_expiry', label:'Insurance Expiry' },
    { col:'iloe_expiry',      label:'ILOE Expiry' },
  ]
  const TRAINING_THRESH = 30
  const hits: Array<{name:string,id:string,doc:string,d:number}> = []
  const missing: Array<{name:string,id:string,fields:string[]}> = []

  for (const emp of (emps || [])) {
    for (const [k, days] of Object.entries(THRESH)) {
      const val = emp[COLS[k]]; if (!val) continue
      const exp = new Date(val); exp.setHours(0,0,0,0)
      const d = Math.round((exp.getTime() - today.getTime()) / 86400000)
      if (d <= days) hits.push({ name:emp.full_name, id:emp.employee_id, doc:LBLS[k], d })
    }
    const mf = MISSING_COLS.filter(f => !emp[f.col]).map(f => f.label)
    if (mf.length) missing.push({ name:emp.full_name, id:emp.employee_id, fields:mf })
  }
  for (const tr of (trainings || [])) {
    let parsed: Record<string, any> = {}
    try { parsed = JSON.parse(tr.training_records || '{}') } catch { /* ignore */ }
    for (const [key, rec] of Object.entries(parsed)) {
      if (key === '__other' || !(rec as any)?.expiry) continue
      const exp = new Date((rec as any).expiry); exp.setHours(0,0,0,0)
      const d = Math.round((exp.getTime() - today.getTime()) / 86400000)
      if (d <= TRAINING_THRESH) hits.push({ name:tr.full_name, id:tr.employee_id, doc:(rec as any).courseName||key, d })
    }
    for (const ot of (parsed.__other || [])) {
      if (!ot.expiry) continue
      const exp = new Date(ot.expiry); exp.setHours(0,0,0,0)
      const d = Math.round((exp.getTime() - today.getTime()) / 86400000)
      if (d <= TRAINING_THRESH) hits.push({ name:tr.full_name, id:tr.employee_id, doc:ot.courseName||ot.label||'Training Cert', d })
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // PART 2 — HIRING PIPELINE ALERTS (4 types)
  // Also filter out converted/deleted pipeline entries
  // ════════════════════════════════════════════════════════════════════
  const { data: pipeline } = await db.from('hiring_pipeline').select('*')
    .is('deleted_at', null)
    .neq('pipeline_location', 'converted')   // ← FIX: exclude already-converted candidates

  const pipelineAlerts: Array<{id:string,flag:string,section:string,line:string}> = []

  for (const c of (pipeline || [])) {
    const name = c.full_name || c.candidate_name || 'Unknown'
    const tid  = c.temp_employee_id || c.id
    const pos  = c.position || c.job_title || ''

    // A) Visa expiring <=14 days, not yet arrived
    if (c.visit_visa_expiry_date && !c.date_of_arrival && !c.visa_expiry_alert_sent) {
      const d = daysDiff(c.visit_visa_expiry_date, today)
      if (d >= 0 && d <= 14) {
        pipelineAlerts.push({ id:c.id, flag:'visa_expiry_alert_sent', section:'VISA EXPIRY WARNING',
          line: name + ' [' + tid + '] — Visit visa expires in ' + d + 'd (' + fmtDate(c.visit_visa_expiry_date) + ')' })
      }
    }

    // B) 7 days since visa issued, no ticket booked
    if (c.visit_visa_issue_date && !c.ticket_depart_datetime && !c.ticket_reminder_sent) {
      const d = daysDiff(today, c.visit_visa_issue_date)
      if (d === 7) {
        pipelineAlerts.push({ id:c.id, flag:'ticket_reminder_sent', section:'TICKET NOT BOOKED (7d since visa)',
          line: name + ' [' + tid + '] ' + pos + ' — Visa issued ' + fmtDate(c.visit_visa_issue_date) + ', no ticket booked yet' })
      }
    }

    // C) 2 days before departure — AIRPORT PICKUP
    if (c.ticket_depart_datetime && !c.pickup_alert_sent) {
      const d = daysDiff(c.ticket_depart_datetime, today)
      if (d === 2) {
        const airport = (c.ticket_to_airport || 'AUH') + (c.ticket_to_terminal ? ' T/' + c.ticket_to_terminal : '')
        const flight  = (c.ticket_flight_no || '') + (c.ticket_pnr ? ' · PNR: ' + c.ticket_pnr : '')
        const route   = (c.ticket_from_city || c.ticket_from_airport || '?') + ' → ' + (c.ticket_to_city || c.ticket_to_airport || 'AUH')
        const line    = name + ' [' + tid + '] | ' + pos + '\n'
                      + '  Flight:  ' + flight + '\n'
                      + '  Route:   ' + route + '\n'
                      + '  Arrives: ' + airport + ' on ' + fmtDate(c.ticket_arrive_datetime) + ' at ' + fmtTime(c.ticket_arrive_datetime) + ' (UAE time)\n'
                      + '  ➜ Please arrange driver for airport pickup.'
        pipelineAlerts.push({ id:c.id, flag:'pickup_alert_sent', section:'AIRPORT PICKUP — DEPARTURE IN 2 DAYS', line })
      }
    }

    // D) 22 days after arrival, not yet Joined
    if (c.date_of_arrival && !c.post_arrival_alert_sent) {
      const d = daysDiff(today, c.date_of_arrival)
      if (d === 22) {
        const deadline = new Date(c.date_of_arrival); deadline.setDate(deadline.getDate() + 30)
        pipelineAlerts.push({ id:c.id, flag:'post_arrival_alert_sent', section:'RESIDENCE VISA URGENCY (Day 22 — 8 days left)',
          line: name + ' [' + tid + '] ' + pos + ' — Arrived ' + fmtDate(c.date_of_arrival) + ', deadline ' + fmtDate(deadline.toISOString()) })
      }
    }
  }

  // Mark flags so alerts only send once
  for (const pa of pipelineAlerts) {
    await db.from('hiring_pipeline').update({ [pa.flag]: true }).eq('id', pa.id)
  }

  // ════════════════════════════════════════════════════════════════════
  // PART 3 — RECYCLE BIN: 2-day purge warning + 30-day auto-purge
  // ════════════════════════════════════════════════════════════════════
  const RECYCLE_TABLES = [
    { table: 'employees',          name: 'full_name' },
    { table: 'mob_demob',          name: 'full_name' },
    { table: 'employee_contacts',  name: 'full_name' },
    { table: 'employee_trainings', name: 'full_name' },
    { table: 'hiring_pipeline',    name: 'full_name' },
    { table: 'recipients',         name: 'name' },
    { table: 'job_vacancies',      name: 'title' },
    { table: 'job_applications',   name: 'applicant_name' },
  ]
  const purgeWarnings: string[] = [], purgedRows: string[] = []
  for (const rt of RECYCLE_TABLES) {
    let rows: any[] = []
    try {
      const res = await db.from(rt.table).select('*').not('deleted_at', 'is', null)
      rows = res.data || []
    } catch (_e) { continue }
    for (const row of rows) {
      if (!row.deleted_at) continue
      const d = daysDiff(today, row.deleted_at)
      const label = row[rt.name] || row.candidate_name || row.email || ('#' + row.id)
      if (d >= 30) {
        await db.from(rt.table).delete().eq('id', row.id)
        await db.from('audit_log').insert({ actor_email:'system', table_name:rt.table, record_id:String(row.id), record_label:label, action:'purge', details:'Auto-purged after 30 days in Recycle Bin' })
        purgedRows.push(rt.table + ': ' + label)
      } else if (d >= 28 && !row.purge_warned_at) {
        await db.from(rt.table).update({ purge_warned_at: new Date().toISOString() }).eq('id', row.id)
        purgeWarnings.push(rt.table + ': ' + label + ' (deleted ' + fmtDate(row.deleted_at) + ' by ' + (row.deleted_by || 'unknown') + ') — permanently purges in ' + (30 - d) + 'd')
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // PART 4 — BUILD EMAIL & SEND
  // ════════════════════════════════════════════════════════════════════
  const hasAnything = hits.length || missing.length || pipelineAlerts.length || purgeWarnings.length || purgedRows.length
  if (!hasAnything) return new Response('No alerts today', { status: 200 })

  const sections: Record<string, string[]> = {}
  for (const pa of pipelineAlerts) {
    if (!sections[pa.section]) sections[pa.section] = []
    sections[pa.section].push(pa.line)
  }

  let emailBody = 'SATCO Arabia — Daily HR Alert\n' + dateStr + '\n' + '='.repeat(50) + '\n\n'

  if (pipelineAlerts.length) {
    emailBody += 'HIRING PIPELINE ALERTS (' + pipelineAlerts.length + ')\n' + '-'.repeat(40) + '\n'
    for (const [sec, lines] of Object.entries(sections)) {
      emailBody += '\n' + sec + ':\n'
      lines.forEach(l => { emailBody += l + '\n' })
    }
    emailBody += '\n'
  }

  if (hits.length || missing.length) {
    emailBody += 'EMPLOYEE COMPLIANCE ALERTS\n' + '-'.repeat(40) + '\n'
    const ovd  = hits.filter(h => h.d < 0)
    const crit = hits.filter(h => h.d >= 0 && h.d <= 7)
    const urg  = hits.filter(h => h.d > 7)
    if (ovd.length)  { emailBody += '\nEXPIRED (' + ovd.length + '):\n';   ovd.forEach(h  => { emailBody += '- ' + h.name + ' [' + h.id + '] — ' + h.doc + ' EXPIRED ' + Math.abs(h.d) + 'd ago\n' }) }
    if (crit.length) { emailBody += '\nCRITICAL (' + crit.length + '):\n'; crit.forEach(h => { emailBody += '- ' + h.name + ' [' + h.id + '] — ' + h.doc + ' in ' + h.d + 'd\n' }) }
    if (urg.length)  { emailBody += '\nURGENT (' + urg.length + '):\n';   urg.forEach(h  => { emailBody += '- ' + h.name + ' [' + h.id + '] — ' + h.doc + ' in ' + h.d + 'd\n' }) }
    if (missing.length) {
      emailBody += '\n===== MISSING DOCUMENT DATA (' + missing.length + ' employee(s)) =====\n'
      missing.forEach(r => {
        emailBody += '• ' + r.name + ' [' + r.id + ']\n'
        r.fields.forEach(f => { emailBody += '    – ' + f + ': NOT ENTERED\n' })
      })
    }
  }

  if (purgeWarnings.length) {
    emailBody += '\n===== RECYCLE BIN — PURGING IN 2 DAYS (' + purgeWarnings.length + ') =====\n'
    emailBody += 'These deleted records will be PERMANENTLY removed in 2 days unless restored:\n'
    purgeWarnings.forEach(w => { emailBody += '• ' + w + '\n' })
  }
  if (purgedRows.length) {
    emailBody += '\n===== AUTO-PURGED TODAY (' + purgedRows.length + ') =====\n'
    purgedRows.forEach(r => { emailBody += '• ' + r + '\n' })
  }

  emailBody += '\nPlease take necessary action.\nSATCO Arabia HR System'

  const subject = `HR Alert: ${hits.filter(h=>h.d<0).length > 0 ? hits.filter(h=>h.d<0).length+' expired | ' : ''}${crit?.length > 0 ? crit.length+' critical | ' : ''}${missing.length} missing record(s) — ${dateStr}`

  const toList = (recips || []).map((r: any) => ({ email: r.email, name: r.name || r.email }))
  if (!toList.length) return new Response('No recipients configured', { status: 200 })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'HR Compliance <info@satcoarabiaengg.com>',
      to: toList.map((r: any) => r.email),
      subject,
      text: emailBody,
    })
  })

  const resJson = await res.json()
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, resend: resJson, alerts: hits.length + missing.length, pipeline: pipelineAlerts.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
