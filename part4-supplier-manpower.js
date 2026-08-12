    // ══════════════════════════════════════════════════════════════════════
    // SUPPLIER MANPOWER MODULE
    // Tracks external manpower suppliers/agencies (master directory) and the
    // employees they've deployed to SATCO sites — kept separate from SATCO's
    // own direct 'employees' table since these people are on the supplier's
    // payroll, not SATCO's. Mirrors the same list/modal/AI-scan/mobile
    // conventions used everywhere else in this app (Employees, Resume DB).
    // ══════════════════════════════════════════════════════════════════════

    const SUPPLIER_MANPOWER_SETUP_SQL = `-- ══════════════════════════════════════════════════════════
-- SATCO HR — Supplier Manpower setup SQL
-- Safe to run this MORE THAN ONCE — every statement is idempotent (IF NOT
-- EXISTS / IF EXISTS guards), so re-running it after an error, or later to
-- pick up a new column, will not duplicate or break anything.
-- Run in Supabase SQL Editor (project: oaerqjrkdpuhiproppaz)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS suppliers (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id           text        UNIQUE,
  supplier_name         text        NOT NULL,
  contact_person        text,
  contact_designation   text,
  mobile                text,
  whatsapp              text,
  email                 text,
  address               text,
  trade_type            text,
  trade_license_no      text,
  trade_license_expiry  date,
  trade_license_img_url text,
  vat_trn_no            text,
  vat_cert_expiry       date,
  vat_cert_img_url      text,
  licensed_activities   text,
  license_alert_last_sent timestamptz,
  status                text        DEFAULT 'Active',
  notes                 text,
  deleted_at            timestamptz,
  deleted_by            text,
  created_at            timestamptz DEFAULT now()
);
-- Adds the columns to a supplier table that was already created by an earlier
-- run of this script (CREATE TABLE IF NOT EXISTS above won't add columns to
-- an existing table).
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS licensed_activities text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS license_alert_last_sent timestamptz;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read"   ON suppliers;
DROP POLICY IF EXISTS "anon_insert" ON suppliers;
DROP POLICY IF EXISTS "anon_update" ON suppliers;
DROP POLICY IF EXISTS "anon_delete" ON suppliers;
CREATE POLICY "anon_read"   ON suppliers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON suppliers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON suppliers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON suppliers FOR DELETE TO anon USING (true);

CREATE TABLE IF NOT EXISTS supplier_employees (
  id                     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_employee_id   text        UNIQUE,
  supplier_id            text        REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
  full_name              text        NOT NULL,
  position               text,
  nationality            text,
  mobile                 text,
  passport_no            text,
  passport_expiry        date,
  passport_img_url       text,
  eid_no                 text,
  eid_expiry             date,
  eid_img_url            text,
  insurance_no           text,
  insurance_expiry       date,
  insurance_img_url      text,
  joined_date            date,
  current_location       text,
  certificates           text,
  certificates_img_url   text,
  status                 text        DEFAULT 'Active',
  notes                  text,
  deleted_at             timestamptz,
  deleted_by             text,
  created_at             timestamptz DEFAULT now()
);
ALTER TABLE supplier_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read"   ON supplier_employees;
DROP POLICY IF EXISTS "anon_insert" ON supplier_employees;
DROP POLICY IF EXISTS "anon_update" ON supplier_employees;
DROP POLICY IF EXISTS "anon_delete" ON supplier_employees;
CREATE POLICY "anon_read"   ON supplier_employees FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON supplier_employees FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON supplier_employees FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON supplier_employees FOR DELETE TO anon USING (true);

-- Indexes — keep the supplier employee list and supplier lookups fast as the
-- roster grows toward ~200 suppliers and their deployed staff. Cheap to add
-- now, before row counts get large enough for it to matter.
CREATE INDEX IF NOT EXISTS suppliers_deleted_at_idx          ON suppliers (deleted_at);
CREATE INDEX IF NOT EXISTS supplier_employees_deleted_at_idx ON supplier_employees (deleted_at);
CREATE INDEX IF NOT EXISTS supplier_employees_supplier_id_idx ON supplier_employees (supplier_id);`;

    // ID generators — client-side sequential, formatted so a security guard or auditor can
    // read SUP-0007-E03 at a glance and know it's the 3rd registered employee of supplier #7.
    const nextSupplierId = (suppliers) => {
      let max = 0;
      (suppliers||[]).forEach(s => { const m = /^SUP-(\d+)$/.exec(s.supplier_id||''); if (m) max = Math.max(max, parseInt(m[1],10)); });
      return 'SUP-' + String(max+1).padStart(4,'0');
    };
    const nextSupplierEmployeeId = (supplierEmployees, supplierId) => {
      if (!supplierId) return '';
      const prefix = supplierId + '-E';
      let max = 0;
      (supplierEmployees||[]).forEach(e => {
        const id = e.supplier_employee_id || '';
        if (id.indexOf(prefix) === 0) { const n = parseInt(id.slice(prefix.length),10); if (!isNaN(n)) max = Math.max(max,n); }
      });
      return prefix + String(max+1).padStart(2,'0');
    };

    const SUPPLIER_DOC_TYPES = [
      { key:'trade_license_img_url', label:'📜 Trade License', accept:'image/jpeg,image/png,image/webp,application/pdf',
        ocrPrompt:`OCR this UAE trade license. Extract:
1. License number
2. Company / trade name as licensed
3. Expiry date (YYYY-MM-DD)
4. Licensed activities — the list of business activities printed on the license (e.g. "General Contracting", "Manpower Supply", "Building Cleaning Services"), as an array of short strings
Reply ONLY as valid JSON, no markdown:
{"licenseNo":"...","companyName":"...","expiryDate":"YYYY-MM-DD","activities":["...","..."]}
Use null for missing fields, and an empty array if no activities are visible.` },
      { key:'vat_cert_img_url', label:'🧾 VAT / TRN Certificate', accept:'image/jpeg,image/png,image/webp,application/pdf',
        ocrPrompt:`OCR this UAE VAT registration certificate. Extract:
1. Tax Registration Number (TRN)
2. Legal / trade name on the certificate
Reply ONLY as valid JSON, no markdown:
{"trn":"...","legalName":"..."}
Use null for missing fields.` },
    ];

    const SUPPLIER_EMP_DOC_TYPES = [
      { key:'passport_img_url', label:'🛂 Passport', accept:'image/jpeg,image/png,image/webp,application/pdf',
        ocrPrompt:`OCR this passport. Extract:
1. Full name
2. Passport number
3. Nationality
4. Expiry date (YYYY-MM-DD)
Reply ONLY as valid JSON, no markdown:
{"fullName":"...","passportNo":"...","nationality":"...","expiryDate":"YYYY-MM-DD"}
Use null for missing fields.` },
      { key:'eid_img_url', label:'🪪 Emirates ID', accept:'image/jpeg,image/png,image/webp,application/pdf',
        ocrPrompt:`OCR this UAE Emirates ID card. Extract:
1. ID number (784-XXXX-XXXXXXX-X)
2. Full name
3. Expiry date (YYYY-MM-DD)
Reply ONLY as valid JSON, no markdown:
{"eidNo":"...","fullName":"...","expiryDate":"YYYY-MM-DD"}
Use null for missing fields.` },
      { key:'insurance_img_url', label:'🏥 Health Insurance', accept:'image/jpeg,image/png,image/webp,application/pdf',
        ocrPrompt:`OCR this health insurance card or policy. Extract:
1. Policy / member number
2. Expiry / valid-until date (YYYY-MM-DD)
Reply ONLY as valid JSON, no markdown:
{"policyNo":"...","expiryDate":"YYYY-MM-DD"}
Use null for missing fields.` },
      { key:'certificates_img_url', label:'🎓 Trade Certificates', accept:'image/jpeg,image/png,application/pdf', ocrPrompt:null },
    ];

    // Self-contained upload + AI-scan + apply card, reused for every supplier / supplier-employee
    // document. Same UX as the Hiring Pipeline "Documents" tab: upload, AI reads it, review the
    // detected fields, click Apply to copy them into the form.
    function AiDocCard({ docType, value, ownerId, folder, onSaved, onApply }) {
      const [state, setState] = useState({ preview:null, scanning:false, ocr:null, applied:false });

      const handleFile = (file) => {
        if (!file) return;
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          const storedUrl = await uploadCertImage(ownerId || 'new', docType.key, file, folder);
          const finalUrl = storedUrl || dataUrl;
          setState(s => ({ ...s, preview: dataUrl, scanning: !!docType.ocrPrompt, ocr: null, applied: false }));
          onSaved(finalUrl);
          if (!docType.ocrPrompt) return;
          try {
            const base64 = dataUrl.split(',')[1];
            const contentParts = isPdf
              ? [{ type:'document', source:{ type:'base64', media_type:'application/pdf', data:base64 } }, { type:'text', text: docType.ocrPrompt }]
              : [{ type:'image', source:{ type:'base64', media_type: isImage?file.type:'image/jpeg', data:base64 } }, { type:'text', text: docType.ocrPrompt }];
            const res = await fetch('/api/claude', {
              method:'POST', headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:800, messages:[{ role:'user', content: contentParts }] })
            });
            if (!res.ok) { const t = await res.text(); throw new Error(`API error ${res.status}: ${t.slice(0,120)}`); }
            const json = await res.json();
            const raw = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
            let ocr = {};
            try { ocr = parseClaudeJson(raw); } catch(e) { ocr = { error: 'Parse failed: ' + e.message }; }
            setState(s => ({ ...s, scanning:false, ocr }));
          } catch(e) {
            setState(s => ({ ...s, scanning:false, ocr:{ error:e.message } }));
          }
        };
        reader.readAsDataURL(file);
      };

      const apply = () => {
        if (!state.ocr || state.ocr.error) return;
        onApply(state.ocr);
        setState(s => ({ ...s, applied:true }));
        setTimeout(() => setState(s => ({ ...s, applied:false })), 3000);
      };

      const hasDoc = !!(state.preview || value);
      const previewSrc = state.preview || value;
      const isImg = !!previewSrc && (previewSrc.startsWith('data:image') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(previewSrc));

      return (
        <div style={{ border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden', background:'#fff' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background: hasDoc?'#f0fdf4':'#f8fafc', borderBottom: hasDoc?'1px solid #86efac':'1px solid #e2e8f0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'14px' }}>{hasDoc?'✅':''}</span>
              <span style={{ fontWeight:700, fontSize:'13px', color:'#0f172a' }}><EmojiLabel text={docType.label} size={14} gap={6} /></span>
              {docType.ocrPrompt && <span style={{ fontSize:'10.5px', background:'#dbeafe', color:'#1d4ed8', padding:'1px 7px', borderRadius:'8px', fontWeight:600 }}><EmojiIcon e="🤖" /> AI scan</span>}
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              {hasDoc && value && !value.startsWith('data:') && (
                <a href={value} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11.5px', color:'#2563eb', fontWeight:600 }}><EmojiIcon e="📎" /> View</a>
              )}
              {hasDoc && (
                <button type="button" onClick={()=>{ onSaved(''); setState({ preview:null, scanning:false, ocr:null, applied:false }); }} style={{ background:'none', border:'none', color:'#dc2626', fontSize:'11.5px', fontWeight:700, cursor:'pointer' }}>Remove</button>
              )}
              <label style={{ background:'#2563eb', color:'#fff', padding:'5px 12px', borderRadius:'6px', fontSize:'11.5px', fontWeight:600, cursor:'pointer' }}>
                <EmojiLabel text={hasDoc?'↺ Replace':'⬆ Upload'} />
                <input type="file" accept={docType.accept} style={{ display:'none' }} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])} />
              </label>
            </div>
          </div>
          {hasDoc && (
            <div style={{ padding:'14px 16px', display:'flex', gap:'16px', flexWrap:'wrap' }}>
              <div style={{ flexShrink:0 }}>
                {isImg ? (
                  <img src={previewSrc} alt="doc" style={{ width:'110px', height:'74px', objectFit:'cover', borderRadius:'8px', border:'2px solid #2563eb' }} />
                ) : (
                  <div style={{ width:'110px', height:'74px', background:'#eff6ff', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #2563eb' }}>
                    <span style={{ fontSize:'26px' }}><EmojiIcon e="📄" /></span>
                  </div>
                )}
              </div>
              <div style={{ flex:1, minWidth:'200px' }}>
                {state.scanning && (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'#2563eb', fontSize:'12.5px', fontWeight:600 }}>
                    <div style={{ width:'14px', height:'14px', border:'2px solid #93c5fd', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}></div>
                    <EmojiIcon e="🤖" /> AI is reading the document…
                  </div>
                )}
                {!state.scanning && state.ocr && !state.ocr.error && (
                  <div>
                    <div style={{ fontSize:'11.5px', fontWeight:700, color:'#059669', marginBottom:'8px' }}><EmojiIcon e="✅" /> AI detected the following:</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'4px 12px', marginBottom:'10px' }}>
                      {Object.entries(state.ocr).filter(([k,v])=>v&&k!=='error').map(([k,v])=>(
                        <div key={k} style={{ fontSize:'11px' }}>
                          <span style={{ color:'#64748b', textTransform:'capitalize' }}>{k.replace(/([A-Z])/g,' $1').toLowerCase()}: </span>
                          <span style={{ fontWeight:600, color:'#0f172a' }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={apply} style={{ background: state.applied?'#059669':'#2563eb', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'6px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>
                      {state.applied ? '✓ Applied to form!' : '⬇ Apply to Form'}
                    </button>
                  </div>
                )}
                {!state.scanning && state.ocr && state.ocr.error && (
                  <div style={{ fontSize:'11.5px', color:'#dc2626' }}><EmojiIcon e="⚠" /> Could not read document: {state.ocr.error}</div>
                )}
                {!state.scanning && !state.ocr && !docType.ocrPrompt && (
                  <div style={{ fontSize:'12px', color:'#64748b' }}>Document uploaded successfully.</div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Suppliers directory: modal ──
    function SupplierModal({ record, suppliers, onSave, onClose, showToast }) {
      const [data, setData] = useState(record);
      const [saving, setSaving] = useState(false);
      const set = (k,v) => setData(d => ({ ...d, [k]:v }));
      const isNew = !record.id;
      const displayId = data.supplier_id || (isNew ? nextSupplierId(suppliers) : '');
      const licenseExpiryDays = daysUntil(data.trade_license_expiry);

      const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try { await onSave({ ...data, supplier_id: data.supplier_id || displayId }); }
        catch (e) { showToast('❌ Save failed: ' + (e && e.message ? e.message : 'unknown error'), 'error'); }
        finally { setSaving(false); }
      };

      return (
        <div style={S.overlay} onClick={onClose}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 22px', borderBottom:'1px solid var(--bd1)' }}>
              <div>
                <h2 style={{ margin:0, fontSize:'17px' }}>{isNew ? 'Add Supplier' : `Edit: ${data.supplier_name||data.supplier_id}`}</h2>
                <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'3px' }}>Supplier ID: <strong style={{ color:'#1d4ed8' }}>{displayId}</strong>{isNew ? ' (auto-assigned)' : ''}</div>
              </div>
              <button onClick={onClose} style={S.iconBtn}>×</button>
            </div>
            <div style={{ padding:'20px 22px', overflowY:'auto', flex:1 }}>

              <div style={{ fontSize:'11px', fontWeight:700, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #dbeafe' }}>Company Details</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px', marginBottom:'20px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={S.label}>Supplier / Agency Name <span style={{color:'#dc2626'}}>*</span></label>
                  <input value={data.supplier_name||''} onChange={e=>set('supplier_name',e.target.value)} placeholder="e.g. Al Faris Manpower LLC" style={{ ...S.input, width:'100%' }} />
                </div>
                <div>
                  <label style={S.label}>Trade / Discipline Supplied</label>
                  <input value={data.trade_type||''} onChange={e=>set('trade_type',e.target.value)} placeholder="e.g. Piping, Scaffolding, Electrical" style={{ ...S.input, width:'100%' }} />
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select value={data.status||'Active'} onChange={e=>set('status',e.target.value)} style={{ ...S.input, width:'100%' }}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Blacklisted">Blacklisted</option>
                  </select>
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={S.label}>Address</label>
                  <input value={data.address||''} onChange={e=>set('address',e.target.value)} placeholder="Office address / emirate" style={{ ...S.input, width:'100%' }} />
                </div>
              </div>

              <div style={{ fontSize:'11px', fontWeight:700, color:'#059669', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #d1fae5' }}>Contact Person</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px', marginBottom:'20px' }}>
                <div><label style={S.label}>Whom to Contact</label><input value={data.contact_person||''} onChange={e=>set('contact_person',e.target.value)} placeholder="Account manager name" style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Designation</label><input value={data.contact_designation||''} onChange={e=>set('contact_designation',e.target.value)} placeholder="e.g. Operations Manager" style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Mobile</label><input value={data.mobile||''} onChange={e=>set('mobile',e.target.value)} placeholder="+971 50 000 0000" style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>WhatsApp</label><input value={data.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)} placeholder="+971 50 000 0000" style={{ ...S.input, width:'100%' }} /></div>
                <div style={{ gridColumn:'span 2' }}><label style={S.label}>Email</label><input type="email" value={data.email||''} onChange={e=>set('email',e.target.value)} placeholder="contact@agency.com" style={{ ...S.input, width:'100%' }} /></div>
              </div>

              <div style={{ fontSize:'11px', fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #ede9fe' }}>Compliance Documents — AI Auto-Scan</div>
              <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px', padding:'10px 12px', fontSize:'11.5px', color:'#1e40af', marginBottom:'12px' }}><EmojiIcon e="🤖" /> Upload the trade license or VAT certificate — Claude reads the number and expiry date automatically.</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
                <AiDocCard docType={SUPPLIER_DOC_TYPES[0]} value={data.trade_license_img_url} ownerId={displayId} folder="supplier-docs"
                  onSaved={(url)=>set('trade_license_img_url', url)}
                  onApply={(ocr)=>{ if(ocr.licenseNo) set('trade_license_no', ocr.licenseNo); if(ocr.expiryDate) set('trade_license_expiry', ocr.expiryDate); if(ocr.companyName && !data.supplier_name) set('supplier_name', ocr.companyName); if(ocr.activities && ocr.activities.length) set('licensed_activities', ocr.activities.join('\n')); }} />
                <AiDocCard docType={SUPPLIER_DOC_TYPES[1]} value={data.vat_cert_img_url} ownerId={displayId} folder="supplier-docs"
                  onSaved={(url)=>set('vat_cert_img_url', url)}
                  onApply={(ocr)=>{ if(ocr.trn) set('vat_trn_no', ocr.trn); }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px', marginBottom:'8px' }}>
                <div><label style={S.label}>Trade License No</label><input value={data.trade_license_no||''} onChange={e=>set('trade_license_no',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div>
                  <label style={S.label}>Trade License Expiry</label>
                  <input type="date" value={data.trade_license_expiry||''} onChange={e=>set('trade_license_expiry',e.target.value)} style={{ ...S.input, width:'100%', borderColor: licenseExpiryDays !== null && licenseExpiryDays <= 30 ? (licenseExpiryDays < 0 ? '#dc2626' : '#f59e0b') : undefined }} />
                </div>
                <div><label style={S.label}>VAT / TRN No</label><input value={data.vat_trn_no||''} onChange={e=>set('vat_trn_no',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
              </div>
              {licenseExpiryDays !== null && licenseExpiryDays <= 30 && (
                <div style={{ background: licenseExpiryDays < 0 ? '#fef2f2' : '#fffbeb', border: `1px solid ${licenseExpiryDays < 0 ? '#fca5a5' : '#fcd34d'}`, borderRadius:'8px', padding:'8px 12px', fontSize:'12px', color: licenseExpiryDays < 0 ? '#991b1b' : '#92400e', marginBottom:'16px', fontWeight:600 }}>
                  {licenseExpiryDays < 0 ? `⚠ Trade license expired ${Math.abs(licenseExpiryDays)} day(s) ago` : `⚠ Trade license expires in ${licenseExpiryDays} day(s)`} — renew before engaging this supplier further.
                </div>
              )}
              <div style={{ marginBottom:'20px' }}>
                <label style={S.label}>Licensed Activities</label>
                <textarea rows={8} value={data.licensed_activities||''} onChange={e=>set('licensed_activities',e.target.value)} placeholder="Business activities this supplier is licensed for, e.g. General Contracting, Manpower Supply, Building Maintenance… (auto-filled by AI scan above, one per line)" style={{ ...S.input, width:'100%', minHeight:'200px', resize:'vertical' }} />
                <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>Only assign work that falls within these licensed activities.</div>
              </div>

              <div style={{ fontSize:'11px', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #e2e8f0' }}>Notes</div>
              <textarea value={data.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Commercial terms, PO references, remarks…" style={{ ...S.input, width:'100%', minHeight:'70px', resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', padding:'14px 22px', borderTop:'1px solid var(--bd1)' }}>
              <button onClick={onClose} style={S.btnSec}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btnPri, opacity: saving?0.6:1 }}>{saving?'Saving…':'💾 Save Supplier'}</button>
            </div>
          </div>
        </div>
      );
    }

    // ── Supplier employees: modal ──
    function SupplierEmployeeModal({ record, suppliers, supplierEmployees, onSave, onClose, showToast }) {
      const [data, setData] = useState(record);
      const [saving, setSaving] = useState(false);
      const set = (k,v) => setData(d => ({ ...d, [k]:v }));
      const isNew = !record.id;
      const displayId = data.supplier_employee_id || (isNew && data.supplier_id ? nextSupplierEmployeeId(supplierEmployees, data.supplier_id) : (isNew ? '— select supplier first —' : ''));

      const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
          const finalId = data.supplier_employee_id || (data.supplier_id ? nextSupplierEmployeeId(supplierEmployees, data.supplier_id) : null);
          await onSave({ ...data, supplier_employee_id: finalId });
        }
        catch (e) { showToast('❌ Save failed: ' + (e && e.message ? e.message : 'unknown error'), 'error'); }
        finally { setSaving(false); }
      };

      return (
        <div style={S.overlay} onClick={onClose}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 22px', borderBottom:'1px solid var(--bd1)' }}>
              <div>
                <h2 style={{ margin:0, fontSize:'17px' }}>{isNew ? 'Add Supplier Employee' : `Edit: ${data.full_name||data.supplier_employee_id}`}</h2>
                <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'3px' }}>Employee ID: <strong style={{ color:'#1d4ed8' }}>{displayId}</strong>{isNew && data.supplier_id ? ' (auto-assigned)' : ''}</div>
              </div>
              <button onClick={onClose} style={S.iconBtn}>×</button>
            </div>
            <div style={{ padding:'20px 22px', overflowY:'auto', flex:1 }}>

              <div style={{ fontSize:'11px', fontWeight:700, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #dbeafe' }}>Employment</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px', marginBottom:'20px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={S.label}>Hired From Supplier <span style={{color:'#dc2626'}}>*</span></label>
                  <select value={data.supplier_id||''} onChange={e=>set('supplier_id',e.target.value)} style={{ ...S.input, width:'100%', background: data.supplier_id ? '#f0fdf4' : '#fff', borderColor: data.supplier_id ? '#86efac' : '#cbd5e1' }}>
                    <option value="">-- Select a supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.supplier_id}>{s.supplier_id} — {s.supplier_name}</option>)}
                  </select>
                  {suppliers.length===0 && <div style={{ fontSize:'11px', color:'#dc2626', marginTop:'4px' }}>No suppliers registered yet — add one in the Suppliers tab first.</div>}
                </div>
                <div style={{ gridColumn:'span 2' }}><label style={S.label}>Full Name <span style={{color:'#dc2626'}}>*</span></label><input value={data.full_name||''} onChange={e=>set('full_name',e.target.value)} placeholder="As per passport" style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Position</label><input value={data.position||''} onChange={e=>set('position',e.target.value)} placeholder="e.g. Pipe Fitter" style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Nationality</label><input value={data.nationality||''} onChange={e=>set('nationality',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Mobile</label><input value={data.mobile||''} onChange={e=>set('mobile',e.target.value)} placeholder="+971 50 000 0000" style={{ ...S.input, width:'100%' }} /></div>
                <div>
                  <label style={S.label}>Status</label>
                  <select value={data.status||'Active'} onChange={e=>set('status',e.target.value)} style={{ ...S.input, width:'100%' }}>
                    <option value="Active">Active</option>
                    <option value="Demobilized">Demobilized</option>
                  </select>
                </div>
                <div><label style={S.label}>Joined Date</label><input type="date" value={data.joined_date||''} onChange={e=>set('joined_date',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Current Location</label><input value={data.current_location||''} onChange={e=>set('current_location',e.target.value)} placeholder="e.g. ADNOC Ruwais" style={{ ...S.input, width:'100%' }} /></div>
              </div>

              <div style={{ fontSize:'11px', fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #ede9fe' }}>Documents — AI Auto-Scan</div>
              <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px', padding:'10px 12px', fontSize:'11.5px', color:'#1e40af', marginBottom:'12px' }}><EmojiIcon e="🤖" /> Upload passport, Emirates ID or insurance — Claude reads the number and expiry date automatically.</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
                <AiDocCard docType={SUPPLIER_EMP_DOC_TYPES[0]} value={data.passport_img_url} ownerId={displayId} folder="supplier-employee-docs"
                  onSaved={(url)=>set('passport_img_url', url)}
                  onApply={(ocr)=>{ if(ocr.fullName && !data.full_name) set('full_name', ocr.fullName); if(ocr.passportNo) set('passport_no', ocr.passportNo); if(ocr.nationality) set('nationality', ocr.nationality); if(ocr.expiryDate) set('passport_expiry', ocr.expiryDate); }} />
                <AiDocCard docType={SUPPLIER_EMP_DOC_TYPES[1]} value={data.eid_img_url} ownerId={displayId} folder="supplier-employee-docs"
                  onSaved={(url)=>set('eid_img_url', url)}
                  onApply={(ocr)=>{ if(ocr.eidNo) set('eid_no', ocr.eidNo); if(ocr.expiryDate) set('eid_expiry', ocr.expiryDate); }} />
                <AiDocCard docType={SUPPLIER_EMP_DOC_TYPES[2]} value={data.insurance_img_url} ownerId={displayId} folder="supplier-employee-docs"
                  onSaved={(url)=>set('insurance_img_url', url)}
                  onApply={(ocr)=>{ if(ocr.policyNo) set('insurance_no', ocr.policyNo); if(ocr.expiryDate) set('insurance_expiry', ocr.expiryDate); }} />
                <AiDocCard docType={SUPPLIER_EMP_DOC_TYPES[3]} value={data.certificates_img_url} ownerId={displayId} folder="supplier-employee-docs"
                  onSaved={(url)=>set('certificates_img_url', url)}
                  onApply={()=>{}} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px', marginBottom:'20px' }}>
                <div><label style={S.label}>Passport No</label><input value={data.passport_no||''} onChange={e=>set('passport_no',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Passport Expiry</label><input type="date" value={data.passport_expiry||''} onChange={e=>set('passport_expiry',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Emirates ID No</label><input value={data.eid_no||''} onChange={e=>set('eid_no',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Emirates ID Expiry</label><input type="date" value={data.eid_expiry||''} onChange={e=>set('eid_expiry',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Insurance Policy No</label><input value={data.insurance_no||''} onChange={e=>set('insurance_no',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Insurance Expiry</label><input type="date" value={data.insurance_expiry||''} onChange={e=>set('insurance_expiry',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div style={{ gridColumn:'span 2' }}><label style={S.label}>Certificates / Notes</label><textarea value={data.certificates||''} onChange={e=>set('certificates',e.target.value)} placeholder="e.g. H2S Awareness (valid to Dec 2026), First Aid, Working at Height…" style={{ ...S.input, width:'100%', minHeight:'60px', resize:'vertical' }} /></div>
              </div>

              <div style={{ fontSize:'11px', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #e2e8f0' }}>Notes</div>
              <textarea value={data.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Any other remarks…" style={{ ...S.input, width:'100%', minHeight:'60px', resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', padding:'14px 22px', borderTop:'1px solid var(--bd1)' }}>
              <button onClick={onClose} style={S.btnSec}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btnPri, opacity: saving?0.6:1 }}>{saving?'Saving…':'💾 Save Employee'}</button>
            </div>
          </div>
        </div>
      );
    }

    // ── Suppliers directory: list ──
    function SuppliersListView({ suppliers, supplierEmployees, onAdd, onEdit, onDelete }) {
      const [search, setSearch] = useState('');
      const [statusFilter, setStatusFilter] = useState('all');
      const [showLicenseAlert, setShowLicenseAlert] = useState(true);
      const [showDocAlert, setShowDocAlert] = useState(true);

      const empCountFor = (supplierId) => supplierEmployees.filter(e => e.supplier_id === supplierId).length;

      const kpis = useMemo(() => ({
        total: suppliers.length,
        active: suppliers.filter(s => (s.status||'Active') === 'Active').length,
        licenseExpiring: suppliers.filter(s => { const d = daysUntil(s.trade_license_expiry); return d !== null && d <= 30; }).length,
        missingDocs: suppliers.filter(s => !s.trade_license_img_url || !s.vat_cert_img_url).length,
      }), [suppliers]);

      // Suppliers whose trade license needs attention now — expired or expiring within 30
      // days — sorted soonest-first so the most urgent renewal is at the top.
      const licenseAlerts = useMemo(() => {
        return suppliers
          .filter(s => (s.status||'Active') !== 'Blacklisted')
          .map(s => ({ s, days: daysUntil(s.trade_license_expiry) }))
          .filter(x => x.days !== null && x.days <= 30)
          .sort((a,b) => a.days - b.days);
      }, [suppliers]);

      // Suppliers still missing their trade license or VAT certificate upload —
      // tracked against a 7-day grace period starting from when the record was created.
      const docAlerts = useMemo(() => {
        return suppliers
          .filter(s => (s.status||'Active') !== 'Blacklisted')
          .filter(s => !s.trade_license_img_url || !s.vat_cert_img_url)
          .map(s => {
            const createdMs = s.created_at ? new Date(s.created_at).getTime() : Date.now();
            const daysSince = Math.floor((Date.now() - createdMs) / 86400000);
            return { s, daysLeft: 7 - daysSince };
          })
          .sort((a,b) => a.daysLeft - b.daysLeft);
      }, [suppliers]);

      const filtered = useMemo(() => {
        let r = suppliers;
        if (statusFilter !== 'all') r = r.filter(s => (s.status||'Active') === statusFilter);
        if (search) {
          const needle = search.toLowerCase();
          const keys = ['supplier_id','supplier_name','contact_person','mobile','email','trade_license_no','vat_trn_no','trade_type'];
          r = r.filter(s => keys.some(k => String(s[k]||'').toLowerCase().includes(needle)));
        }
        return r;
      }, [suppliers, search, statusFilter]);

      return (
        <div>
          <div className="rdb-kpi-grid" style={{ marginBottom:'16px' }}>
            <div className="rdb-kpi-card"><div className="rdb-kpi-label">Total Suppliers</div><div className="rdb-kpi-value">{kpis.total}</div><div className="rdb-kpi-note">Registered agencies</div></div>
            <div className="rdb-kpi-card"><div className="rdb-kpi-label">Active</div><div className="rdb-kpi-value">{kpis.active}</div><div className="rdb-kpi-note">Currently engaged</div></div>
            <div className="rdb-kpi-card"><div className="rdb-kpi-label">License Expiring</div><div className="rdb-kpi-value">{kpis.licenseExpiring}</div><div className="rdb-kpi-note">≤30 days</div></div>
            <div className="rdb-kpi-card"><div className="rdb-kpi-label">Missing Docs</div><div className="rdb-kpi-value">{kpis.missingDocs}</div><div className="rdb-kpi-note">License or VAT not uploaded</div></div>
          </div>

          {licenseAlerts.length > 0 && showLicenseAlert && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'12px 16px', marginBottom:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', marginBottom:'8px' }}>
                <div style={{ fontSize:'12.5px', fontWeight:700, color:'#991b1b' }}><EmojiIcon e="⚠️" /> {licenseAlerts.length} trade license{licenseAlerts.length!==1?'s':''} expired or expiring within 30 days</div>
                <button type="button" onClick={()=>setShowLicenseAlert(false)} style={{ background:'none', border:'none', color:'#991b1b', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>Dismiss</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                {licenseAlerts.map(({s, days}) => (
                  <div key={s.id} onClick={()=>onEdit(s)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', fontSize:'12px', background:'#fff', border:'1px solid #fecaca', borderRadius:'6px', padding:'6px 10px', cursor:'pointer' }}>
                    <span><strong style={{ color:'#1d4ed8' }}>{s.supplier_id}</strong> — {s.supplier_name}</span>
                    <span style={{ fontWeight:700, color: days < 0 ? '#dc2626' : days <= 7 ? '#ea580c' : '#ca8a04' }}>
                      {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `Expires in ${days}d`} · {fmtDateDisplay(s.trade_license_expiry)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {docAlerts.length > 0 && showDocAlert && (
            <div style={{ background:'#fffbeb', border:'1px solid #f59e0b', borderRadius:'10px', padding:'12px 16px', marginBottom:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', marginBottom:'8px' }}>
                <div style={{ fontSize:'12.5px', fontWeight:700, color:'#92400e' }}><EmojiIcon e="📄" /> {docAlerts.length} supplier{docAlerts.length!==1?'s':''} missing trade license / VAT certificate upload</div>
                <button type="button" onClick={()=>setShowDocAlert(false)} style={{ background:'none', border:'none', color:'#92400e', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>Dismiss</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                {docAlerts.map(({s, daysLeft}) => (
                  <div key={s.id} onClick={()=>onEdit(s)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', fontSize:'12px', background:'#fff', border:'1px solid #fde68a', borderRadius:'6px', padding:'6px 10px', cursor:'pointer' }}>
                    <span><strong style={{ color:'#1d4ed8' }}>{s.supplier_id}</strong> — {s.supplier_name} <span style={{ color:'#94a3b8' }}>({!s.trade_license_img_url && !s.vat_cert_img_url ? 'both docs missing' : !s.trade_license_img_url ? 'trade license missing' : 'VAT certificate missing'})</span></span>
                    <span style={{ fontWeight:700, color: daysLeft < 0 ? '#dc2626' : daysLeft <= 2 ? '#ea580c' : '#ca8a04' }}>
                      {daysLeft < 0 ? `Overdue ${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left to upload`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search supplier, contact, license, TRN…" style={{ ...S.input, flex:1, minWidth:'240px', maxWidth:'380px' }} />
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={S.input}>
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Blacklisted">Blacklisted</option>
            </select>
            <button className="hr-btn" style={S.btnPri} onClick={onAdd}>+ Add Supplier</button>
          </div>

          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
            <div className="xl-wrap hr-scroll">
              <table className="xl-table" style={{ width:'100%', fontSize:'12px', minWidth:'1020px' }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  <th style={S.th}>Supplier ID</th>
                  <th style={S.th}>Name</th>
                  <th style={S.th}>Contact Person</th>
                  <th style={S.th}>Mobile</th>
                  <th style={S.th}>Trade License</th>
                  <th style={S.th}>Licensed Activities</th>
                  <th style={S.th}>VAT / TRN</th>
                  <th style={S.th}>Employees</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {filtered.length===0 ? <tr><td colSpan={10} style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>No suppliers found</td></tr> :
                    filtered.map(s => {
                      const licenseDays = daysUntil(s.trade_license_expiry);
                      const licenseWarn = licenseDays !== null && licenseDays <= 30;
                      return (
                        <tr key={s.id} className="hr-row" onClick={()=>onEdit(s)} title="Click to edit" style={{ borderTop:'1px solid var(--bd3)', cursor:'pointer' }}>
                          <td style={{ ...S.td, fontWeight:700, color:'#1d4ed8' }}>{s.supplier_id}</td>
                          <td style={{ ...S.td, fontWeight:600 }}>{s.supplier_name}</td>
                          <td style={S.td}>{s.contact_person||'—'}</td>
                          <td style={S.td}>{s.mobile||'—'}</td>
                          <td style={S.td}>
                            {s.trade_license_no ? (
                              <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                                <span>{s.trade_license_no}</span>
                                {s.trade_license_expiry && <span style={{ fontSize:'10.5px', color: licenseWarn ? '#dc2626' : '#64748b' }}>{licenseWarn ? '⚠ ' : ''}{fmtDateDisplay(s.trade_license_expiry)}</span>}
                              </div>
                            ) : <span style={{ color:'#cbd5e1' }}>—</span>}
                          </td>
                          <td style={{ ...S.td, maxWidth:'180px' }} title={s.licensed_activities||''}>
                            {s.licensed_activities ? (
                              <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.licensed_activities.split('\n').filter(Boolean).join(', ')}</span>
                            ) : <span style={{ color:'#cbd5e1' }}>—</span>}
                          </td>
                          <td style={S.td}>{s.vat_trn_no || <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                          <td style={{ ...S.td, textAlign:'center' }}>
                            <span style={{ background:'#eff6ff', color:'#1d4ed8', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>{empCountFor(s.supplier_id)}</span>
                          </td>
                          <td style={S.td}>
                            <span style={{ background: s.status==='Blacklisted'?'#fee2e2':s.status==='Inactive'?'#f1f5f9':'#d1fae5', color: s.status==='Blacklisted'?'#991b1b':s.status==='Inactive'?'#64748b':'#065f46', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:600 }}>{s.status||'Active'}</span>
                          </td>
                          <td style={{ ...S.td, textAlign:'right', whiteSpace:'nowrap' }} onClick={ev=>ev.stopPropagation()}>
                            <button onClick={()=>onEdit(s)} style={S.iconBtn}><EmojiIcon e="✏️" /></button>
                            <button onClick={(ev)=>{ev.stopPropagation();onDelete(s.id);}} style={S.iconBtn}><EmojiIcon e="🗑️" /></button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b' }}>Showing {filtered.length} of {suppliers.length} supplier{suppliers.length!==1?'s':''}</div>
        </div>
      );
    }

    // ── Supplier employees: list ──
    function SupplierEmployeesListView({ supplierEmployees, suppliers, onAdd, onEdit, onDelete }) {
      const [search, setSearch] = useState('');
      const [supplierFilter, setSupplierFilter] = useState('all');
      const [statusFilter, setStatusFilter] = useState('all');

      const supplierName = (supplierId) => {
        const s = suppliers.find(x=>x.supplier_id===supplierId);
        return (s && s.supplier_name) || supplierId || '—';
      };

      const kpis = useMemo(() => {
        const expSoon = (col) => supplierEmployees.filter(e => { const d = daysUntil(e[col]); return d !== null && d <= 30; }).length;
        return {
          total: supplierEmployees.length,
          active: supplierEmployees.filter(e => (e.status||'Active')==='Active').length,
          passportExp: expSoon('passport_expiry'),
          otherExp: expSoon('eid_expiry') + expSoon('insurance_expiry'),
        };
      }, [supplierEmployees]);

      const filtered = useMemo(() => {
        let r = supplierEmployees;
        if (supplierFilter !== 'all') r = r.filter(e => e.supplier_id === supplierFilter);
        if (statusFilter !== 'all') r = r.filter(e => (e.status||'Active') === statusFilter);
        if (search) {
          const needle = search.toLowerCase();
          const keys = ['supplier_employee_id','full_name','position','passport_no','eid_no','current_location','nationality'];
          r = r.filter(e => keys.some(k => String(e[k]||'').toLowerCase().includes(needle)) || supplierName(e.supplier_id).toLowerCase().includes(needle));
        }
        return r;
      }, [supplierEmployees, search, supplierFilter, statusFilter, suppliers]);

      return (
        <div>
          <div className="rdb-kpi-grid" style={{ marginBottom:'16px' }}>
            <div className="rdb-kpi-card"><div className="rdb-kpi-label">Total</div><div className="rdb-kpi-value">{kpis.total}</div><div className="rdb-kpi-note">All supplier employees</div></div>
            <div className="rdb-kpi-card"><div className="rdb-kpi-label">Active</div><div className="rdb-kpi-value">{kpis.active}</div><div className="rdb-kpi-note">Currently deployed</div></div>
            <div className="rdb-kpi-card"><div className="rdb-kpi-label">Passport Expiring</div><div className="rdb-kpi-value">{kpis.passportExp}</div><div className="rdb-kpi-note">≤30 days</div></div>
            <div className="rdb-kpi-card"><div className="rdb-kpi-label">EID / Insurance Expiring</div><div className="rdb-kpi-value">{kpis.otherExp}</div><div className="rdb-kpi-note">≤30 days combined</div></div>
          </div>

          <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name, ID, passport, EID, site…" style={{ ...S.input, flex:1, minWidth:'240px', maxWidth:'380px' }} />
            <select value={supplierFilter} onChange={e=>setSupplierFilter(e.target.value)} style={S.input}>
              <option value="all">All suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.supplier_id}>{s.supplier_id} — {s.supplier_name}</option>)}
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={S.input}>
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Demobilized">Demobilized</option>
            </select>
            <button className="hr-btn" style={S.btnPri} onClick={onAdd} disabled={suppliers.length===0} title={suppliers.length===0?'Add a supplier first':''}>+ Add Employee</button>
          </div>
          {suppliers.length===0 && <div style={{ fontSize:'12px', color:'#b45309', marginBottom:'12px' }}><EmojiIcon e="⚠" /> Add at least one supplier in the Suppliers tab before adding supplier employees.</div>}

          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
            <div className="xl-wrap hr-scroll">
              <table className="xl-table" style={{ width:'100%', fontSize:'12px', minWidth:'980px' }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  <th style={S.th}>Employee ID</th>
                  <th style={S.th}>Name</th>
                  <th style={S.th}>Position</th>
                  <th style={S.th}>Supplier</th>
                  <th style={S.th}>Passport</th>
                  <th style={S.th}>Emirates ID</th>
                  <th style={S.th}>Joined</th>
                  <th style={S.th}>Current Location</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {filtered.length===0 ? <tr><td colSpan={10} style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>No supplier employees found</td></tr> :
                    filtered.map(e => {
                      const passDays = daysUntil(e.passport_expiry);
                      const eidDays = daysUntil(e.eid_expiry);
                      return (
                        <tr key={e.id} className="hr-row" onClick={()=>onEdit(e)} title="Click to edit" style={{ borderTop:'1px solid var(--bd3)', cursor:'pointer' }}>
                          <td style={{ ...S.td, fontWeight:700, color:'#1d4ed8' }}>{e.supplier_employee_id}</td>
                          <td style={{ ...S.td, fontWeight:600 }}>{e.full_name}</td>
                          <td style={S.td}>{e.position||'—'}</td>
                          <td style={S.td}><span style={{ background:'#ede9fe', color:'#7c3aed', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:600 }}>{supplierName(e.supplier_id)}</span></td>
                          <td style={S.td}>{e.passport_no ? <span style={{ color: passDays!==null && passDays<=30 ? '#dc2626':'inherit' }}>{e.passport_no}</span> : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                          <td style={S.td}>{e.eid_no ? <span style={{ color: eidDays!==null && eidDays<=30 ? '#dc2626':'inherit' }}>{e.eid_no}</span> : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                          <td style={S.td}>{e.joined_date ? fmtDateDisplay(e.joined_date) : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                          <td style={S.td}>{e.current_location||'—'}</td>
                          <td style={S.td}><span style={{ background: e.status==='Demobilized'?'#f1f5f9':'#d1fae5', color: e.status==='Demobilized'?'#64748b':'#065f46', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:600 }}>{e.status||'Active'}</span></td>
                          <td style={{ ...S.td, textAlign:'right', whiteSpace:'nowrap' }} onClick={ev=>ev.stopPropagation()}>
                            <button onClick={()=>onEdit(e)} style={S.iconBtn}><EmojiIcon e="✏️" /></button>
                            <button onClick={(ev)=>{ev.stopPropagation();onDelete(e.id);}} style={S.iconBtn}><EmojiIcon e="🗑️" /></button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b' }}>Showing {filtered.length} of {supplierEmployees.length} employee{supplierEmployees.length!==1?'s':''}</div>
        </div>
      );
    }

    // ── Top-level Supplier Manpower page: 2 sub-tabs + self-contained data + CRUD ──
    function SupplierManpowerView({ user, showToast }) {
      const [pivot, setPivot] = useState('suppliers');
      const [suppliers, setSuppliers] = useState([]);
      const [supplierEmployees, setSupplierEmployees] = useState([]);
      const [allEmployeeIdRows, setAllEmployeeIdRows] = useState([]); // includes soft-deleted rows, so an already-issued ID is never reused
      const [loading, setLoading] = useState(true);
      const [setupNeeded, setSetupNeeded] = useState(false);
      const [showSetupPanel, setShowSetupPanel] = useState(false);
      const [editingSupplier, setEditingSupplier] = useState(null);
      const [editingSupplierEmployee, setEditingSupplierEmployee] = useState(null);
      const [sqlCopied, setSqlCopied] = useState(false);
      const copySetupSql = () => {
        const done = () => { setSqlCopied(true); setTimeout(()=>setSqlCopied(false), 3000); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(SUPPLIER_MANPOWER_SETUP_SQL).then(done).catch(()=>{
            // Clipboard API blocked (e.g. non-HTTPS/older browser) — fall back to a hidden textarea
            const ta = document.createElement('textarea');
            ta.value = SUPPLIER_MANPOWER_SETUP_SQL; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch(e) {}
            document.body.removeChild(ta);
          });
        } else {
          const ta = document.createElement('textarea');
          ta.value = SUPPLIER_MANPOWER_SETUP_SQL; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch(e) {}
          document.body.removeChild(ta);
        }
      };

      const load = async () => {
        setLoading(true);
        try {
          const [sRes, eRes, allIdsRes] = await Promise.all([
            db.from('suppliers').select('*').is('deleted_at', null).order('supplier_id'),
            db.from('supplier_employees').select('*').is('deleted_at', null).order('supplier_employee_id'),
            db.from('supplier_employees').select('supplier_id, supplier_employee_id'), // no deleted_at filter — includes soft-deleted rows so their IDs are never reissued
          ]);
          if (sRes.error) throw sRes.error;
          if (eRes.error) throw eRes.error;
          setSuppliers(sRes.data || []);
          setSupplierEmployees(eRes.data || []);
          setAllEmployeeIdRows((allIdsRes && !allIdsRes.error && allIdsRes.data) || eRes.data || []);
          setSetupNeeded(false);
        } catch (e) {
          setSetupNeeded(true);
          setSuppliers([]); setSupplierEmployees([]); setAllEmployeeIdRows([]);
        }
        setLoading(false);
      };
      useEffect(() => { load(); }, []);

      const saveSupplier = async (rec) => {
        const clean = {
          supplier_id: rec.supplier_id || nextSupplierId(suppliers),
          supplier_name: rec.supplier_name || null,
          contact_person: rec.contact_person || null,
          contact_designation: rec.contact_designation || null,
          mobile: rec.mobile || null,
          whatsapp: rec.whatsapp || null,
          email: rec.email || null,
          address: rec.address || null,
          trade_type: rec.trade_type || null,
          trade_license_no: rec.trade_license_no || null,
          trade_license_expiry: rec.trade_license_expiry || null,
          trade_license_img_url: rec.trade_license_img_url || null,
          vat_trn_no: rec.vat_trn_no || null,
          vat_cert_expiry: rec.vat_cert_expiry || null,
          vat_cert_img_url: rec.vat_cert_img_url || null,
          licensed_activities: rec.licensed_activities || null,
          status: rec.status || 'Active',
          notes: rec.notes || null,
        };
        if (!clean.supplier_name || !clean.supplier_name.trim()) { showToast('⚠️ Supplier name is required', 'error'); return; }
        try {
          if (rec.id) {
            const { error } = await db.from('suppliers').update(clean).eq('id', rec.id);
            if (error) throw error;
          } else {
            const { error } = await db.from('suppliers').insert(clean);
            if (error) throw error;
          }
          await logAudit(user, 'suppliers', rec.id, clean.supplier_name, rec.id ? 'update' : 'create', 'Supplier record ' + (rec.id ? 'updated' : 'created'));
          await load(); setEditingSupplier(null);
          const missingDocs = !clean.trade_license_img_url || !clean.vat_cert_img_url;
          showToast(missingDocs
            ? '⚠️ Supplier saved — ID ' + clean.supplier_id + '. Trade license/VAT certificate still missing — please upload within 7 days.'
            : '✅ Supplier saved — ID ' + clean.supplier_id);
        } catch (e) {
          if (/row-level security/i.test(e.message||'')) {
            setShowSetupPanel(true);
            showToast('❌ Save blocked by database permissions — copy the SQL in the "Database setup" panel below and re-run it in Supabase, then try saving again.', 'error');
          } else {
            showToast('❌ Save failed: ' + e.message, 'error');
          }
        }
      };

      const deleteSupplier = async (id) => {
        const sup = suppliers.find(s => s.id === id);
        const linked = sup ? supplierEmployees.filter(e => e.supplier_id === sup.supplier_id).length : 0;
        const msg = linked > 0
          ? `This supplier has ${linked} employee record(s). Delete anyway? (employee records are kept, just left pointing at the deleted supplier)`
          : 'Delete this supplier? It will be moved to the Recycle Bin for 30 days.';
        if (!window.confirm(msg)) return;
        const mode = await softDeleteRow(user, 'suppliers', id, sup && sup.supplier_name);
        await load(); showToast(mode === 'soft' ? 'Supplier moved to Recycle Bin' : 'Supplier deleted');
      };

      const saveSupplierEmployee = async (rec) => {
        const clean = {
          supplier_employee_id: rec.supplier_employee_id || nextSupplierEmployeeId(allEmployeeIdRows, rec.supplier_id),
          supplier_id: rec.supplier_id || null,
          full_name: rec.full_name || null,
          position: rec.position || null,
          nationality: rec.nationality || null,
          mobile: rec.mobile || null,
          passport_no: rec.passport_no || null,
          passport_expiry: rec.passport_expiry || null,
          passport_img_url: rec.passport_img_url || null,
          eid_no: rec.eid_no || null,
          eid_expiry: rec.eid_expiry || null,
          eid_img_url: rec.eid_img_url || null,
          insurance_no: rec.insurance_no || null,
          insurance_expiry: rec.insurance_expiry || null,
          insurance_img_url: rec.insurance_img_url || null,
          joined_date: rec.joined_date || null,
          current_location: rec.current_location || null,
          certificates: rec.certificates || null,
          certificates_img_url: rec.certificates_img_url || null,
          status: rec.status || 'Active',
          notes: rec.notes || null,
        };
        if (!clean.full_name || !clean.full_name.trim()) { showToast('⚠️ Employee name is required', 'error'); return; }
        if (!clean.supplier_id) { showToast('⚠️ Select which supplier this employee is hired from', 'error'); return; }
        try {
          if (rec.id) {
            const { error } = await db.from('supplier_employees').update(clean).eq('id', rec.id);
            if (error) throw error;
          } else {
            const { error } = await db.from('supplier_employees').insert(clean);
            if (error) throw error;
          }
          await logAudit(user, 'supplier_employees', rec.id, clean.full_name, rec.id ? 'update' : 'create', 'Supplier employee record ' + (rec.id ? 'updated' : 'created'));
          await load(); setEditingSupplierEmployee(null); showToast('✅ Employee saved — ID ' + clean.supplier_employee_id);
        } catch (e) {
          if (/row-level security/i.test(e.message||'')) {
            setShowSetupPanel(true);
            showToast('❌ Save blocked by database permissions — copy the SQL in the "Database setup" panel below and re-run it in Supabase, then try saving again.', 'error');
          } else {
            showToast('❌ Save failed: ' + e.message, 'error');
          }
        }
      };

      const deleteSupplierEmployee = async (id) => {
        if (!window.confirm('Delete this supplier employee record? It will be moved to the Recycle Bin for 30 days.')) return;
        const rec = supplierEmployees.find(e => e.id === id);
        const mode = await softDeleteRow(user, 'supplier_employees', id, rec && rec.full_name);
        await load(); showToast(mode === 'soft' ? 'Record moved to Recycle Bin' : 'Record deleted');
      };

      if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'40vh', flexDirection:'column', gap:'16px' }}><div className="spinner"></div><div style={{ color:'#64748b' }}>Loading Supplier Manpower…</div></div>;

      return (
        <div className="resume-db-shell">
          <div className="rdb-page-head">
            <div>
              <div className="rdb-eyebrow">Manpower Supply</div>
              <h1 className="rdb-title">Supplier Manpower</h1>
              <div className="rdb-subtitle">Manpower suppliers/agencies and the employees they've deployed to SATCO sites — kept separate from SATCO's own direct staff.</div>
            </div>
            {!setupNeeded && (
              <button type="button" onClick={()=>setShowSetupPanel(v=>!v)} style={{ background:'transparent', border:'1px solid var(--bd1)', color:'#64748b', padding:'6px 12px', borderRadius:'8px', fontSize:'11.5px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', alignSelf:'flex-start' }}>
                ⚙️ Database setup
              </button>
            )}
          </div>

          {(setupNeeded || showSetupPanel) && (
            <div style={{ background:'#fffbeb', border:'1px solid #f59e0b', borderRadius:'10px', padding:'14px 18px', marginBottom:'16px', fontSize:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                <div>
                  <b><EmojiIcon e="⚠️" /> {setupNeeded ? 'First-time setup:' : 'Database setup / fix permissions:'}</b> Run this SQL in Supabase (project: oaerqjrkdpuhiproppaz) SQL Editor, then reload this page. It's safe to re-run anytime — e.g. if a save fails with a "row-level security" error, or to pick up a newly added column. Use the button below to copy it exactly — manually selecting text out of the scrollable box can accidentally grab extra characters and cause a syntax error.
                </div>
                <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                  <button type="button" onClick={copySetupSql} style={{ background: sqlCopied?'#059669':'#2563eb', color:'#fff', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'12.5px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                    {sqlCopied ? '✓ Copied!' : '📋 Copy SQL'}
                  </button>
                  {!setupNeeded && (
                    <button type="button" onClick={()=>setShowSetupPanel(false)} style={{ background:'transparent', color:'#92400e', border:'1px solid #f59e0b', padding:'8px 12px', borderRadius:'8px', fontSize:'12.5px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                      Close
                    </button>
                  )}
                </div>
              </div>
              <code style={{ display:'block', background:'#f1f5f9', padding:'8px', borderRadius:'6px', marginTop:'8px', whiteSpace:'pre-wrap', fontSize:'11px', maxHeight:'260px', overflowY:'auto', userSelect:'text' }}>{SUPPLIER_MANPOWER_SETUP_SQL}</code>
            </div>
          )}

          <div className="ms-pivot" style={{ marginBottom:'16px', borderRadius:'10px 10px 0 0', overflow:'hidden' }}>
            <button onClick={()=>setPivot('suppliers')} className={`ms-pivot-btn${pivot==='suppliers'?' active':''}`}>
              <EmojiIcon e="🏢" /> Suppliers <span style={{ background: pivot==='suppliers'?'#0078d4':'#e1dfdd', color: pivot==='suppliers'?'#fff':'#605e5c', borderRadius:'10px', padding:'1px 7px', fontSize:'11px', fontWeight:700 }}>{suppliers.length}</span>
            </button>
            <button onClick={()=>setPivot('employees')} className={`ms-pivot-btn${pivot==='employees'?' active':''}`}>
              <EmojiIcon e="👷" /> Supplier Employees <span style={{ background: pivot==='employees'?'#0078d4':'#e1dfdd', color: pivot==='employees'?'#fff':'#605e5c', borderRadius:'10px', padding:'1px 7px', fontSize:'11px', fontWeight:700 }}>{supplierEmployees.length}</span>
            </button>
          </div>

          {pivot === 'suppliers' && (
            <SuppliersListView suppliers={suppliers} supplierEmployees={supplierEmployees} onAdd={()=>setEditingSupplier({})} onEdit={setEditingSupplier} onDelete={deleteSupplier} />
          )}
          {pivot === 'employees' && (
            <SupplierEmployeesListView supplierEmployees={supplierEmployees} suppliers={suppliers} onAdd={()=>setEditingSupplierEmployee({})} onEdit={setEditingSupplierEmployee} onDelete={deleteSupplierEmployee} />
          )}

          {editingSupplier && <SupplierModal record={editingSupplier} suppliers={suppliers} onSave={saveSupplier} onClose={()=>setEditingSupplier(null)} showToast={showToast} />}
          {editingSupplierEmployee && <SupplierEmployeeModal record={editingSupplierEmployee} suppliers={suppliers} supplierEmployees={allEmployeeIdRows} onSave={saveSupplierEmployee} onClose={()=>setEditingSupplierEmployee(null)} showToast={showToast} />}
        </div>
      );
    }

  