    // ── PART 4: Interview Sheet · Styles · Root ──
    // Normalise stored value to match dropdown option (case-insensitive)
    function normaliseOpt(val, opts) {
      if (!val) return '';
      const v = val.trim();
      // exact match first
      if (opts.includes(v)) return v;
      // case-insensitive match
      const lower = v.toLowerCase();
      return opts.find(o => o.toLowerCase() === lower) || v;
    }

    // ── Sheet Field components defined OUTSIDE InterviewSheetOverlay ──────────
    // Must be outside so React doesn't recreate them on every render (which kills input focus)
    function SheetField({ label, fk, type, opts, wide, placeholder, fd, setField }) {
      const tp = type || 'text';
      return (
        <div style={{ gridColumn: wide?'span 2':'span 1', display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10.5px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
          {opts ? (
            <select data-fk={fk} value={fd[fk]||''} onChange={e=>setField(fk,e.target.value)} style={{ padding:'7px 8px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'12.5px', background:'#fff' }}>
              <option value="">—</option>
              {opts.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          ) : tp==='textarea' ? (
            <textarea data-fk={fk} value={fd[fk]||''} onChange={e=>setField(fk,e.target.value)} placeholder={placeholder||''} style={{ padding:'7px 8px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'12.5px', minHeight:'64px', resize:'vertical', fontFamily:'inherit' }} />
          ) : tp==='number' ? (
            <input data-fk={fk} type="number" min="0" value={fd[fk]||''} onChange={e=>setField(fk,e.target.value)} placeholder={placeholder||''} style={{ padding:'7px 8px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'12.5px' }} />
          ) : tp==='date' ? (
            <input data-fk={fk} type="date" value={fd[fk]||''} onChange={e=>setField(fk,e.target.value)} style={{ padding:'7px 8px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'12.5px' }} />
          ) : (
            <input data-fk={fk} type="text" value={fd[fk]||''} onChange={e=>setField(fk,e.target.value)} placeholder={placeholder||''} style={{ padding:'7px 8px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'12.5px' }} />
          )}
        </div>
      );
    }
    function SheetSH({ label }) {
      return <div style={{ fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.8px', paddingBottom:'5px', borderBottom:'2px solid var(--bd1)', gridColumn:'span 2', marginTop:'8px' }}>{label}</div>;
    }

    function CF({ label, fk, type, opts, compact, wide, fd, setField, minHeight }) {
      const inputStyle = { width:'100%', padding: compact ? '2px 4px' : '5px 6px',
        border:'1px solid #bbb', borderRadius:'3px',
        fontSize: compact ? '10px' : '11px', fontFamily:'inherit', background:'#fff', color:'#0f172a' };
      // Textareas auto-grow to fit their full content (e.g. AI-extracted resume text) so
      // nothing is hidden behind a scrollbar — no fixed height to outgrow.
      const taRef = React.useRef(null);
      const autoGrow = (el) => { if (el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; } };
      React.useEffect(() => { if (type === 'textarea') autoGrow(taRef.current); }, [fd[fk], type]);
      return (
        <div style={{ gridColumn: wide ? 'span 2' : undefined }}>
          {label && <div style={{ fontSize:'7.5px', fontWeight:700, color:'#555', textTransform:'uppercase', marginBottom:'1px', letterSpacing:'0.3px' }}>{label}</div>}
          {opts ? (
            <select data-fk={fk} value={fd[fk]||''} onChange={e=>setField(fk,e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {opts.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          ) : type==='date' ? (
            <input data-fk={fk} type="date" value={fd[fk]||''} onChange={e=>setField(fk,e.target.value)} style={inputStyle} />
          ) : type==='textarea' ? (
            <textarea ref={taRef} data-fk={fk} value={fd[fk]||''}
              onChange={e=>{ setField(fk,e.target.value); autoGrow(e.target); }}
              style={{ ...inputStyle, minHeight: minHeight||'16px', resize:'vertical', overflow:'hidden' }} />
          ) : (
            <input data-fk={fk} type="text" value={fd[fk]||''} onChange={e=>setField(fk,e.target.value)} style={inputStyle} />
          )}
        </div>
      );
    }
    function SecHdr({ num, label }) {
      return (
        <div style={{ background:'#0d2240', color:'#fff', padding:'3px 10px', display:'flex', alignItems:'center', gap:'6px', marginTop:'3px' }}>
          <div style={{ background:'#f0a500', color:'#0d2240', borderRadius:'50%', width:'14px', height:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'7.5px', fontWeight:900, flexShrink:0 }}>{num}</div>
          <span style={{ fontSize:'8.5px', fontWeight:700, letterSpacing:'0.5px' }}>{label}</span>
        </div>
      );
    }

    // Build the hiring_pipeline DB patch object from the Interview Sheet's local form
    // state (fd) + scores + answers. Shared by the AI-scan auto-save paths AND the
    // manual "Save to Candidate" / "Save as PDF" buttons so every path persists the
    // exact same fields the same way.
    function buildInterviewPatchFromFd(fd, scores, answers) {
      const v = (k) => (fd && fd[k]) || '';
      const scoreTotal = Object.values(scores||{}).reduce((a,b)=>a+b,0);
      return {
        candidate_name: v('name')||null, dob_candidate: v('dob')||null,
        nationality: v('nationality')||null, passport_no: v('passport_no')||null,
        passport_expiry_candidate: v('passport_expiry')||null,
        place_of_issue: v('place_of_issue')||null, religion: v('religion')||null,
        marital_status: v('marital')||null, phone: v('phone')||null,
        whatsapp: v('whatsapp')||null, email: v('email')||null,
        current_location: v('location')||null, languages: v('languages')||null,
        home_address: v('address')||null, referred_by: v('referred_by')||null,
        position: v('position_applied')||null,
        position_selected: v('position_selected')||null, experience: v('exp_years')||null,
        current_employer: v('curr_employer')||null,
        current_designation: v('curr_designation')||null,
        skills: v('skills')||null, me_experience: v('me_experience')||null,
        work_history: v('work_history')||v('me_notes')||null,
        me_notes: v('me_notes')||null,
        dependants_count: v('dependants')||null, children_count: v('children')||null,
        family_in_uae: v('family_uae')||null,
        emergency_contact: v('emergency_contact')||null,
        interview_date: v('int_date')||null, interviewed_by: v('int_by')||null,
        interview_mode: v('int_mode')||null, interview_notes: v('int_notes')||null,
        interview_verdict: v('verdict') !== '' ? v('verdict') : null, verdict_reason: v('verdict_reason')||null,
        interview_score: scoreTotal || null,
        interview_score_technical: (scores&&scores.technical) || null,
        interview_score_comm: (scores&&scores.comm) || null,
        interview_score_safety: (scores&&scores.safety) || null,
        interview_score_exp: (scores&&scores.exp) || null,
        interview_score_attitude: (scores&&scores.attitude) || null,
        interview_score_docs: (scores&&scores.docs) || null,
        interview_qa: Object.values(answers||{}).filter(Boolean).join(' | ') || null,
        basic_salary: v('basic_salary')||null, allowance: v('allowance')||null,
        deployment_site: v('deployment')||null, visa_category: v('visa_cat')||null,
        accommodation: v('accommodation')||null,
        medical_conditions: v('medical_cond')||null,
        on_medication: v('on_medication')||null,
        colour_blindness: v('colour_blind')||null,
        fit_for_height: v('fit_height')||null,
        fit_for_cse: v('fit_cse')||null,
        gamka_result: v('gamka')||null, gamka_date: v('gamka_date')||null,
        medical_notes: v('medical_notes')||null,
        current_salary: v('curr_salary')||null,
        transport_by: v('transport')||null,
        food_by: v('food')||null,
        expected_arrival_date: v('joining_date')||null,
        offer_notes: v('offer_notes')||null,
        vision_aids: v('vision')||null,
        other_certifications: v('other_certs')||null,
      };
    }


    function InterviewSheetOverlay({ candidate, onClose, showToast, onAfterSave, onHiringUpdate, onReload }) {
      const isBlank = !candidate || !candidate.candidate_name;
      // Local form state
      const [fd, setFd] = useState({
        name: candidate.candidate_name||'', position: candidate.position||'',
        nationality: normaliseOpt(candidate.nationality, ['Indian','Pakistani','Bangladeshi','Sri Lankan','Nepali','Filipino','Egyptian','Sudanese','Ethiopian','Other']),
        passport_no: candidate.passport_no||'',
        passport_expiry: candidate.passport_expiry_candidate||'',
        place_of_issue: candidate.place_of_issue||'', dob: candidate.dob_candidate||'',
        marital: normaliseOpt(candidate.marital_status, ['Single','Married','Divorced','Widowed']),
        religion: normaliseOpt(candidate.religion, ['Islam','Hinduism','Christianity','Other']),
        phone: candidate.phone||'', whatsapp: candidate.whatsapp||candidate.phone||'',
        email: candidate.email||'',
        location: normaliseOpt(candidate.current_location, ['India','UAE','Pakistan','Bangladesh','Sri Lanka','Nepal','Philippines','Oman','Saudi Arabia','Qatar','Kuwait','Bahrain','Other']),
        address: candidate.home_address||'', languages: candidate.languages||'',
        referred_by: candidate.referred_by||'',
        edu_level: candidate.education ? (candidate.education.split('—')[0]||'').trim() : '',
        edu_spec:  candidate.education ? (candidate.education.split('—')[1]||'').trim() : '',
        edu_inst:  candidate.education ? (candidate.education.split('—')[2]||'').replace(/\(.*\)/,'').trim() : '',
        edu_year:  candidate.education ? (candidate.education.match(/\((\d{4})\)/)||['',''])[1] : '',
        position_applied: candidate.position||'',
        // Left blank until the interviewer actually confirms it — never pre-filled from the
        // applied-for position just because the sheet was opened.
        position_selected: candidate.position_selected||'',
        exp_years: candidate.experience||'',
        curr_employer: candidate.current_employer||'',
        curr_designation: candidate.current_designation||'',
        curr_salary: candidate.current_salary||'', notice: '',
        skills: candidate.skills||'',
        me_experience: candidate.me_experience||'',
        work_history: candidate.work_history||candidate.me_notes||'',
        me_notes: candidate.me_notes||'',
        other_certs: candidate.other_certifications||'',
        dependants: candidate.dependants_count||'', children: candidate.children_count||'',
        family_uae: candidate.family_in_uae||'', emergency_contact: candidate.emergency_contact||'',
        int_date: candidate.interview_date || '',
        int_mode: candidate.interview_mode||'',
        int_by: candidate.interviewed_by||'',
        int_notes: candidate.interview_notes||'',
        verdict: candidate.interview_verdict||'',
        verdict_reason: candidate.verdict_reason||'',
        basic_salary: candidate.basic_salary ? String(Math.abs(Number(candidate.basic_salary))) : '',
        allowance: candidate.allowance||'',
        accommodation: candidate.accommodation||'', transport: candidate.transport_by||'', food: candidate.food_by||'',
        joining_date: candidate.expected_arrival_date||'', visa_cat: candidate.visa_category||'',
        deployment: candidate.deployment_site||'',
        offer_notes: candidate.offer_notes||'',
        relmar: (candidate.religion||'') + (candidate.marital_status ? ' / '+candidate.marital_status : ''),
        medical_cond: normaliseOpt(candidate.medical_conditions, ['None','Diabetes','Hypertension','Heart condition','Asthma / Respiratory','Back / Spine issue','Vision impairment','Other'])||'',
        on_medication: normaliseOpt(candidate.on_medication, ['No','Yes – stable, cleared by doctor'])||'',
        colour_blind: normaliseOpt(candidate.colour_blindness, ['No','Yes – partial','Yes – complete'])||'',
        vision: normaliseOpt(candidate.vision_aids, ['No','Glasses / Contacts','Hearing aid','Both'])||'',
        fit_height: normaliseOpt(candidate.fit_for_height, ['Yes – fit','Not assessed yet','No – restricted'])||'',
        fit_cse: normaliseOpt(candidate.fit_for_cse, ['Yes – fit','Not assessed yet','No – restricted'])||'',
        medical_notes: candidate.medical_notes||'',
        gamka: normaliseOpt(candidate.gamka_result, ['Not done yet','FIT – valid','Conditionally Fit','UNFIT'])||'',
        gamka_date: candidate.gamka_date||'',
      });
      const [scores, setScores] = useState({
        technical: parseInt(candidate.interview_score_technical)||0,
        comm: parseInt(candidate.interview_score_comm)||0,
        safety: parseInt(candidate.interview_score_safety)||0,
        exp: parseInt(candidate.interview_score_exp)||0,
        attitude: parseInt(candidate.interview_score_attitude)||0,
        docs: parseInt(candidate.interview_score_docs)||0,
      });
      const [answers, setAnswers] = useState({});
      const [scanning, setScanning] = useState(false);
      const [scanFiles, setScanFiles] = useState([]);
      const [scanMsg, setScanMsg] = useState('');
      const [autoScanned, setAutoScanned] = useState(false);
      const [pdfGenerating, setPdfGenerating] = useState(false);
      const [saving, setSaving] = useState(false);

      const totalScore = Object.values(scores).reduce((a,b)=>a+b,0);
      const grade = totalScore>=26?'⭐ Excellent':totalScore>=21?'✅ Good':totalScore>=17?'🟡 Average':totalScore>0?'⚠️ Low':'—';

      // f() and set() are now defined below inside the liveRef block (see Field component)

      // Prompt text for AI extraction — defined before useEffect so it's in closure scope
      const EXTRACT_PROMPT = `You are an expert HR document reader. You may receive a resume/CV, a passport scan, or both. Extract ALL available information from every document provided.
IMPORTANT: For passport images, extract the MRZ data too (bottom 2 lines) for passport number, nationality, DOB, and expiry.
Reply ONLY with valid JSON — no markdown fences, no preamble, no explanation. Use null for any missing field.
{
  "fullName": "full name as in passport or resume",
  "dob": "YYYY-MM-DD or null",
  "nationality": "country nationality e.g. Indian",
  "passportNo": "passport number",
  "passportExpiry": "YYYY-MM-DD or null",
  "placeOfIssue": "city/country of passport issue",
  "phone": "+country-code number",
  "whatsApp": "+country-code number or same as phone",
  "email": "email address",
  "address": "home address",
  "languages": "comma-separated languages",
  "currentLocation": "current country — look for UAE visa, residency, or address clues; or country code in phone number (971=UAE, 91=India, 92=Pakistan)",
  "religion": "religion if visible OR infer from name/nationality context (e.g. Indian Hindu names, Islamic names for Gulf/Pakistani candidates) — return Islam, Hinduism, Christianity, or Other; null only if truly ambiguous",
  "maritalStatus": "Single or Married or Divorced or Widowed",
  "position": "job title applied for or current role",
  "totalExperience": "total years as number string",
  "currentEmployer": "current or most recent company",
  "currentDesignation": "current or most recent job title",
  "currentSalary": "current salary if mentioned",
  "skills": "comma-separated key technical skills",
  "education": {"level": "highest qualification stated anywhere in the document — look for an 'Education'/'Academic' section, or any mention of Bachelor's/Diploma/ITI/High School/SSC/10th/12th; if the resume is for a tradesman with no formal section, use the highest level implied (e.g. 'High School' or 'ITI Diploma'); return null only if truly nothing is stated", "specialisation": "field/trade", "institution": "college/university", "year": "graduation year"},
  "referredBy": "referred by name if mentioned",
  "meExperience": "yes if worked in UAE/Saudi Arabia/Qatar/Kuwait/Bahrain/Oman/Iraq, otherwise no",
  "workHistory": "top 8 rows as: Company | Role/Designation | Work Location/Country/Site | Period; ...",
  "meNotes": "list ALL companies from experience table regardless of country, format: Company (Country/Site) — Role, Period; ..."
}`;

      // Auto-scan saved documents on first open
      React.useEffect(() => {
        if (autoScanned) return;
        const resumeData    = candidate.resume_url;
        const passportData  = candidate.passport_img_url;
        if (!resumeData && !passportData) return; // nothing stored, skip

        setAutoScanned(true);
        setScanning(true);
        setScanMsg('Reading saved documents…');

        (async () => {
          try {
            const parts = [];
            // Add passport if available
            if (passportData && passportData.startsWith('data:')) {
              const isPdf = isPdfUrl(passportData);
              const b64   = passportData.split(',')[1];
              parts.push(isPdf
                ? {type:'document', source:{type:'base64', media_type:'application/pdf', data:b64}}
                : {type:'image',    source:{type:'base64', media_type: passportData.split(';')[0].split(':')[1], data:b64}});
            }
            // Add resume if available
            if (resumeData && resumeData.startsWith('data:')) {
              const isPdf = isPdfUrl(resumeData);
              const b64   = resumeData.split(',')[1];
              parts.push(isPdf
                ? {type:'document', source:{type:'base64', media_type:'application/pdf', data:b64}}
                : {type:'image',    source:{type:'base64', media_type: resumeData.split(';')[0].split(':')[1], data:b64}});
            }
            if (parts.length === 0) { setScanning(false); setScanMsg(''); return; }

            parts.push({type:'text', text: EXTRACT_PROMPT});
            setScanMsg(`Extracting from ${parts.length - 1} saved doc(s)…`);

            const resp = await fetch('/api/claude', {
              method:'POST',
              headers:{
                'Content-Type':'application/json'
              },
              body: JSON.stringify({model:'claude-haiku-4-5-20251001', max_tokens:2000, messages:[{role:'user',content:parts}]})
            });
            if (!resp.ok) throw new Error(`API ${resp.status} — check ANTHROPIC_KEY in Vercel env vars`);
            const json   = await resp.json();
            const raw    = (json.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
            const d = parseClaudeJson(raw);

            setFd(prev => { const next = {...prev,
              name:           d.fullName            || prev.name,
              dob:            d.dob                 || prev.dob,
              nationality:    normaliseOpt(d.nationality, ['Indian','Pakistani','Bangladeshi','Sri Lankan','Nepali','Filipino','Egyptian','Sudanese','Ethiopian','Other']) || prev.nationality,
              passport_no:    d.passportNo          || prev.passport_no,
              passport_expiry:d.passportExpiry      || prev.passport_expiry,
              place_of_issue: d.placeOfIssue        || prev.place_of_issue,
              phone:          d.phone               || prev.phone,
              whatsapp:       d.whatsApp||d.phone   || prev.whatsapp,
              email:          d.email               || prev.email,
              address:        (() => {
                const a = d.address || prev.address || '';
                // Detect garbage: if any single character repeats >10 times in a row, discard
                if (/(.)\1{10,}/.test(a)) return prev.address || '';
                return a.slice(0, 200) || prev.address;
              })(),
              languages:      d.languages           || prev.languages,
              location:       (() => {
                const loc = normaliseOpt(d.currentLocation, ['India','UAE','Pakistan','Bangladesh','Sri Lanka','Nepal','Philippines','Oman','Saudi Arabia','Qatar','Kuwait','Bahrain','Other']);
                if (loc) return loc;
                if (prev.location) return prev.location;
                // Infer from phone country code
                const ph = d.phone || '';
                if (ph.startsWith('+971')) return 'UAE';
                if (ph.startsWith('+91')) return 'India';
                if (ph.startsWith('+92')) return 'Pakistan';
                if (ph.startsWith('+880')) return 'Bangladesh';
                return '';
              })(),
              religion:       (() => {
                const rel = normaliseOpt(d.religion, ['Islam','Hinduism','Christianity','Other']);
                if (rel) return rel;
                if (prev.religion) return prev.religion;
                // Infer from nationality when not stated
                const nat = (d.nationality || '').toLowerCase();
                if (nat.includes('indian') || nat.includes('nepali') || nat.includes('sri lankan')) return 'Hinduism';
                if (nat.includes('pakistani') || nat.includes('bangladeshi') || nat.includes('egyptian') || nat.includes('sudanese')) return 'Islam';
                if (nat.includes('filipino')) return 'Christianity';
                return '';
              })(),
              marital:        normaliseOpt(d.maritalStatus, ['Single','Married','Divorced','Widowed']) || prev.marital,
              position_applied: d.position         || prev.position_applied,
              exp_years:       d.totalExperience   || prev.exp_years,
              curr_employer:   d.currentEmployer   || prev.curr_employer,
              curr_designation:d.currentDesignation|| prev.curr_designation,
              curr_salary:     d.currentSalary     || prev.curr_salary,
              skills:          d.skills            || prev.skills,
              referred_by:     d.referredBy        || prev.referred_by,
              edu_level:       (d.education&&d.education.level)         || prev.edu_level,
              edu_spec:        (d.education&&d.education.specialisation) || prev.edu_spec,
              edu_inst:        (d.education&&d.education.institution)    || prev.edu_inst,
              edu_year:        (d.education&&d.education.year)           || prev.edu_year,
              me_experience:   d.meExperience       || prev.me_experience,
              work_history:    d.workHistory        || d.meNotes || prev.work_history,
              me_notes:        d.meNotes            || prev.me_notes,
            }; fdRef.current = next; return next; });
            // ── Persist immediately so this data survives closing the sheet ──────
            // Scanning used to only update local React state (fd); if the HR closed
            // the sheet without clicking "Save to Candidate" first, everything the
            // AI just extracted was silently lost. Auto-save right after the scan
            // fixes that — the explicit Save button still works for manual edits.
            if (candidate.id) {
              try {
                const autoPatch = buildInterviewPatchFromFd(fdRef.current, scores, answers);
                const { data: asRows, error: asErr } = await dbSaveWithRetry('hiring_pipeline', autoPatch, candidate.id);
                if (asErr) { console.warn('Auto-save after scan failed:', asErr.message); }
                else if (!asRows || asRows.length === 0) { console.warn('Auto-save after scan affected 0 rows — check RLS policy.'); }
                else if (onHiringUpdate) { onHiringUpdate({...autoPatch, id: candidate.id}); }
              } catch(saveErr) { console.warn('Auto-save after scan error:', saveErr.message); }
            }
            showToast(`✅ Auto-filled from saved ${parts.length-1 > 1 ? 'resume + passport' : 'document'} — saved to candidate record`);
          } catch(e) {
            console.error('Auto-scan error:', e);
            showToast('⚠️ Auto-scan failed: ' + e.message, 'error');
          }
          setScanning(false);
          setScanMsg('');
        })();
      }, []); // run once on mount
      // fdRef mirrors fd state — always current even mid-type
      // Buttons read from fdRef; inputs are controlled via fd state
      const fdRef = React.useRef(fd);
      React.useEffect(() => { fdRef.current = fd; }, [fd]);
      const setField = (key, val) => setFd(p => { const n={...p,[key]:val}; fdRef.current=n; return n; });
      const f = (key) => fdRef.current[key] || '';

      // Field and SH are defined outside this component (see SheetField / SheetSH below)
      // They receive fd and setField as props to avoid being redefined on every render

      const toBase64 = (file) => new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(',')[1]);r.onerror=()=>rej(new Error('read failed'));r.readAsDataURL(file);});

      const addScanFile = (file) => {
        setScanFiles(prev => {
          if (prev.length >= 3) { showToast('Max 3 documents at once', 'error'); return prev; }
          if (prev.some(f=>f.name===file.name)) return prev;
          return [...prev, file];
        });
      };

      const removeScanFile = (idx) => setScanFiles(prev => prev.filter((_,i)=>i!==idx));

      const scanAllDocs = async () => {
        if (scanFiles.length === 0) { showToast('Add at least one document first', 'error'); return; }
        setScanning(true);
        setScanMsg('Reading documents…');
        try {
          // Build content parts — all docs + single instruction at end
          const parts = [];
          for (const file of scanFiles) {
            const b64 = await toBase64(file);
            const isPdf = file.type === 'application/pdf';
            parts.push(isPdf
              ? {type:'document', source:{type:'base64', media_type:'application/pdf', data:b64}}
              : {type:'image', source:{type:'base64', media_type:file.type, data:b64}});
          }
          parts.push({type:'text', text: EXTRACT_PROMPT});

          setScanMsg('AI extracting details…');
          const resp = await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:2000,messages:[{role:'user',content:parts}]})});
          if (!resp.ok) throw new Error(`API ${resp.status} — check ANTHROPIC_KEY`);
          const json = await resp.json();
          const raw = (json.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
          const d = parseClaudeJson(raw);
          setFd(prev => ({...prev,
            name: d.fullName||prev.name,
            dob: d.dob||prev.dob,
            nationality: normaliseOpt(d.nationality, ['Indian','Pakistani','Bangladeshi','Sri Lankan','Nepali','Filipino','Egyptian','Sudanese','Ethiopian','Other'])||prev.nationality,
            passport_no: d.passportNo||prev.passport_no,
            passport_expiry: d.passportExpiry||prev.passport_expiry,
            place_of_issue: d.placeOfIssue||prev.place_of_issue,
            phone: d.phone||prev.phone,
            whatsapp: d.whatsApp||d.phone||prev.whatsapp,
            email: d.email||prev.email,
            address: (() => { const a = d.address||''; return /(.)\1{10,}/.test(a) ? prev.address||'' : (a.slice(0,200)||prev.address); })(),
            languages: d.languages||prev.languages,
            location: (() => {
              const loc = normaliseOpt(d.currentLocation, ['India','UAE','Pakistan','Bangladesh','Sri Lanka','Nepal','Philippines','Oman','Saudi Arabia','Qatar','Kuwait','Bahrain','Other']);
              if (loc) return loc;
              if (prev.location) return prev.location;
              const ph = d.phone || '';
              if (ph.startsWith('+971')) return 'UAE';
              if (ph.startsWith('+91')) return 'India';
              if (ph.startsWith('+92')) return 'Pakistan';
              if (ph.startsWith('+880')) return 'Bangladesh';
              return '';
            })(),
            religion: (() => {
              const rel = normaliseOpt(d.religion, ['Islam','Hinduism','Christianity','Other']);
              if (rel) return rel;
              if (prev.religion) return prev.religion;
              const nat = (d.nationality || '').toLowerCase();
              if (nat.includes('indian') || nat.includes('nepali') || nat.includes('sri lankan')) return 'Hinduism';
              if (nat.includes('pakistani') || nat.includes('bangladeshi') || nat.includes('egyptian') || nat.includes('sudanese')) return 'Islam';
              if (nat.includes('filipino')) return 'Christianity';
              return '';
            })(),
            marital: normaliseOpt(d.maritalStatus, ['Single','Married','Divorced','Widowed'])||prev.marital,
            position_applied: d.position||prev.position_applied,
            exp_years: d.totalExperience||prev.exp_years,
            curr_employer: d.currentEmployer||prev.curr_employer,
            curr_designation: d.currentDesignation||prev.curr_designation,
            curr_salary: d.currentSalary||prev.curr_salary,
            skills: d.skills||prev.skills,
            referred_by: d.referredBy||prev.referred_by,
            edu_level: (d.education&&d.education.level)||prev.edu_level,
            edu_spec: (d.education&&d.education.specialisation)||prev.edu_spec,
            edu_inst: (d.education&&d.education.institution)||prev.edu_inst,
            edu_year: (d.education&&d.education.year)||prev.edu_year,
            me_experience: d.meExperience||prev.me_experience,
            work_history: d.workHistory||d.meNotes||prev.work_history,
            me_notes: d.meNotes||prev.me_notes,
          }));
          const next = { ...fdRef.current,
            name: d.fullName||fdRef.current.name, dob: d.dob||fdRef.current.dob,
            nationality: normaliseOpt(d.nationality, ['Indian','Pakistani','Bangladeshi','Sri Lankan','Nepali','Filipino','Egyptian','Sudanese','Ethiopian','Other'])||fdRef.current.nationality,
            passport_no: d.passportNo||fdRef.current.passport_no,
            passport_expiry: d.passportExpiry||fdRef.current.passport_expiry,
            place_of_issue: d.placeOfIssue||fdRef.current.place_of_issue,
            phone: d.phone||fdRef.current.phone, whatsapp: d.whatsApp||d.phone||fdRef.current.whatsapp,
            email: d.email||fdRef.current.email,
            languages: d.languages||fdRef.current.languages,
            marital: normaliseOpt(d.maritalStatus, ['Single','Married','Divorced','Widowed'])||fdRef.current.marital,
            position_applied: d.position||fdRef.current.position_applied,
            exp_years: d.totalExperience||fdRef.current.exp_years,
            curr_employer: d.currentEmployer||fdRef.current.curr_employer,
            curr_designation: d.currentDesignation||fdRef.current.curr_designation,
            curr_salary: d.currentSalary||fdRef.current.curr_salary,
            skills: d.skills||fdRef.current.skills,
            referred_by: d.referredBy||fdRef.current.referred_by,
            edu_level: (d.education&&d.education.level)||fdRef.current.edu_level,
            edu_spec: (d.education&&d.education.specialisation)||fdRef.current.edu_spec,
            edu_inst: (d.education&&d.education.institution)||fdRef.current.edu_inst,
            edu_year: (d.education&&d.education.year)||fdRef.current.edu_year,
            me_experience: d.meExperience||fdRef.current.me_experience,
            work_history: d.workHistory||d.meNotes||fdRef.current.work_history,
            me_notes: d.meNotes||fdRef.current.me_notes,
          };
          fdRef.current = next;
          setScanFiles([]); // clear after success
          // ── Persist the newly scanned data straight to the candidate record ──────
          // Previously this only touched `updated_at` — the actual extracted fields
          // lived in local state only, so if the sheet was closed without an explicit
          // "Save to Candidate" click, everything just scanned was lost.
          if (candidate.id) {
            try {
              const autoPatch = buildInterviewPatchFromFd(next, scores, answers);
              const { data: sdRows, error: sdErr } = await dbSaveWithRetry('hiring_pipeline', autoPatch, candidate.id);
              if (sdErr) { showToast('⚠️ Scanned, but DB save failed: ' + sdErr.message, 'error'); }
              else if (!sdRows || sdRows.length === 0) { showToast('❌ Scan save affected 0 rows — check Supabase RLS policy on hiring_pipeline UPDATE.', 'error'); }
              else {
                showToast(`✅ ${scanFiles.length} document(s) scanned — details filled in and saved to candidate record`);
                if (onHiringUpdate) onHiringUpdate({...autoPatch, id: candidate.id});
                if (onReload) onReload();
              }
            } catch(saveErr) { showToast('⚠️ Scanned, but DB save error: ' + saveErr.message, 'error'); }
          } else {
            showToast(`✅ ${scanFiles.length} document(s) scanned — details filled in`);
          }
        } catch(e) {
          console.error('Scan error:', e);
          showToast('⚠️ Scan failed: ' + e.message, 'error');
        }
        setScanning(false);
        setScanMsg('');
      };

      const resumePromptText = () => `You are an expert HR document reader. You may receive a resume/CV, a passport scan, or both. Extract ALL available information from every document provided.
IMPORTANT: For passport images, extract the MRZ data too (bottom 2 lines) for passport number, nationality, DOB, and expiry.
Reply ONLY with valid JSON — no markdown fences, no preamble, no explanation. Use null for any missing field.
{
  "fullName": "full name as in passport or resume",
  "dob": "YYYY-MM-DD or null",
  "nationality": "country nationality e.g. Indian",
  "passportNo": "passport number",
  "passportExpiry": "YYYY-MM-DD or null",
  "placeOfIssue": "city/country of passport issue",
  "phone": "+country-code number",
  "whatsApp": "+country-code number or same as phone",
  "email": "email address",
  "address": "home address",
  "languages": "comma-separated languages",
  "currentLocation": "current country e.g. India, UAE",
  "religion": "religion if visible",
  "maritalStatus": "Single or Married or Divorced or Widowed",
  "position": "job title applied for or current role",
  "totalExperience": "total years as number string",
  "currentEmployer": "current or most recent company",
  "currentDesignation": "current or most recent job title",
  "currentSalary": "current salary if mentioned",
  "skills": "comma-separated key technical skills",
  "education": {"level": "highest qualification stated anywhere in the document — look for an 'Education'/'Academic' section, or any mention of Bachelor's/Diploma/ITI/High School/SSC/10th/12th; if the resume is for a tradesman with no formal section, use the highest level implied; return null only if truly nothing is stated", "specialisation": "field/trade", "institution": "college/university", "year": "graduation year"},
  "referredBy": "referred by name if mentioned",
  "meExperience": "yes if worked in UAE/Saudi Arabia/Qatar/Kuwait/Bahrain/Oman/Iraq, otherwise no",
  "workHistory": "top 8 rows as: Company | Role/Designation | Work Location/Country/Site | Period; ...",
  "meNotes": "list ALL companies from experience table regardless of country, format: Company (Country/Site) — Role, Period; ..."
}`;

      const printSheet = async () => {
        // ── COMPACT FILLABLE A4 PDF — matches on-screen layout, fields editable ──
        const { PDFDocument, rgb, StandardFonts, PDFName, PDFString, PDFArray,
                PDFNumber, PDFBool, PDFDict } = PDFLib;

        const NAVY  = rgb(0.051,0.133,0.251);
        const AMBER = rgb(0.941,0.647,0);
        const WHITE = rgb(1,1,1);
        const BLACK = rgb(0,0,0);
        const DGRAY = rgb(0.282,0.349,0.412);
        const MGRAY = rgb(0.580,0.631,0.690);
        const LGRAY = rgb(0.945,0.961,0.980);
        const BORDER= rgb(0.796,0.851,0.906);
        const GREEN_B=rgb(0.941,0.996,0.961);
        const GREEN_T=rgb(0.024,0.373,0.243);
        const GREEN_D=rgb(0.525,0.937,0.675);
        const RED_V = rgb(0.718,0.110,0.110);
        const ORG_V = rgb(0.902,0.396,0);
        const GRN_V = rgb(0.180,0.490,0.196);

        const pdfDoc = await PDFDocument.create();
        const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const PW = 595.28, PH = 841.89;
        const ML = 11*2.835, MR = 11*2.835, CW = PW-ML-MR;

        const today   = new Date();
        const dateStr = today.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
        const refStr  = 'SATCO/HR/'+today.getFullYear()+'/'+String(today.getMonth()+1).padStart(2,'0')+String(today.getDate()).padStart(2,'0');
        const fname   = 'SATCO_Interview_'+(f('name')||'Candidate').replace(/[^a-zA-Z0-9]/g,'_')+'_'+today.toISOString().slice(0,10)+'.pdf';

        // ── AcroForm field registry ───────────────────────────────────────────
        const allFields = [];
        const context = pdfDoc.context;

        // Add one page only
        const page = pdfDoc.addPage([PW,PH]);
        let y = PH - 9*2.835;

        // ── helpers ──────────────────────────────────────────────────────────
        const toWA = s => String(s||'')
          .replace(/\u2013/g,'-').replace(/\u2014/g,'--')
          .replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"')
          .replace(/\u2022/g,'*').replace(/\u2026/g,'...')
          .replace(/[^\x00-\xFF]/g,'?');

        const clip = (str, fnt, sz, maxW) => {
          const s = toWA(str);
          if (!s) return '';
          if (fnt.widthOfTextAtSize(s,sz) <= maxW) return s;
          let c = s;
          while (c.length>1 && fnt.widthOfTextAtSize(c+'...',sz)>maxW) c=c.slice(0,-1);
          return c+'...';
        };

        const txt = (s, x, yy, opts={}) => {
          const drawn = clip(String(s||''), opts.bold?bold:reg, opts.size||8, opts.maxW||9999);
          if (!drawn) return;
          page.drawText(drawn, {x, y:yy, font:opts.bold?bold:reg, size:opts.size||8, color:opts.color||BLACK});
        };

        // Word-wrap long text into lines that fit maxW, so nothing gets silently cut to "...".
        // A single word wider than maxW is hard-broken by character rather than dropped.
        const wrapLines = (str, fnt, sz, maxW) => {
          const s = toWA(str);
          if (!s) return [];
          const words = s.split(/\s+/).filter(Boolean);
          const lines = [];
          let cur = '';
          for (const w of words) {
            const test = cur ? cur + ' ' + w : w;
            if (fnt.widthOfTextAtSize(test, sz) <= maxW) { cur = test; continue; }
            if (cur) lines.push(cur);
            if (fnt.widthOfTextAtSize(w, sz) <= maxW) { cur = w; continue; }
            let chunk = w;
            while (fnt.widthOfTextAtSize(chunk, sz) > maxW && chunk.length > 1) {
              let end = chunk.length;
              while (end > 1 && fnt.widthOfTextAtSize(chunk.slice(0, end), sz) > maxW) end--;
              lines.push(chunk.slice(0, end));
              chunk = chunk.slice(end);
            }
            cur = chunk;
          }
          if (cur) lines.push(cur);
          return lines;
        };

        const rect = (x, yy, w, h, opts={}) =>
          page.drawRectangle({x, y:yy, width:w, height:h,
            color:opts.fill||undefined, borderColor:opts.stroke||undefined,
            borderWidth:opts.lw||(opts.stroke?0.5:0)});

        // Register a fillable text AcroForm widget
        const addField = (name, x, yy, w, h, value='', opts={}) => {
          const flags = opts.multi ? 4096 : 0;
          const annotDict = context.obj({
            Type:    PDFName.of('Annot'),
            Subtype: PDFName.of('Widget'),
            FT:      PDFName.of('Tx'),
            T:       PDFString.of(name),
            V:       PDFString.of(toWA(value)),
            DV:      PDFString.of(''),
            Ff:      PDFNumber.of(flags),
            Rect:    context.obj([x, yy, x+w, yy+h]),
            DA:      PDFString.of('/Helv 8 Tf 0 g'),
            BS:      context.obj({S:PDFName.of('S'), W:PDFNumber.of(0.6)}),
            MK:      context.obj({BG:context.obj([PDFNumber.of(1),PDFNumber.of(1),PDFNumber.of(1)])}),
          });
          const ref = context.register(annotDict);
          allFields.push(ref);
          // Add to page annotations
          const existingAnnots = page.node.get(PDFName.of('Annots'));
          if (existingAnnots) existingAnnots.push(ref);
          else page.node.set(PDFName.of('Annots'), context.obj([ref]));
        };

        // Register a checkbox widget
        const addCheck = (name, x, yy, size=9) => {
          const annotDict = context.obj({
            Type:    PDFName.of('Annot'),
            Subtype: PDFName.of('Widget'),
            FT:      PDFName.of('Btn'),
            T:       PDFString.of(name),
            V:       PDFName.of('Off'),
            DV:      PDFName.of('Off'),
            Ff:      PDFNumber.of(0),
            AS:      PDFName.of('Off'),
            Rect:    context.obj([x, yy, x+size, yy+size]),
            DA:      PDFString.of('/ZaDb 10 Tf 0 g'),
          });
          const ref = context.register(annotDict);
          allFields.push(ref);
          const existingAnnots = page.node.get(PDFName.of('Annots'));
          if (existingAnnots) existingAnnots.push(ref);
          else page.node.set(PDFName.of('Annots'), context.obj([ref]));
        };

        // Draw a label + visible box + register fillable field
        // Returns height consumed
        const drawField = (label, name, x, yy, w, value='', opts={}) => {
          const LH=9, PAD=3;
          txt(label.toUpperCase(), x, yy-LH+1.5, {bold:true, size:6, color:DGRAY});
          if (opts.wrap) {
            // Multi-line mode — box grows to fit every wrapped line, nothing is truncated
            // unless the text genuinely exceeds maxLines (very rare given the page budget).
            const fsz = opts.size || 6.8, lineGap = fsz + 1.6, maxLines = opts.maxLines || 12;
            let lines = wrapLines(value, reg, fsz, w - 8);
            let overflow = false;
            if (lines.length > maxLines) { lines = lines.slice(0, maxLines); overflow = true; }
            const IH = Math.max(opts.fh || 13, lines.length ? lines.length * lineGap + 6 : (opts.fh || 13));
            rect(x, yy-LH-2-IH, w, IH, {fill:opts.fill||WHITE, stroke:BORDER, lw:0.6});
            const top = yy-LH-2;
            lines.forEach((ln, i) => {
              const isLast = i === lines.length - 1;
              const drawn = (overflow && isLast) ? clip(ln + ' …', reg, fsz, w - 8) : ln;
              txt(drawn, x+3, top - 5 - i*lineGap, {size:fsz, color:BLACK});
            });
            addField(name, x, yy-LH-2-IH, w, IH, value, {multi:true});
            return LH+2+IH+PAD;
          }
          const IH=opts.fh||13;
          rect(x, yy-LH-2-IH, w, IH, {fill:opts.fill||WHITE, stroke:BORDER, lw:0.6});
          // Draw value text visually
          if (value) txt(value, x+3, yy-LH-2-IH+IH/2-3.5, {size:7.5, color:BLACK, maxW:w-8, bold:opts.boldVal});
          // Register fillable field on top of the box
          addField(name, x, yy-LH-2-IH, w, IH, value, {multi:opts.multi});
          return LH+2+IH+PAD;
        };


        // Grid layout
        const grid = (fields, yy, cols=2, gapX=4) => {
          const cw=(CW-(cols-1)*gapX)/cols;
          const xs=Array.from({length:cols},(_,i)=>ML+i*(cw+gapX));
          let ci=0, rowY=yy, rowH=0;
          for (const fd2 of fields) {
            const span=fd2.wide?cols:1;
            const fw=cw*span+gapX*(span-1);
            const h=drawField(fd2.label, fd2.name, xs[ci], rowY, fw, fd2.value||'', {fh:fd2.fh, wrap:fd2.wrap, maxLines:fd2.maxLines, size:fd2.size});
            rowH=Math.max(rowH,h); ci+=span;
            if (ci>=cols){rowY-=rowH; rowH=0; ci=0;}
          }
          if (ci) rowY-=rowH;
          return rowY-2;
        };

        // Section header
        const secHdr = (num, label, yy) => {
          const H=13;
          rect(ML, yy-H, CW, H, {fill:NAVY});
          rect(ML+3, yy-H+1.5, 10, 10, {fill:AMBER});
          txt(String(num), ML+4.5, yy-H+2.5, {bold:true, size:6.5, color:NAVY});
          txt(label, ML+17, yy-H+3, {bold:true, size:7.5, color:WHITE});
          return yy-H-3;
        };

        // ── HEADER ───────────────────────────────────────────────────────────
        rect(ML, y-22, CW, 22, {fill:NAVY});
        rect(ML+4, y-18, 28, 14, {fill:WHITE});
        txt('SATCO', ML+5.5, y-15, {bold:true, size:8, color:NAVY});
        txt('SATCO Arabia General Contracting', ML+37, y-8, {bold:true, size:9, color:WHITE});
        txt('Abu Dhabi, UAE  |  satcoarabiaengg.com', ML+37, y-15, {size:6.5, color:rgb(0.69,0.82,0.99)});
        txt('CANDIDATE INTERVIEW SHEET', PW-MR-120, y-7, {bold:true, size:7.5, color:WHITE});
        txt('Date: '+dateStr, PW-MR-120, y-13, {size:6.5, color:rgb(0.69,0.82,0.99)});
        txt('Ref: '+refStr,   PW-MR-120, y-19, {size:6.5, color:rgb(0.69,0.82,0.99)});
        y -= 26;

        // ── S1: PERSONAL ─────────────────────────────────────────────────────
        y = secHdr(1,'PERSONAL & PASSPORT DETAILS', y);
        const relmarVal = (f('religion')||f('relmar')||'')+(f('marital')?' / '+f('marital'):'');
        y = grid([
          {label:'Full Name (as per Passport)', name:'candidate_name', value:f('name'), wide:true},
          {label:'Date of Birth',               name:'dob',            value:f('dob')},
          {label:'Nationality',                 name:'nationality',    value:f('nationality')},
          {label:'Religion / Marital Status',   name:'relmar',         value:relmarVal||f('relmar')},
        ], y, 4, 4);
        y = grid([
          {label:'Passport No.',       name:'passport_no',     value:f('passport_no')},
          {label:'Passport Expiry',    name:'passport_expiry', value:f('passport_expiry')},
          {label:'Current Location',   name:'current_location',value:f('location')},
          {label:'Mobile / WhatsApp',  name:'phone',           value:f('phone')},
          {label:'Referred By',        name:'referred_by',     value:f('referred_by')},
        ], y, 5, 4);
        y = grid([
          {label:'Email',              name:'email',     value:f('email')},
          {label:'Languages Known',    name:'languages', value:f('languages')},
          {label:'Permanent Address',  name:'address',   value:f('address')},
        ], y, 3, 4);

        // ── S2: EDUCATION + EXPERIENCE ────────────────────────────────────────
        y = secHdr(2,'EDUCATION & PROFESSIONAL EXPERIENCE', y);
        y = grid([
          {label:'Position Applied For (Resume)', name:'position_applied',    value:f('position_applied')},
          {label:'Years Experience',              name:'experience',          value:f('exp_years')},
          {label:'Current / Last Employer',       name:'current_employer',    value:f('curr_employer')},
          {label:'Current Designation',           name:'current_designation', value:f('curr_designation')},
          {label:'Highest Qualification',         name:'edu_level',           value:f('edu_level')},
        ], y, 5, 4);

        // Position Selected — green once confirmed, neutral while still pending
        const posApplied   = f('position_applied')||'—';
        const hasSelection = !!f('position_selected');
        const posSel        = f('position_selected')||'';
        const posChanged    = hasSelection && posSel !== posApplied;
        const PS_H = 16;
        rect(ML, y-PS_H, CW, PS_H, {fill: hasSelection?GREEN_B:WHITE, stroke: hasSelection?GREEN_D:BORDER, lw:0.8});
        txt('POSITION CONFIRMED / SELECTED AFTER INTERVIEW:', ML+4, y-7, {bold:true, size:6.5, color: hasSelection?GREEN_T:MGRAY});
        if (hasSelection) {
          if (posChanged) {
            txt('Applied: '+clip(posApplied,reg,7,80), ML+200, y-7, {size:6.5, color:DGRAY});
            txt(posSel, ML+290, y-7, {bold:true, size:9, color:GREEN_T, maxW:CW-300});
          } else {
            txt(posSel, ML+200, y-7, {bold:true, size:9, color:GREEN_T, maxW:CW-210});
          }
        } else {
          txt('Pending — to be confirmed after interview', ML+200, y-7, {size:7, color:MGRAY, maxW:CW-210});
        }
        // Fillable field for position_selected
        addField('position_selected', ML+195, y-PS_H+1, CW-200, PS_H-2, posSel);
        y -= PS_H + 2;

        y = grid([
          {label:'Key Skills & Competencies',          name:'skills',   value:f('skills'),   wrap:true, maxLines:16},
          {label:'Work History (All Companies & Periods)', name:'me_notes', value:f('me_notes'), wrap:true, maxLines:16},
        ], y, 2, 4);

        // ── S3: CERTIFICATIONS ────────────────────────────────────────────────
        y = secHdr(3,'CERTIFICATIONS & TRAINING', y);
        y = grid([
          {label:'Certifications & Training Held (HSE, technical, professional)', name:'other_certs', value:f('other_certs'), wide:true, wrap:true, maxLines:3},
        ], y, 1, 4);

        // ── S4: INTERVIEW ASSESSMENT ─────────────────────────────────────────
        y = secHdr(4,'INTERVIEW ASSESSMENT   (1 = Poor  |  3 = Average  |  5 = Excellent)', y);
        const CRITERIA = [
          ['Technical Knowledge', scores.technical||0, 'score_technical'],
          ['Communication Skills', scores.comm||0,     'score_comm'],
          ['Safety Awareness',    scores.safety||0,    'score_safety'],
          ['Experience Match',    scores.exp||0,       'score_exp'],
          ['Attitude & Discipline', scores.attitude||0,'score_attitude'],
          ['Certs & Documents',   scores.docs||0,      'score_docs'],
        ];
        const criW=(CW-5*3)/3;
        let criY=y;
        CRITERIA.forEach(([label,score,fieldName],idx) => {
          const cx=ML+(idx%3)*(criW+3);
          if (idx%3===0&&idx>0) criY-=22;
          txt(label.toUpperCase(), cx, criY-9, {bold:true, size:6, color:DGRAY});
          for (let n=1; n<=5; n++) {
            const bx=cx+(n-1)*13, filled=score>=n;
            rect(bx, criY-19, 11, 10, {fill:filled?NAVY:WHITE, stroke:filled?NAVY:BORDER, lw:0.6});
            txt(String(n), bx+3.5, criY-16, {bold:filled, size:6.5, color:filled?WHITE:MGRAY});
          }
          // Small editable score box
          const sfx=cx+5*13+3;
          rect(sfx, criY-19, 14, 10, {fill:WHITE, stroke:NAVY, lw:0.8});
          if (score) txt(String(score), sfx+4, criY-15, {bold:true, size:7, color:NAVY});
          addField(fieldName, sfx, criY-19, 14, 10, score?String(score):'');
        });
        y = criY - 22 - 4;

        // ── TWO COLUMNS: NOTES + SCORE/OFFER ─────────────────────────────────
        const COL_W=(CW-6)/2, LX=ML, RX=ML+COL_W+6;
        let ly=y, ry=y;

        // LEFT: Key Interview Notes / Remarks — prints whatever was actually typed into
        // the "Key Interview Notes / Remarks" box on screen (fk: int_notes). Previously this
        // was six decorative blank boxes with no on-screen inputs behind them at all, so the
        // printed sheet was always blank here and had to be filled in by hand after printing.
        txt('KEY INTERVIEW NOTES / REMARKS', LX, ly-8, {bold:true, size:6, color:NAVY});
        page.drawLine({start:{x:LX,y:ly-10},end:{x:LX+COL_W,y:ly-10},thickness:0.6,color:NAVY});
        ly -= 13;
        ly -= drawField('', 'note_general', LX, ly, COL_W, f('int_notes'), {wrap:true, size:7, maxLines:9, fh:60});
        ly -= 6;

        // RIGHT: Score + Recommendation + Offer
        txt('SCORE & RECOMMENDATION', RX, ry-8, {bold:true, size:6, color:NAVY});
        page.drawLine({start:{x:RX,y:ry-10},end:{x:RX+COL_W,y:ry-10},thickness:0.6,color:NAVY});
        ry -= 13;

        // Score display
        rect(RX+45, ry-17, 20, 14, {fill:NAVY});
        txt(String(totalScore||0), RX+50, ry-13, {bold:true, size:10, color:WHITE});
        addField('score_total', RX+45, ry-17, 20, 14, String(totalScore||''));
        txt('Total Score:', RX, ry-7, {size:7, color:DGRAY});
        txt('/ 30', RX+68, ry-11, {size:6.5, color:MGRAY});
        txt('Grade: '+grade.replace(/[^\x20-\x7E]/g,'').trim(), RX+85, ry-9, {bold:true, size:7, color:NAVY});
        ry -= 20;

        // Verdict buttons
        const VW=(COL_W-6)/3;
        [['selected','SELECTED',GRN_V],['onhold','ON HOLD',ORG_V],['rejected','NOT SUITABLE',RED_V]].forEach(([v,l,col],i) => {
          const vx=RX+i*(VW+3), isActive=f('verdict')===v;
          rect(vx, ry-13, VW, 12, {fill:isActive?col:WHITE, stroke:col, lw:isActive?0:0.8});
          txt(l, vx+VW/2-bold.widthOfTextAtSize(l,6)/2, ry-8.5, {bold:true, size:6, color:isActive?WHITE:col});
        });
        // Hidden verdict field
        addField('verdict', RX, ry-13, COL_W, 12, f('verdict')||'');
        ry -= 16;

        // Verdict notes
        txt('VERDICT / NOTES:', RX, ry-7, {bold:true, size:6, color:DGRAY});
        rect(RX, ry-20, COL_W, 12, {fill:WHITE, stroke:BORDER, lw:0.5});
        if (f('verdict_reason')) txt(f('verdict_reason'), RX+3, ry-16, {size:7, color:BLACK, maxW:COL_W-6});
        addField('verdict_reason', RX, ry-20, COL_W, 12, f('verdict_reason')||'');
        ry -= 23;

        // Offer header
        txt('OFFER & JOINING DETAILS', RX, ry-8, {bold:true, size:6, color:NAVY});
        page.drawLine({start:{x:RX,y:ry-10},end:{x:RX+COL_W,y:ry-10},thickness:0.6,color:NAVY});
        ry -= 13;

        // Salary row
        const salW=(COL_W-8)/3;
        drawField('Basic Salary (AED)', 'basic_salary', RX, ry, salW, f('basic_salary')||'', {fh:12});
        drawField('Allowance (AED)', 'allowance', RX+salW+4, ry, salW, f('allowance')||'', {fh:12});
        const ctcVal=((parseFloat(f('basic_salary'))||0)+(parseFloat(f('allowance'))||0));
        txt('TOTAL CTC (AED)', RX+2*(salW+4), ry-8, {bold:true, size:5.5, color:DGRAY});
        rect(RX+2*(salW+4), ry-22, salW, 12, {fill:GREEN_B, stroke:GREEN_D, lw:0.6});
        txt(ctcVal>0?ctcVal.toLocaleString():'—', RX+2*(salW+4)+3, ry-18, {bold:true, size:8, color:GREEN_T, maxW:salW-6});
        addField('total_ctc', RX+2*(salW+4), ry-22, salW, 12, ctcVal>0?String(ctcVal):'');
        ry -= 25;

        const joinW=(COL_W-4)/2;
        drawField('Expected Joining Date', 'joining_date',   RX, ry, joinW, f('joining_date')||'', {fh:12});
        drawField('Deployment Site',       'deployment_site', RX+joinW+4, ry, joinW, f('deployment')||'', {fh:12});
        ry -= 25;

        // Benefits
        txt('Benefits:', RX, ry-8, {bold:true, size:6, color:DGRAY});
        ['Accommodation','Transport','Food','Medical'].forEach((b,i) => {
          rect(RX+28+i*40, ry-9, 7, 7, {fill:WHITE, stroke:BORDER, lw:0.5});
          addCheck('benefit_'+b.toLowerCase(), RX+28+i*40, ry-9, 7);
          txt(b, RX+28+i*40+9, ry-7.5, {size:6.5, color:BLACK});
        });
        ry -= 12;
        drawField('Visa Category', 'visa_category', RX, ry, COL_W, f('visa_cat')||'', {fh:12});
        ry -= 16;

        // ── SIGN-OFF STRIP ────────────────────────────────────────────────────
        const bottomY=Math.min(ly,ry)-4;
        page.drawLine({start:{x:ML,y:bottomY},end:{x:ML+CW,y:bottomY},thickness:1.2,color:NAVY});
        const signY=bottomY-3;
        const SW=(CW-9)/4;
        [
          ['Interview Date',                    'interview_date', f('int_date')],
          ['Interview Mode',                    'interview_mode', f('int_mode')],
          ['Interviewed By (Name & Signature)', 'interviewed_by', f('int_by')],
          ['Approved By – HR Manager',          'approved_by',    ''],
        ].forEach(([label,fname2,value],i) => {
          drawField(label, fname2, ML+i*(SW+3), signY, SW, value, {fh:12});
        });

        // ── FOOTER ────────────────────────────────────────────────────────────
        const footerY=signY-30;
        page.drawLine({start:{x:ML,y:footerY+8},end:{x:ML+CW,y:footerY+8},thickness:0.5,color:NAVY});
        txt('SATCO Arabia General Contracting L.L.C – S.P.C  |  Licence No. CN-5912607  |  satcoarabiaengg.com',
          ML, footerY+3, {size:5.5, color:MGRAY});
        txt('CONFIDENTIAL  |  '+refStr, PW-MR-80, footerY+3, {bold:true, size:5.5, color:rgb(0.8,0,0)});

        // ── INJECT ACROFORM INTO PDF ──────────────────────────────────────────
        const acroFormRef = context.register(context.obj({
          Fields:          context.obj(allFields),
          NeedAppearances: PDFBool.True,
          DA:              PDFString.of('/Helv 8 Tf 0 g'),
        }));
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroFormRef);

        // ── DOWNLOAD ─────────────────────────────────────────────────────────
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes],{type:'application/pdf'});
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href=url; a.download=fname; a.click();
        URL.revokeObjectURL(url);
      };


            const savePdf = async () => {
        // Sweep DOM to capture any unfocused field values into fdRef before PDF generation
        document.querySelectorAll('#interviewSheetBody input, #interviewSheetBody select, #interviewSheetBody textarea').forEach(el => {
          const fk = el.getAttribute('data-fk');
          if (fk) { fdRef.current[fk] = el.value; }
        });
        setPdfGenerating(true);
        // ── Auto-save all form data to Supabase so dropdowns persist on re-open ──
        if (candidate.id) {
          try {
            const scoreTotal = Object.values(scores).reduce((a,b)=>a+b,0);
            const autoPatch = {
              candidate_name: f('name')||null, dob_candidate: f('dob')||null,
              nationality: f('nationality')||null, passport_no: f('passport_no')||null,
              passport_expiry_candidate: f('passport_expiry')||null,
              place_of_issue: f('place_of_issue')||null,
              religion: f('religion')||null,
              marital_status: f('marital')||null,
              phone: f('phone')||null, whatsapp: f('whatsapp')||null,
              email: f('email')||null,
              current_location: f('location')||null,
              languages: f('languages')||null,
              home_address: f('address')||null,
              referred_by: f('referred_by')||null,
              position: f('position_applied')||null,
              experience: f('exp_years')||null,
              current_employer: f('curr_employer')||null,
              current_designation: f('curr_designation')||null,
              skills: f('skills')||null,
              me_experience: f('me_experience')||null,
              me_notes: f('me_notes')||null,
              interview_date: f('int_date')||null,
              interviewed_by: f('int_by')||null,
              interview_mode: f('int_mode')||null,
              interview_notes: f('int_notes')||null,
              interview_verdict: f('verdict')||null,
              verdict_reason: f('verdict_reason')||null,
              interview_score: scoreTotal||null,
              interview_score_technical: scores.technical||null,
              interview_score_comm: scores.comm||null,
              interview_score_safety: scores.safety||null,
              interview_score_exp: scores.exp||null,
              interview_score_attitude: scores.attitude||null,
              interview_score_docs: scores.docs||null,
              interview_qa: Object.values(answers).filter(Boolean).join(' | ')||null,
              basic_salary: f('basic_salary')||null,
              allowance: f('allowance')||null,
              deployment_site: f('deployment')||null,
              visa_category: f('visa_cat')||null,
              accommodation: f('accommodation')||null,
              transport_by: f('transport')||null,
              food_by: f('food')||null,
              expected_arrival_date: f('joining_date')||null,
              offer_notes: f('offer_notes')||null,
              current_salary: f('curr_salary')||null,
              medical_conditions: f('medical_cond')||null,
              on_medication: f('on_medication')||null,
              colour_blindness: f('colour_blind')||null,
              vision_aids: f('vision')||null,
              fit_for_height: f('fit_height')||null,
              fit_for_cse: f('fit_cse')||null,
              gamka_result: f('gamka')||null,
              gamka_date: f('gamka_date')||null,
              medical_notes: f('medical_notes')||null,
              other_certifications: f('other_certs')||null,
              dependants_count: f('dependants')||null,
              children_count: f('children')||null,
              family_in_uae: f('family_uae')||null,
              emergency_contact: f('emergency_contact')||null,
            };
            const { data: apRows, error: apErr } = await dbSaveWithRetry('hiring_pipeline', autoPatch, candidate.id);
            if (apErr) { console.warn('Auto-save on PDF failed:', apErr.message); }
            else if (!apRows || apRows.length === 0) { console.warn('Auto-save on PDF affected 0 rows — check RLS policy.'); }
            // Update in-memory hiring array so Kanban reflects the save immediately (no candidate prop update)
            if (onHiringUpdate) onHiringUpdate({...autoPatch, id: candidate.id});
          } catch(e) { console.warn('Auto-save on PDF:', e.message); }
        }
        try { await printSheet(); } catch(e) { showToast('PDF error: '+e.message,'error'); console.error(e); }
        setPdfGenerating(false);
      };

      return (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.7)', zIndex:999, display:'flex', flexDirection:'column' }}>
          {/* Toolbar */}
          <div className="no-print" style={{ background:'#0f2744', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ background:'#1a56db', borderRadius:'8px', width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}><EmojiIcon e="🏢" /></div>
              <div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:'15px' }}>SATCO Arabia — Interview Sheet</div>
                <div style={{ color:'#93c5fd', fontSize:'11px' }}>
                  {f('name')||'New Candidate'} {f('position_applied') ? '· ' + f('position_applied') : ''}
                  {(candidate.resume_url||candidate.passport_img_url) && !autoScanned && <span style={{ color:'#fbbf24' }}> · Loading docs…</span>}
                  {autoScanned && !scanning && <span style={{ color:'#6ee7b7' }}> · Docs auto-filled</span>}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              {/* Scan status + multi-doc upload */}
              <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                {scanning && (
                  <div style={{ background:'#1e3a5f', color:'#93c5fd', padding:'5px 12px', borderRadius:'7px', fontSize:'12px', display:'flex', alignItems:'center', gap:'7px' }}>
                    <div style={{ width:'12px', height:'12px', border:'2px solid #3b82f6', borderTopColor:'#93c5fd', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}></div>
                    {scanMsg||'Scanning…'}
                  </div>
                )}
                {scanFiles.map((sf,i) => (
                  <div key={i} style={{ background:'#1e3a5f', color:'#93c5fd', padding:'4px 8px', borderRadius:'5px', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px', maxWidth:'130px' }}>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={sf.name}>{sf.name.length>14 ? sf.name.slice(0,12)+'…' : sf.name}</span>
                    <button type="button" onClick={()=>removeScanFile(i)} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', fontSize:'13px', lineHeight:1, padding:0, flexShrink:0 }}><EmojiIcon e="✕" /></button>
                  </div>
                ))}
                <label style={{ background:'#334155', color:'#fff', padding:'6px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:600, cursor:scanning?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:'5px', opacity:scanning?0.6:1 }}><EmojiIcon e="➕" /> Add Doc<input type="file" accept=".pdf,image/*" style={{ display:'none' }} disabled={scanning} multiple onChange={e=>{ Array.from(e.target.files).forEach(f=>addScanFile(f)); e.target.value=''; }} />
                </label>
                {scanFiles.length > 0 && (
                  <button type="button" onClick={scanAllDocs} disabled={scanning}
                    style={{ background: scanning?'#334155':'#059669', color:'#fff', border:'none', padding:'6px 12px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:scanning?'not-allowed':'pointer' }}>
                    {scanning ? `⏳ ${scanMsg||'Scanning…'}` : `🔍 Scan ${scanFiles.length} Doc${scanFiles.length>1?'s':''}`}
                  </button>
                )}
                {scanFiles.length === 0 && !scanning && (
                  <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>
                    {(candidate.resume_url||candidate.passport_img_url) ? '+ Add more docs if needed' : 'Add resume + passport to scan'}
                  </span>
                )}
              </div>
              <button onClick={savePdf} disabled={pdfGenerating} style={{ background: pdfGenerating?'#334155':'#d97706', color:'#fff', border:'none', padding:'7px 14px', borderRadius:'7px', fontSize:'12px', fontWeight:600, cursor: pdfGenerating?'wait':'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                {pdfGenerating ? <span style={{display:'flex',alignItems:'center',gap:'6px'}}><div style={{ width:'11px', height:'11px', border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}></div>Building PDF…</span> : '⬇ Save as PDF'}
              </button>
              {candidate.id && (
                <button onClick={async () => {
                  setSaving(true);
                  try {
                  // Sweep all inputs/selects/textareas in the sheet to catch any unfocused values
                  document.querySelectorAll('#interviewSheetBody input, #interviewSheetBody select, #interviewSheetBody textarea').forEach(el => {
                    const fk = el.getAttribute('data-fk');
                    if (fk) { fdRef.current[fk] = el.value; }
                  });
                  const scoreTotal = Object.values(scores).reduce((a,b)=>a+b,0);
                  const patch = {
                    id: candidate.id,
                    candidate_name: f('name')||null, dob_candidate: f('dob')||null,
                    nationality: f('nationality')||null, passport_no: f('passport_no')||null,
                    passport_expiry_candidate: f('passport_expiry')||null,
                    place_of_issue: f('place_of_issue')||null, religion: f('religion')||null,
                    marital_status: f('marital')||null, phone: f('phone')||null,
                    whatsapp: f('whatsapp')||null, email: f('email')||null,
                    current_location: f('location')||null, languages: f('languages')||null,
                    home_address: f('address')||null, referred_by: f('referred_by')||null,
                    position: f('position_applied')||null,
                    position_selected: f('position_selected')||null, experience: f('exp_years')||null,
                    current_employer: f('curr_employer')||null,
                    current_designation: f('curr_designation')||null,
                    skills: f('skills')||null, me_experience: f('me_experience')||null,
                    work_history: f('work_history')||f('me_notes')||null,
                    me_notes: f('me_notes')||null,
                    dependants_count: f('dependants')||null, children_count: f('children')||null,
                    family_in_uae: f('family_uae')||null,
                    emergency_contact: f('emergency_contact')||null,
                    interview_date: f('int_date')||null, interviewed_by: f('int_by')||null,
                    interview_mode: f('int_mode')||null, interview_notes: f('int_notes')||null,
                    interview_verdict: f('verdict') !== '' ? f('verdict') : null, verdict_reason: f('verdict_reason')||null,
                    interview_score: scoreTotal || null,
                    interview_score_technical: scores.technical || null,
                    interview_score_comm: scores.comm || null,
                    interview_score_safety: scores.safety || null,
                    interview_score_exp: scores.exp || null,
                    interview_score_attitude: scores.attitude || null,
                    interview_score_docs: scores.docs || null,
                    interview_qa: Object.values(answers).filter(Boolean).join(' | ') || null,
                    basic_salary: f('basic_salary')||null, allowance: f('allowance')||null,
                    deployment_site: f('deployment')||null, visa_category: f('visa_cat')||null,
                    accommodation: f('accommodation')||null,
                    medical_conditions: f('medical_cond')||null,
                    on_medication: f('on_medication')||null,
                    colour_blindness: f('colour_blind')||null,
                    fit_for_height: f('fit_height')||null,
                    fit_for_cse: f('fit_cse')||null,
                    gamka_result: f('gamka')||null, gamka_date: f('gamka_date')||null,
                    medical_notes: f('medical_notes')||null,
                    // Offer fields
                    current_salary: f('curr_salary')||null,
                    accommodation: f('accommodation')||null,
                    transport_by: f('transport')||null,
                    food_by: f('food')||null,
                    expected_arrival_date: f('joining_date')||null,
                    visa_category: f('visa_cat')||null,
                    offer_notes: f('offer_notes')||null,
                    // Medical fields
                    on_medication: f('on_medication')||null,
                    colour_blindness: f('colour_blind')||null,
                    vision_aids: f('vision')||null,
                    fit_for_height: f('fit_height')||null,
                    fit_for_cse: f('fit_cse')||null,
                    // Family
                    other_certifications: f('other_certs')||null,
                    dependants_count: f('dependants')||null,
                    children_count: f('children')||null,
                    family_in_uae: f('family_uae')||null,
                    emergency_contact: f('emergency_contact')||null,
                    // NOTE: stage/step is no longer auto-advanced here — moving stages is a
                    // deliberate action via the "Move to next stage" button on the pipeline board.
                  };
                  const { data: savedRows, error } = await dbSaveWithRetry('hiring_pipeline', patch, candidate.id);
                  if (error) { showToast('❌ Save failed: ' + error.message, 'error'); }
                  else if (!savedRows || savedRows.length === 0) { showToast('❌ Save affected 0 rows — check Supabase RLS policy on hiring_pipeline UPDATE.', 'error'); }
                  else {
                    // Update BOTH fdRef AND fd React state so ALL controlled dropdowns re-render correctly
                    const fdUpdate = {
                      name:            patch.candidate_name                  || fdRef.current.name,
                      dob:             patch.dob_candidate                   || fdRef.current.dob,
                      nationality:     patch.nationality                     || fdRef.current.nationality,
                      passport_no:     patch.passport_no                    || fdRef.current.passport_no,
                      passport_expiry: patch.passport_expiry_candidate       || fdRef.current.passport_expiry,
                      place_of_issue:  patch.place_of_issue                 || fdRef.current.place_of_issue,
                      religion:        patch.religion                        || fdRef.current.religion,
                      marital:         patch.marital_status                  || fdRef.current.marital,
                      phone:           patch.phone                           || fdRef.current.phone,
                      whatsapp:        patch.whatsapp                        || fdRef.current.whatsapp,
                      email:           patch.email                           || fdRef.current.email,
                      location:        patch.current_location                || fdRef.current.location,
                      languages:       patch.languages                       || fdRef.current.languages,
                      address:         patch.home_address                    || fdRef.current.address,
                      referred_by:     patch.referred_by                     || fdRef.current.referred_by,
                      position_applied:patch.position                        || fdRef.current.position_applied,
                      position_selected:patch.position_selected                 || fdRef.current.position_selected,
                      exp_years:       patch.experience                      || fdRef.current.exp_years,
                      curr_employer:   patch.current_employer                || fdRef.current.curr_employer,
                      curr_designation:patch.current_designation             || fdRef.current.curr_designation,
                      skills:          patch.skills                          || fdRef.current.skills,
                      me_experience:   patch.me_experience                   || fdRef.current.me_experience,
                      work_history:    patch.work_history                    || fdRef.current.work_history,
                      me_notes:        patch.me_notes                        || fdRef.current.me_notes,
                      basic_salary:    patch.basic_salary                    || fdRef.current.basic_salary,
                      allowance:       patch.allowance                       || fdRef.current.allowance,
                      int_date:        patch.interview_date                  || fdRef.current.int_date,
                      int_by:          patch.interviewed_by                  || fdRef.current.int_by,
                      int_mode:        patch.interview_mode                  || fdRef.current.int_mode,
                      verdict:         patch.interview_verdict != null ? patch.interview_verdict : fdRef.current.verdict,
                      verdict_reason:  patch.verdict_reason                  || fdRef.current.verdict_reason,
                      medical_cond:    patch.medical_conditions              || fdRef.current.medical_cond,
                      on_medication:   patch.on_medication                   || fdRef.current.on_medication,
                      colour_blind:    patch.colour_blindness                || fdRef.current.colour_blind,
                      vision:          patch.vision_aids                     || fdRef.current.vision,
                      fit_height:      patch.fit_for_height                  || fdRef.current.fit_height,
                      fit_cse:         patch.fit_for_cse                     || fdRef.current.fit_cse,
                      gamka:           patch.gamka_result                    || fdRef.current.gamka,
                      gamka_date:      patch.gamka_date                      || fdRef.current.gamka_date,
                      medical_notes:   patch.medical_notes                   || fdRef.current.medical_notes,
                      other_certs:     patch.other_certifications            || fdRef.current.other_certs,
                      dependants:      patch.dependants_count                || fdRef.current.dependants,
                      children:        patch.children_count                  || fdRef.current.children,
                      family_uae:      patch.family_in_uae                   || fdRef.current.family_uae,
                      emergency_contact:patch.emergency_contact              || fdRef.current.emergency_contact,
                      deployment:      patch.deployment_site                 || fdRef.current.deployment,
                      visa_cat:        patch.visa_category                   || fdRef.current.visa_cat,
                      accommodation:   patch.accommodation                   || fdRef.current.accommodation,
                      transport:       patch.transport_by                    || fdRef.current.transport,
                      food:            patch.food_by                         || fdRef.current.food,
                      joining_date:    patch.expected_arrival_date           || fdRef.current.joining_date,
                      offer_notes:     patch.offer_notes                     || fdRef.current.offer_notes,
                    };
                    Object.assign(fdRef.current, fdUpdate);
                    setFd(prev => ({ ...prev, ...fdUpdate }));
                    showToast('✅ All data saved — sheet stays open for review');
                    if (onAfterSave) onAfterSave(patch);
                    if (onReload) onReload(); // Force DB refresh so verdict/scores show immediately everywhere
                  }
                  } catch(e) { showToast('❌ Error: ' + e.message, 'error'); console.error(e); }
                  finally { setSaving(false); }
                }} disabled={saving} data-save-candidate-btn style={{ background: saving ? '#047857' : '#059669', color:'#fff', border:'none', padding:'7px 14px', borderRadius:'7px', fontSize:'12px', fontWeight:600, cursor: saving ? 'wait' : 'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                  {saving ? <><span style={{display:'inline-block',width:'10px',height:'10px',border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></span> Saving…</> : '💾 Save to Candidate'}
                </button>
              )}
              <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', padding:'7px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Close</button>
            </div>
          </div>

          {/* Scrollable body — Compact A4 single-page layout */}
          <div style={{ flex:1, overflowY:'auto', padding:'14px 18px', background:'#eef2f7' }} id="interviewSheetBody">

            <div style={{ background:'#fff', border:'1px solid var(--bd2)', borderRadius:'10px', overflow:'hidden', maxWidth:'860px', margin:'0 auto', fontSize:'11px' }}>

              {/* ── HEADER ── */}
              <div style={{ background:'#0d2240', color:'#fff', padding:'7px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ background:'#fff', color:'#0d2240', fontWeight:900, fontSize:'12pt', padding:'2px 7px', borderRadius:'3px', letterSpacing:'1px' }}>SATCO</div>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:700 }}>SATCO Arabia General Contracting</div>
                    <div style={{ fontSize:'8px', color:'#b0c4de' }}>Abu Dhabi, UAE &nbsp;|&nbsp; satcoarabiaengg.com</div>
                  </div>
                </div>
                <div style={{ textAlign:'right', fontSize:'8px', color:'#b0c4de' }}>
                  <div style={{ fontWeight:700, color:'#fff', fontSize:'9px' }}>CANDIDATE INTERVIEW SHEET</div>
                  <div>Date: {new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
                  <div>Ref: SATCO/HR/{new Date().getFullYear()}/{String(new Date().getMonth()+1).padStart(2,'0')}{String(new Date().getDate()).padStart(2,'0')}</div>
                </div>
              </div>

              {/* ── S1: PERSONAL ── */}
              <SecHdr num={1} label="PERSONAL & PASSPORT DETAILS" />
              <div style={{ padding:'5px 10px 2px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:'3px 8px', marginBottom:'3px' }}>
                  <CF fd={fd} setField={setField} label="Full Name (as per Passport)" fk="name" compact />
                  <CF fd={fd} setField={setField} label="Date of Birth" fk="dob" type="date" compact />
                  <CF fd={fd} setField={setField} label="Nationality" fk="nationality" compact opts={['Indian','Pakistani','Bangladeshi','Sri Lankan','Nepali','Filipino','Egyptian','Sudanese','Ethiopian','Other']} />
                  <CF fd={fd} setField={setField} label="Religion / Marital Status" fk="relmar" compact />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:'3px 8px', marginBottom:'3px' }}>
                  <CF fd={fd} setField={setField} label="Passport No." fk="passport_no" compact />
                  <CF fd={fd} setField={setField} label="Passport Expiry" fk="passport_expiry" type="date" compact />
                  <CF fd={fd} setField={setField} label="Current Location" fk="location" compact opts={['India','UAE','Pakistan','Bangladesh','Sri Lanka','Nepal','Philippines','Oman','Saudi Arabia','Qatar','Kuwait','Bahrain','Other']} />
                  <CF fd={fd} setField={setField} label="Mobile / WhatsApp" fk="phone" compact />
                  <CF fd={fd} setField={setField} label="Referred By" fk="referred_by" compact />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'3px 8px', paddingBottom:'5px', borderBottom:'1px solid var(--bd1)' }}>
                  <CF fd={fd} setField={setField} label="Email" fk="email" compact />
                  <CF fd={fd} setField={setField} label="Languages Known" fk="languages" compact />
                  <CF fd={fd} setField={setField} label="Permanent Address" fk="address" compact />
                </div>
              </div>

              {/* ── S2: EDUCATION + EXPERIENCE ── */}
              <SecHdr num={2} label="EDUCATION & PROFESSIONAL EXPERIENCE" />
              <div style={{ padding:'5px 10px 2px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:'3px 8px', marginBottom:'3px' }}>
                  <CF fd={fd} setField={setField} label="Position Applied For (Resume)" fk="position_applied" compact />
                  <CF fd={fd} setField={setField} label="Years Experience" fk="exp_years" compact />
                  <CF fd={fd} setField={setField} label="Current / Last Employer" fk="curr_employer" compact />
                  <CF fd={fd} setField={setField} label="Current Designation" fk="curr_designation" compact />
                  <CF fd={fd} setField={setField} label="Highest Qualification" fk="edu_level" compact />
                </div>
                {/* ── POSITION SELECTED — prominent green row ── */}
                <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:'6px', padding:'5px 8px', marginBottom:'4px', display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ flexShrink:0 }}>
                    <div style={{ fontSize:'7.5px', fontWeight:800, color:'#059669', textTransform:'uppercase', letterSpacing:'0.3px', marginBottom:'2px' }}>
                      ✅ Position Confirmed / Selected After Interview
                    </div>
                    <div style={{ fontSize:'8.5px', color:'#64748b' }}>
                      Applied for: <strong style={{ color:'#0f172a' }}>{f('position_applied')||'—'}</strong>
                      &nbsp;→&nbsp; Interviewer selected as:
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    <input data-fk="position_selected" type="text"
                      value={fd['position_selected']||''}
                      onChange={e=>setField('position_selected', e.target.value)}
                      placeholder={f('position_applied') ? 'e.g. '+f('position_applied')+' (or different role if changed)' : 'Enter confirmed position title…'}
                      style={{ width:'100%', padding:'4px 8px', border:'2px solid #86efac', borderRadius:'5px',
                        fontSize:'12px', fontWeight:700, color:'#166534', background:'#fff', fontFamily:'inherit' }} />
                  </div>
                  <button type="button" onClick={() => setField('position_selected', f('position_applied'))}
                    title="Same as applied" style={{ flexShrink:0, background:'#e2e8f0', border:'1px solid var(--bd2)',
                      borderRadius:'5px', padding:'4px 8px', fontSize:'9px', fontWeight:600, cursor:'pointer', color:'#475569', whiteSpace:'nowrap' }}>Same</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 8px', paddingBottom:'5px', borderBottom:'1px solid var(--bd1)' }}>
                  <CF fd={fd} setField={setField} label="Key Skills & Competencies" fk="skills" type="textarea" minHeight="64px" />
                  <CF fd={fd} setField={setField} label="Work History (All Companies & Periods)" fk="me_notes" type="textarea" minHeight="64px" />
                </div>
              </div>

              {/* ── S3: CERTIFICATIONS ── */}
              <SecHdr num={3} label="CERTIFICATIONS & TRAINING" />
              <div style={{ padding:'5px 10px 8px' }}>
                <CF fd={fd} setField={setField} label="Certifications & Training Held (list all — HSE, technical, professional)" fk="other_certs" type="textarea" minHeight="18px" />
              </div>

              {/* ── S4: INTERVIEW ASSESSMENT ── */}
              <SecHdr num={4} label="INTERVIEW ASSESSMENT   (1 = Poor   3 = Average   5 = Excellent)" />
              <div style={{ padding:'5px 10px 3px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'5px 14px', marginBottom:'5px' }}>
                  {[['technical','Technical Knowledge'],['comm','Communication Skills'],['safety','Safety Awareness'],
                    ['exp','Experience Match'],['attitude','Attitude & Discipline'],['docs','Certs & Documents']].map(([k,label]) => (
                    <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'6px' }}>
                      <span style={{ fontSize:'9.5px', color:'#222', flex:1 }}>{label}</span>
                      <div style={{ display:'flex', gap:'2px' }}>
                        {[1,2,3,4,5].map(n => (
                          <button key={n} type="button" onClick={() => setScores(p=>({...p,[k]:n}))}
                            style={{ width:'17px', height:'17px', borderRadius:'3px', border:'1px solid',
                              borderColor: scores[k]>=n ? '#0d2240' : '#cbd5e1',
                              background: scores[k]>=n ? '#0d2240' : '#f8fafc',
                              color: scores[k]>=n ? '#fff' : '#0d2240',
                              fontWeight:700, fontSize:'9px', cursor:'pointer', fontFamily:'monospace', padding:0 }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── KEY NOTES + SCORE/OFFER — two columns ── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px', padding:'0 10px 6px' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:'7.5px', color:'#0d2240', textTransform:'uppercase', borderBottom:'1px solid #0d2240', paddingBottom:'1px', marginBottom:'4px' }}>Key Interview Notes / Remarks</div>
                  <div style={{ fontSize:'7px', color:'#888', marginBottom:'2px' }}>Trade experience, projects/clients, PTW familiarity, salary expectation, site rotations, visa issues, etc.</div>
                  <textarea data-fk="int_notes" value={fd['int_notes']||''} onChange={e=>setField('int_notes',e.target.value)}
                    placeholder="Type notes here during the interview…"
                    style={{ width:'100%', border:'1px solid #bbb', borderRadius:'3px', padding:'3px 5px', fontSize:'10px', minHeight:'86px', fontFamily:'inherit', resize:'vertical' }} />
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:'7.5px', color:'#0d2240', textTransform:'uppercase', borderBottom:'1px solid #0d2240', paddingBottom:'1px', marginBottom:'4px' }}>Score & Recommendation</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px' }}>
                    <span style={{ fontSize:'10px', color:'#444' }}>Total Score:</span>
                    <span style={{ fontSize:'20px', fontWeight:900, color:'#0d2240', borderBottom:'1px solid #0d2240', minWidth:'28px', textAlign:'center', fontFamily:'monospace', lineHeight:1.1 }}>{totalScore||'—'}</span>
                    <span style={{ fontSize:'9px', color:'#888' }}>/ 30</span>
                    <span style={{ fontSize:'10px', color:'#444', marginLeft:'8px' }}>Grade:</span>
                    <span style={{ fontSize:'14px', fontWeight:900, color:'#0d2240', borderBottom:'1px solid #0d2240', minWidth:'22px', textAlign:'center' }}>{grade.replace(/[^ -~]/g,'').trim()}</span>
                  </div>
                  <div style={{ display:'flex', gap:'5px', marginBottom:'5px', flexWrap:'wrap' }}>
                    {[['selected','✔ SELECTED','#2e7d32'],['onhold','⏸ ON HOLD','#e65100'],['rejected','✗ NOT SUITABLE','#b71c1c']].map(([v,l,col]) => (
                      <button key={v} type="button" onClick={async () => {
                        setField('verdict', v);
                        if (candidate && candidate.id) {
                          try {
                            const { data: vRows, error } = await db.from('hiring_pipeline').update({ interview_verdict: v }).eq('id', candidate.id).select();
                            if (error) showToast('Save failed: ' + error.message, 'error');
                            else if (!vRows || vRows.length === 0) showToast('❌ Save affected 0 rows — check RLS policy.', 'error');
                            else { showToast(v==='selected'?'Verdict: Selected':v==='onhold'?'Verdict: On Hold':'Verdict: Not Suitable'); if (onAfterSave) onAfterSave({ id: candidate.id, interview_verdict: v }); if (onHiringUpdate) onHiringUpdate({ id: candidate.id, interview_verdict: v }); }
                          } catch(e) { showToast('Error: ' + e.message, 'error'); }
                        }
                      }}
                        style={{ flex:1, padding:'4px 6px', borderRadius:'5px', border:'2px solid',
                          borderColor: f('verdict')===v ? col : '#e2e8f0', background: f('verdict')===v ? col : '#f8fafc',
                          color: f('verdict')===v ? '#fff' : col, fontWeight:700, fontSize:'8.5px', cursor:'pointer', fontFamily:'inherit', minWidth:'70px' }}>
                        <EmojiLabel text={l} size={9} gap={3} />
                      </button>
                    ))}
                  </div>
                  <div style={{ marginBottom:'5px' }}>
                    <div style={{ fontSize:'7.5px', fontWeight:700, color:'#555', textTransform:'uppercase', marginBottom:'2px' }}>Verdict / Interviewer Notes</div>
                    <textarea data-fk="verdict_reason" value={fd['verdict_reason']||''} onChange={e=>setField('verdict_reason',e.target.value)}
                      style={{ width:'100%', border:'1px solid #bbb', borderRadius:'3px', padding:'2px 4px', fontSize:'10px', minHeight:'22px', fontFamily:'inherit', resize:'none' }} />
                  </div>
                  <div style={{ fontWeight:700, fontSize:'7.5px', color:'#0d2240', textTransform:'uppercase', borderBottom:'1px solid #0d2240', paddingBottom:'1px', marginTop:'5px', marginBottom:'4px' }}>Offer & Joining Details</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'3px 6px', marginBottom:'3px' }}>
                    <CF fd={fd} setField={setField} label="Basic Salary (AED)" fk="basic_salary" compact />
                    <CF fd={fd} setField={setField} label="Allowance (AED)" fk="allowance" compact />
                    <div>
                      <div style={{ fontSize:'7.5px', fontWeight:700, color:'#555', textTransform:'uppercase', marginBottom:'1px' }}>Total CTC (AED)</div>
                      <div style={{ border:'1px solid #bbb', borderRadius:'3px', padding:'2px 4px', fontSize:'10px', fontWeight:700, color:'#0d2240', background:'#f0fdf4', textAlign:'center', minHeight:'18px' }}>
                        {((parseFloat(f('basic_salary'))||0)+(parseFloat(f('allowance'))||0)) > 0 ? ((parseFloat(f('basic_salary'))||0)+(parseFloat(f('allowance'))||0)).toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 6px', marginBottom:'3px' }}>
                    <CF fd={fd} setField={setField} label="Expected Joining Date" fk="joining_date" type="date" compact />
                    <CF fd={fd} setField={setField} label="Deployment Site" fk="deployment" compact />
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'5px', flexWrap:'wrap', marginBottom:'3px' }}>
                    <span style={{ fontSize:'7.5px', fontWeight:700, color:'#555', textTransform:'uppercase' }}>Benefits:</span>
                    {['Accommodation','Transport','Food','Medical'].map(b => (
                      <label key={b} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'9px' }}>
                        <input type="checkbox" style={{ width:'10px', height:'10px' }} /> {b}
                      </label>
                    ))}
                    <CF fd={fd} setField={setField} label="Visa Cat." fk="visa_cat" compact opts={['Employment Visa (Fresh)','Visit Visa conversion','Transfer from current employer']} />
                  </div>
                </div>
              </div>

              {/* ── SIGN-OFF STRIP ── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'3px 10px', borderTop:'2px solid #0d2240', padding:'5px 10px 7px' }}>
                <CF fd={fd} setField={setField} label="Interview Date" fk="int_date" type="date" compact />
                <CF fd={fd} setField={setField} label="Interview Mode" fk="int_mode" compact opts={['In-person (Abu Dhabi)','In-person (Dubai)','Video Call (WhatsApp)','Video Call (Teams)','Telephone']} />
                <CF fd={fd} setField={setField} label="Interviewed By (Name & Signature)" fk="int_by" compact />
                <div>
                  <div style={{ fontSize:'7.5px', fontWeight:700, color:'#555', textTransform:'uppercase', marginBottom:'1px' }}>Approved By – HR Manager</div>
                  <div style={{ borderBottom:'1px solid #aaa', minHeight:'18px' }}></div>
                </div>
              </div>

              {/* FOOTER */}
              <div style={{ borderTop:'1px solid #0d2240', padding:'3px 10px', display:'flex', justifyContent:'space-between', fontSize:'7px', color:'#888', background:'#fafafa' }}>
                <span>SATCO Arabia General Contracting L.L.C – S.P.C &nbsp;|&nbsp; Licence No. CN-5912607 &nbsp;|&nbsp; satcoarabiaengg.com</span>
                <span style={{ color:'#c00', fontWeight:700 }}>CONFIDENTIAL</span>
              </div>
            </div>

          </div>{/* end scrollable body */}
        </div>
      );
    }

    // ============================================================
    // INTERVIEW SHEET VIEW — embedded in HR portal nav
    // ============================================================
    function InterviewSheetView({ hiring, showToast, onOpenSheet }) {
      const [search, setSearch] = useState('');
      const [filter, setFilter] = useState('active');

      // A candidate is "done with" the Interview Sheet once they've been Selected AND moved
      // past the interview step (i.e. progressed into offer/visa stages), or once they've been
      // marked Rejected. Those candidates' sheets are already filled & saved — keeping them in
      // this working queue forever just adds noise. They remain fully visible in Hiring Pipeline
      // and Resume Database; this view's job is just "who still needs a sheet handled".
      const isRejected = c => c.interview_verdict === 'rejected';
      const isProgressed = c => c.interview_verdict === 'selected' && c.step !== 'resume' && c.step !== 'interview';
      const isArchived = c => isRejected(c) || isProgressed(c);

      const candidates = hiring.filter(c => {
        if (filter === 'active') return !isArchived(c);
        if (filter === 'onhold') return c.interview_verdict === 'onhold';
        if (filter === 'pending') return c.step === 'resume' && !c.interview_date;
        return true; // 'all'
      }).filter(c => !search || (c.candidate_name||'').toLowerCase().includes(search.toLowerCase()) || (c.position||'').toLowerCase().includes(search.toLowerCase()));

      const gradeLabel = (score) => {
        const s = parseInt(score)||0;
        if (s >= 26) return { l:'Excellent', c:'#059669', bg:'#dcfce7' };
        if (s >= 21) return { l:'Good', c:'#2563eb', bg:'#dbeafe' };
        if (s >= 17) return { l:'Average', c:'#d97706', bg:'#fef3c7' };
        if (s > 0)   return { l:'Low', c:'#dc2626', bg:'#fee2e2' };
        return { l:'Not scored', c:'#94a3b8', bg:'#f1f5f9' };
      };

      const verdictBadge = (v) => {
        if (v === 'selected') return { l:'✅ Selected', c:'#059669', bg:'#dcfce7' };
        if (v === 'onhold')   return { l:'⏸ On Hold', c:'#d97706', bg:'#fef3c7' };
        if (v === 'rejected') return { l:'❌ Not Suitable', c:'#dc2626', bg:'#fee2e2' };
        return { l:'Pending', c:'#94a3b8', bg:'#f1f5f9' };
      };

      const openSheet = (c) => { onOpenSheet(c); return; // replaced window.open
        const params = new URLSearchParams({
          name: c.candidate_name||'', position: c.position_selected||c.position||'', nationality: c.nationality||'',
          passport_no: c.passport_no||'', passport_expiry: c.passport_expiry_candidate||'',
          phone: c.phone||'', email: c.email||'', location: c.current_location||'',
          experience: c.experience||'', employer: c.current_employer||'', designation: c.current_designation||'',
          education: c.education||'', skills: c.skills||'', referred_by: c.referred_by||'',
          dob: c.dob_candidate||'', marital: c.marital_status||'', religion: c.religion||'',
          languages: c.languages||'', address: c.home_address||'',
          score_technical: c.interview_score_technical||'', score_comm: c.interview_score_comm||'',
          score_safety: c.interview_score_safety||'', score_exp: c.interview_score_exp||'',
          score_attitude: c.interview_score_attitude||'', score_docs: c.interview_score_docs||'',
          verdict: c.interview_verdict||'', verdict_reason: c.verdict_reason||'',
          int_notes: c.interview_notes||'', int_date: c.interview_date||'', int_mode: c.interview_mode||'',
          int_by: c.interviewed_by||'', basic_salary: c.basic_salary||'', allowance: c.allowance||'',
          deployment: c.deployment_site||'', me_exp: c.me_experience||'', me_notes: c.me_notes||'',
          medical: c.medical_conditions||'', gamka: c.gamka_result||'', gamka_date: c.gamka_date||'',
        });
        onOpenSheet(c); // opens overlay inside app
      };

      const scored = hiring.filter(c => c.interview_score > 0);
      const avgScore = scored.length ? (scored.reduce((a,c)=>a+(parseInt(c.interview_score)||0),0)/scored.length).toFixed(1) : '—';
      const selected = hiring.filter(c => c.interview_verdict === 'selected').length;
      const pending = hiring.filter(c => !c.interview_date).length;
      const inQueue = hiring.filter(c => !isArchived(c)).length;

      return (
        <div>
          {/* KPI Row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'In Queue', value: inQueue, icon:'👥', color:'#2563eb' },
              { label:'Interviews Done', value: scored.length, icon:'🎙️', color:'#059669' },
              { label:'Avg Score / 30', value: avgScore, icon:'⭐', color:'#d97706' },
              { label:'Selected', value: selected, icon:'✅', color:'#059669' },
            ].map(k => (
              <div key={k.label} className="hr-card" style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'20px', marginBottom:'6px' }}>{k.icon}</div>
                <div style={{ fontSize:'24px', fontWeight:800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Info Banner */}
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'12px 18px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'12px' }}>
            <span style={{ fontSize:'20px' }}><EmojiIcon e="📝" /></span>
            <div style={{ fontSize:'12.5px', color:'#1e40af', lineHeight:1.6 }}>
              <strong>Interview Sheet Generator</strong> — Click <strong><EmojiIcon e="📝" /> Open Sheet</strong> on any candidate to launch the printable A4 interview form with their details pre-filled.
              The sheet is also accessible from the <strong><EmojiIcon e="🎙" /> Interview tab</strong> inside each candidate record in the Hiring Pipeline.
              <strong> Active</strong> (default) hides candidates who are Rejected or already Selected & progressed past Interview — their sheets are done and the full record stays in <strong>Hiring Pipeline</strong> / <strong>Resume Database</strong>. Use <strong>All</strong> to see everyone.
            </div>
          </div>

          {/* Filters */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'12px 16px', marginBottom:'12px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search candidate or position…"
              style={{ flex:1, minWidth:'200px', padding:'7px 10px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'13px' }} />
            {[['active','Active'],['pending','Pending Interview'],['onhold','On Hold'],['all','All']].map(([v,l]) => (
              <button key={v} onClick={()=>setFilter(v)} style={{
                padding:'8px 16px', borderRadius:'16px', border:'1px solid', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                background: filter===v ? '#2563eb' : '#475569', color: '#fff',
                borderColor: filter===v ? '#2563eb' : 'transparent'
              }}>{l}</button>
            ))}
          </div>

          {/* Candidate Cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {candidates.length === 0 ? (
              <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'40px', textAlign:'center', color:'#94a3b8' }}>
                {filter === 'active'
                  ? <>No candidates in the active queue. <button onClick={()=>setFilter('all')} style={{ background:'none', border:'none', color:'#2563eb', textDecoration:'underline', cursor:'pointer', fontSize:'inherit', fontFamily:'inherit' }}>Show all candidates</button> to see Rejected / Selected & progressed ones.</>
                  : 'No candidates match the filter.'}
              </div>
            ) : candidates.map(c => {
              const grade = gradeLabel(c.interview_score);
              const verdict = verdictBadge(c.interview_verdict);
              const scoreCols = [
                { l:'Tech', v: c.interview_score_technical },
                { l:'Comm', v: c.interview_score_comm },
                { l:'Safety', v: c.interview_score_safety },
                { l:'Exp', v: c.interview_score_exp },
                { l:'Attitude', v: c.interview_score_attitude },
                { l:'Certs', v: c.interview_score_docs },
              ];
              return (
                <div key={c.id} className="hr-card" onClick={()=>openSheet(c)} title="Click to open Interview Sheet" style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'14px 18px', cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
                    {/* Left: identity */}
                    <div style={{ flex:1, minWidth:'180px' }}>
                      <div style={{ fontWeight:700, fontSize:'14px', color:'#0f172a' }}>{c.candidate_name||'(no name)'}</div>
                      <div style={{ fontSize:'12px', color:'#64748b', marginTop:'2px', display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                      {c.position_selected && c.position_selected !== c.position
                        ? <><span style={{ color:'#94a3b8', textDecoration:'line-through', fontSize:'11px' }}>{c.position}</span><span style={{ color:'#059669', fontWeight:700 }}><EmojiIcon e="→" /> {c.position_selected}</span></>
                        : <span>{c.position_selected || c.position || '—'}</span>}
                      {c.nationality ? <span>· {c.nationality}</span> : null}
                      {c.current_location ? <span>· {c.current_location}</span> : null}
                    </div>
                      {c.interview_date && <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>Interview: {fmtDateDisplay(c.interview_date)} {c.interviewed_by ? `· By: ${c.interviewed_by}` : ''}</div>}
                    </div>

                    {/* Score breakdown */}
                    {c.interview_score > 0 && (
                      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                        {scoreCols.map(({ l, v }) => (
                          <div key={l} style={{ textAlign:'center', minWidth:'36px' }}>
                            <div style={{ background: parseInt(v)>=4?'#dcfce7': parseInt(v)>=3?'#dbeafe': parseInt(v)>=2?'#fef3c7':'#fee2e2',
                              color: parseInt(v)>=4?'#059669': parseInt(v)>=3?'#1d4ed8': parseInt(v)>=2?'#92400e':'#991b1b',
                              borderRadius:'5px', padding:'3px 5px', fontWeight:800, fontSize:'13px', fontFamily:'monospace' }}>
                              {parseInt(v)||'—'}
                            </div>
                            <div style={{ fontSize:'9px', color:'#94a3b8', marginTop:'2px' }}>{l}</div>
                          </div>
                        ))}
                        <div style={{ textAlign:'center', minWidth:'40px' }}>
                          <div style={{ background: grade.bg, color: grade.c, borderRadius:'5px', padding:'3px 5px', fontWeight:800, fontSize:'13px', fontFamily:'monospace' }}>
                            {parseInt(c.interview_score)||0}
                          </div>
                          <div style={{ fontSize:'9px', color:'#94a3b8', marginTop:'2px' }}>Total</div>
                        </div>
                      </div>
                    )}

                    {/* Badges */}
                    <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ background: grade.bg, color: grade.c, padding:'3px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>{grade.l}</span>
                      <span style={{ background: verdict.bg, color: verdict.c, padding:'3px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}><EmojiLabel text={verdict.l} size={11} gap={4} /></span>
                      {c.me_experience === 'yes' && <span style={{ background:'#ede9fe', color:'#7c3aed', padding:'3px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}><EmojiIcon e="🌍" /> ME Exp</span>}
                    </div>

                    {/* Action */}
                    <button onClick={() => openSheet(c)} style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit', flexShrink:0 }}>Open Sheet</button>
                  </div>

                  {/* Medical / offer quick-view */}
                  {(c.gamka_result || c.basic_salary || c.deployment_site || c.medical_conditions) && (
                    <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:'1px solid var(--bd3)', display:'flex', gap:'16px', flexWrap:'wrap' }}>
                      {c.basic_salary && <span style={{ fontSize:'11.5px', color:'#64748b' }}>AED {Number(c.basic_salary).toLocaleString()} + {Number(c.allowance||0).toLocaleString()}</span>}
                      {c.deployment_site && <span style={{ fontSize:'11.5px', color:'#64748b' }}><EmojiIcon e="📍" /> {c.deployment_site}</span>}
                      {c.gamka_result && <span style={{ fontSize:'11.5px', color: c.gamka_result==='FIT – valid'?'#059669':'#d97706' }}><EmojiIcon e="🏥" /> Medical: {c.gamka_result}</span>}
                      {c.medical_conditions && c.medical_conditions !== 'None' && <span style={{ fontSize:'11.5px', color:'#dc2626' }}><EmojiIcon e="⚕️" /> {c.medical_conditions}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b' }}>{candidates.length} candidate{candidates.length!==1?'s':''}</div>
        </div>
      );
    }

        function SectionHead({ label }) {
      return <div style={{ fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.8px', paddingBottom:'6px', borderBottom:'2px solid var(--bd1)' }}><EmojiLabel text={label} size={12} gap={5} /></div>;
    }

    // ============ STYLES ============
    const S = {
      app: { display:'flex', height:'100vh', overflow:'hidden' },
      sidebar: { width:'230px', background:'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)', color:'#cbd5e1', display:'flex', flexDirection:'column', flexShrink:0, height:'100vh', overflowY:'auto', position:'sticky', top:0 },
      logo: { padding:'18px 16px', display:'flex', alignItems:'center', gap:'12px', borderBottom:'1px solid #1e293b', color:'#fff' },
      navItem: { display:'flex', alignItems:'center', gap:'12px', padding:'10px 16px', cursor:'pointer', fontSize:'13.5px' },
      main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
      topbar: { background:'#fff', padding:'14px 22px', borderBottom:'1px solid var(--bd1)', display:'flex', justifyContent:'space-between', alignItems:'center' },
      content: { padding:'20px 22px', overflowY:'auto', flex:1 },
      btnPri: { background:'#2563eb', color:'#fff', border:'none', padding:'9px 16px', borderRadius:'6px', fontSize:'14.5px', fontWeight:700, cursor:'pointer' },
      btnSec: { background:'#475569', color:'#fff', border:'1px solid #334155', padding:'9px 16px', borderRadius:'6px', fontSize:'14.5px', fontWeight:700, cursor:'pointer' },
      iconBtn: { background:'transparent', border:'none', padding:'5px', cursor:'pointer', fontSize:'14px', borderRadius:'4px' },
      link: { background:'transparent', border:'none', color:'#2563eb', fontSize:'14px', cursor:'pointer', fontWeight:700 },
      input: { padding:'7px 10px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'12.5px', color:'#0f172a', background:'#fff' },
      label: { display:'block', fontSize:'11.5px', color:'#475569', marginBottom:'4px', fontWeight:500 },
      th: { textAlign:'left', padding:'10px 10px', fontSize:'10px', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600, borderBottom:'1px solid var(--bd1)', whiteSpace:'nowrap' },
      td: { padding:'10px 10px', color:'#334155', verticalAlign:'middle', whiteSpace:'nowrap' },
      chip: { background:'#e2e8f0', color:'#1e293b', border:'1px solid #94a3b8', padding:'6px 11px', borderRadius:'16px', fontSize:'13.5px', fontWeight:700, cursor:'pointer' },
      chipActive: { background:'#dbeafe', color:'#1e40af', borderColor:'#93c5fd' },
      overlay: { position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, animation:'fadeIn 0.15s' },
      modal: { background:'#fff', borderRadius:'12px', width:'90%', maxWidth:'780px', maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 25px 50px rgba(0,0,0,0.25)' },
    };

    // ============ ROOT ============
    function Root() {
      const [user, setUser] = useState(null);
      const [checking, setChecking] = useState(true);
      useEffect(() => {
        db.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setChecking(false); });
        const { data: sub } = db.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
        return () => sub.subscription.unsubscribe();
      }, []);
      const logout = async () => { await db.auth.signOut(); setUser(null); };
      if (checking) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div className="spinner"></div></div>;
      if (!user) return <Login onLogin={setUser} />;
      return <HRApp user={user} onLogout={logout} />;
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<Root />);

  