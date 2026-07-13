    // ── PART 2: Document Upload Panel · Training Components ──
    // ============ DOCUMENT UPLOAD + OCR PANEL ============
    const DOC_TYPES = [
      { key:'passport',      label:'Passport',            color:'#dc2626', border:'#fca5a5', noKey:'passport_no',         expiryKey:'passport_expiry',    imgKey:'passport_img'       },
      { key:'eid',           label:'Emirates ID',          color:'#ea580c', border:'#fdba74', noKey:'eid_no',              expiryKey:'eid_expiry',          imgKey:'eid_img'            },
      { key:'visa',          label:'Visa',                 color:'#ca8a04', border:'#fcd34d', noKey:null,                  expiryKey:'visa_expiry',         imgKey:'visa_img'           },
      { key:'evisa',         label:'Employment eVisa',     color:'#0891b2', border:'#67e8f9', noKey:'evisa_no',            expiryKey:'evisa_expiry',        imgKey:'evisa_img'          },
      { key:'mohre',         label:'MOHRE Contract',       color:'#7c3aed', border:'#c4b5fd', noKey:'mohre_contract_no',   expiryKey:'mohre_contract_end',  imgKey:'mohre_contract_img' },
      { key:'insurance',     label:'Insurance',            color:'#0f766e', border:'#6ee7b7', noKey:'insurance_id',        expiryKey:'insurance_expiry',    imgKey:'insurance_img'      },
      { key:'cicpa',         label:'CICPA Gate Pass',      color:'#9333ea', border:'#d8b4fe', noKey:'cicpa_no',            expiryKey:'cicpa_expiry',        imgKey:'cicpa_img'          },
      { key:'iloe',          label:'ILOE',                 color:'#be185d', border:'#fbcfe8', noKey:'iloe_cert_no',        expiryKey:'iloe_expiry',         imgKey:'iloe_img'           },
      { key:'bank',          label:'Bank Account',         color:'#1e40af', border:'#93c5fd', noKey:'bank_account_no',     expiryKey:null,                  imgKey:'bank_img'           },
    ];

    function DocumentUploadPanel({ data, setField, employeeId }) {
      const BUCKET = 'hr-documents';
      const [activeDoc, setActiveDoc] = useState('passport');
      const [localImgs, setLocalImgs]   = useState({}); // docKey -> dataUrl (for newly uploaded, not yet saved)
      const [uploadLoading, setUploadLoading] = useState({}); // docKey -> bool
      const [ocrResults, setOcrResults]   = useState({});
      const [ocrLoading, setOcrLoading]   = useState({});
      const [manualExpiry, setManualExpiry] = useState({});
      const [manualNo, setManualNo]         = useState({});
      const [manualInsuranceCo, setManualInsuranceCo] = useState('');
      const [applyStatus, setApplyStatus]   = useState({});
      const [imgError, setImgError]         = useState({});
      const [empPreviewDoc, setEmpPreviewDoc] = useState(null); // { url, label, isPdf }
      const [empPdfBlobUrl, setEmpPdfBlobUrl] = useState(null);
      useEffect(() => {
        if (!empPreviewDoc || !empPreviewDoc.isPdf || !empPreviewDoc.url) { setEmpPdfBlobUrl(null); return; }
        if (!empPreviewDoc.url.startsWith('data:')) { setEmpPdfBlobUrl(empPreviewDoc.url); return; }
        try {
          const b64 = empPreviewDoc.url.split(',')[1];
          const bytes = atob(b64);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          const blob = new Blob([arr], { type: 'application/pdf' });
          const bUrl = URL.createObjectURL(blob);
          setEmpPdfBlobUrl(bUrl);
          return () => URL.revokeObjectURL(bUrl);
        } catch(e) { setEmpPdfBlobUrl(null); }
      }, [empPreviewDoc]);

      // ── Training cert sub-state — stored in employee_trainings.training_records.__other ──
      // We load from DB on mount, mutate locally, and auto-save on every change.
      const [tcRec, setTcRec] = useState(null);       // the employee_trainings row
      const [tcLoaded, setTcLoaded] = useState(false);

      // Load the training record for this employee
      useEffect(() => {
        if (!employeeId) { setTcLoaded(true); return; }
        db.from('employee_trainings').select('*').eq('employee_id', employeeId).single()
          .then(({ data: row }) => { setTcRec(row || null); setTcLoaded(true); });
      }, [employeeId]);

      const getTrainCerts = () => {
        try {
          const p = JSON.parse(tcRec?.training_records || '{}');
          return p.__other || [];
        } catch { return []; }
      };

      // Mutate __other and immediately persist to Supabase
      const tcMutate = async (fn) => {
        const oldCerts = getTrainCerts();
        const newCerts = fn(oldCerts);
        // Update local state first (optimistic)
        setTcRec(prev => {
          let p = {}; try { p = JSON.parse(prev?.training_records || '{}'); } catch {}
          p.__other = newCerts;
          return { ...(prev || {}), employee_id: employeeId, training_records: JSON.stringify(p) };
        });
        // Persist to DB
        try {
          if (tcRec?.id) {
            let p = {}; try { p = JSON.parse(tcRec.training_records || '{}'); } catch {}
            p.__other = newCerts;
            await db.from('employee_trainings').update({ training_records: JSON.stringify(p) }).eq('id', tcRec.id);
          } else {
            // Row doesn't exist yet — create it
            const initRec = JSON.stringify({ __other: newCerts });
            const { data: newRow } = await db.from('employee_trainings')
              .insert({ employee_id: employeeId, full_name: data.full_name || '', position: data.position || null, training_records: initRec })
              .select().single();
            if (newRow) setTcRec(newRow);
          }
        } catch(e) { console.error('tcMutate save error', e); }
        return newCerts;
      };

      const [tcActiveCid, setTcActiveCid] = useState(null);
      const [tcOcrData,   setTcOcrData]   = useState({});
      const [tcOcrBusy,   setTcOcrBusy]   = useState({});
      const [tcApplied,   setTcApplied]   = useState({});
      const [tcImgErr,    setTcImgErr]     = useState({});

      const tcUpdate = async (cid, fields) => {
        await tcMutate(arr => arr.map(c => c.cid === cid ? { ...c, ...fields } : c));
      };
      const tcAdd = async () => {
        const cid = Math.random().toString(36).slice(2,10);
        await tcMutate(arr => [...arr, { cid, courseName:'', issuingCompany:'', certNo:'', issueDate:'', expiry:'', imgData:'' }]);
        setTcActiveCid(cid);
      };
      const tcRemove = async (cid) => {
        if (!window.confirm('Remove this training certificate?')) return;
        const cur = getTrainCerts();
        const idx = cur.findIndex(c => c.cid === cid);
        const rest = cur.filter(c => c.cid !== cid);
        setTcActiveCid(rest[idx]?.cid || rest[idx-1]?.cid || null);
        await tcMutate(() => rest);
        setTcOcrData(d => { const n={...d}; delete n[cid]; return n; });
        setTcApplied(d => { const n={...d}; delete n[cid]; return n; });
        setTcImgErr(d  => { const n={...d}; delete n[cid]; return n; });
      };
      const tcHandleFile = (cid, file) => {
        if (!file) return;
        setTcImgErr(d => ({ ...d, [cid]: false }));
        setTcOcrBusy(d => ({ ...d, [cid]: true }));
        setTcOcrData(d => ({ ...d, [cid]: null }));
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          // Store the image in Supabase Storage instead of inline base64 —
          // keeps training_records JSON small (huge egress savings on loadAll).
          const url = await uploadCertImage(employeeId, cid, file);
          await tcUpdate(cid, { imgData: url || dataUrl });
          try {
            const base64 = dataUrl.split(',')[1];
            const mtype  = file.type?.startsWith('image/') ? file.type : 'image/jpeg';
            const res = await fetch('/api/claude', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:600,
                messages:[{ role:'user', content:[
                  { type:'image', source:{ type:'base64', media_type:mtype, data:base64 } },
                  { type:'text', text:`OCR this training/safety certificate. Extract:
1. Certificate number
2. Issue date (YYYY-MM-DD)
3. Expiry / valid-until date (YYYY-MM-DD) — NOT issue date
4. Full course / training name (e.g. "Safe Scaffolding Erection and Dismantling")
5. Issuing company / training provider (e.g. "Crosswind", "OPITO", "Bureau Veritas")
Reply ONLY as valid JSON, no markdown:
{"certNo":"...","issueDate":"YYYY-MM-DD","expiryDate":"YYYY-MM-DD","courseName":"...","issuingCompany":"..."}
Use null for missing fields.` }
                ]}]
              })
            });
            const json = await res.json();
            const raw = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
            let result = {};
            try { result = parseClaudeJson(raw); } catch(e) { result = { error: 'Parse failed: '+e.message }; }
            setTcOcrData(d => ({ ...d, [cid]: result }));
          } catch(e) { setTcOcrData(d => ({ ...d, [cid]:{ error:e.message } })); }
          setTcOcrBusy(d => ({ ...d, [cid]: false }));
        };
        reader.readAsDataURL(file);
      };
      const tcApplyOcr = async (cid) => {
        const ocr = tcOcrData[cid];
        if (!ocr || ocr.error) return;
        const u = {};
        if (ocr.certNo)         u.certNo         = ocr.certNo;
        if (ocr.issueDate)      u.issueDate      = ocr.issueDate;
        if (ocr.expiryDate)     u.expiry         = ocr.expiryDate;
        if (ocr.courseName)     u.courseName     = ocr.courseName;
        if (ocr.issuingCompany) u.issuingCompany = ocr.issuingCompany;
        if (Object.keys(u).length) await tcUpdate(cid, u);
        setTcApplied(d => ({ ...d, [cid]: true }));
        setTimeout(() => setTcApplied(d => ({ ...d, [cid]: false })), 3000);
      };

      // Get the display URL: prefer newly uploaded local preview, else stored URL from DB
      const getImgSrc = (docKey) => {
        if (imgError[docKey]) return null; // don't retry broken URLs
        if (localImgs[docKey]) return localImgs[docKey];
        const dt = DOC_TYPES.find(d=>d.key===docKey);
        const stored = dt && data[dt.imgKey] ? data[dt.imgKey] : null;
        // base64 data URLs always work; only http URLs can go stale
        if (stored && stored.startsWith('data:')) return stored;
        if (stored && stored.startsWith('http')) return stored;
        return null;
      };

      const handleFileChange = async (docKey, file) => {
        if (!file) return;
        setActiveDoc(docKey);
        setImgError(p => ({ ...p, [docKey]: false }));
        setUploadLoading(p => ({ ...p, [docKey]: true }));

        const isPdf = file.type === 'application/pdf';
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          setLocalImgs(p => ({ ...p, [docKey]: dataUrl }));

          // Persist a Storage URL to the DB instead of base64 — avoids egress
          // blowup since employee fields are re-fetched on every load.
          const dt2 = DOC_TYPES.find(d=>d.key===docKey);
          if (dt2?.imgKey) {
            const storedUrl = await uploadCertImage(employeeId, docKey, file, 'employee-docs');
            setField(dt2.imgKey, storedUrl || dataUrl);
          }

          // OCR — supports images AND PDFs
          setOcrResults(p => ({ ...p, [docKey]: null }));
          setOcrLoading(p => ({ ...p, [docKey]: true }));
          try {
            const base64 = dataUrl.split(',')[1];
            const mtype = isPdf ? 'application/pdf' : (file.type?.startsWith('image/') ? file.type : 'image/jpeg');

            const ocrPrompt = (() => {
              if (docKey === 'evisa') return `You are an OCR assistant for a UAE Employment eVisa. Extract:
1. Entry Permit / eVisa Number (e.g. 101/2026/2/0146278)
2. Full Name of the employee
3. Passport Number
4. Profession / Position as printed
5. Expiry date — the "permitted to enter UAE until" date (YYYY-MM-DD)
6. Nationality
Reply ONLY as valid JSON, no markdown:
{"docNumber":"...","fullName":"...","passportNo":"...","profession":"...","expiryDate":"YYYY-MM-DD","nationality":"...","rawText":"...brief..."}
Use null for missing fields.`;
              if (docKey === 'mohre') return `You are an OCR assistant for a UAE MOHRE Employment Contract PDF. Extract:
1. Transaction Number (e.g. MB313042200AE)
2. Employee Full Name (Second Party / Worker name)
3. Profession / Job Title
4. Contract Start Date (YYYY-MM-DD)
5. Contract End Date (YYYY-MM-DD) — this is the expiry
6. Basic Salary in AED
Reply ONLY as valid JSON, no markdown:
{"docNumber":"...","fullName":"...","profession":"...","startDate":"YYYY-MM-DD","expiryDate":"YYYY-MM-DD","basicSalary":"...","rawText":"...brief..."}
Use null for missing fields.`;
              if (docKey === 'insurance') return `You are an OCR assistant for a UAE health/medical insurance card or certificate. Extract:
1. Insurance company / provider name (e.g. Daman, AXA Gulf, Orient, GIG Gulf, Fidelity United, Neuron, NAS, ADNIC, Dubai Insurance, Sukoon, etc.)
2. Policy number or card number (the main ID on the card)
3. Expiry date — the date the insurance EXPIRES (YYYY-MM-DD)
4. Employee / member name
Reply ONLY as valid JSON, no markdown:
{"companyName":"...","docNumber":"...","expiryDate":"YYYY-MM-DD","holderName":"...","rawText":"...brief..."}
Use null for missing fields. expiryDate must be YYYY-MM-DD.`;
              if (docKey === 'bank') return `You are an OCR assistant for a bank document (cheque / letter / statement). Extract:
1. Bank Name
2. Account Number
3. IBAN
4. Account Holder Name
Reply ONLY as valid JSON, no markdown:
{"bankName":"...","accountNo":"...","iban":"...","holderName":"...","rawText":"...brief..."}
Use null for missing fields.`;
              return `You are an OCR assistant. Extract from this ${DOC_TYPES.find(d=>d.key===docKey)?.label||'document'}:
1. Document number
2. Expiry date (EXPIRES date, NOT issue date)
Reply ONLY as valid JSON, no markdown:
{"docNumber":"...","expiryDate":"YYYY-MM-DD","rawText":"...brief OCR text..."}
Use null for missing fields. expiryDate must be YYYY-MM-DD.
For passports: expiry is bottom-right of data page; verify via MRZ (YYMMDD format).`;
            })();

            const contentBlock = isPdf
              ? { type:'document', source:{ type:'base64', media_type:'application/pdf', data:base64 } }
              : { type:'image', source:{ type:'base64', media_type:mtype, data:base64 } };

            const res = await fetch('/api/claude', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:1000,
                messages:[{ role:'user', content:[ contentBlock, { type:'text', text:ocrPrompt } ] }] })
            });
            const json = await res.json();
            const rawText = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
            let parsed = {};
            try { parsed = parseClaudeJson(rawText); } catch(e) { parsed = { error: 'Parse failed: '+e.message, rawText }; }
            setOcrResults(p => ({ ...p, [docKey]: parsed }));
            if (parsed.expiryDate) setManualExpiry(p => ({ ...p, [docKey]: parsed.expiryDate }));
            if (docKey === 'bank') {
              if (parsed.bankName) setField('bank_name', parsed.bankName);
              if (parsed.accountNo) setManualNo(p => ({ ...p, [docKey]: parsed.accountNo }));
              if (parsed.iban) setField('bank_iban', parsed.iban);
            } else if (docKey === 'mohre') {
              if (parsed.docNumber) setManualNo(p => ({ ...p, [docKey]: parsed.docNumber }));
              if (parsed.startDate) setField('mohre_contract_start', parsed.startDate);
              if (parsed.basicSalary) setField('basic_salary', parsed.basicSalary);
            } else if (docKey === 'evisa') {
              if (parsed.docNumber) setManualNo(p => ({ ...p, [docKey]: parsed.docNumber }));
              if (parsed.profession) setField('position', parsed.profession);
            } else if (docKey === 'insurance') {
              if (parsed.docNumber) setManualNo(p => ({ ...p, [docKey]: parsed.docNumber }));
              if (parsed.companyName) setManualInsuranceCo(parsed.companyName);
            } else {
              if (parsed.docNumber) setManualNo(p => ({ ...p, [docKey]: parsed.docNumber }));
            }
          } catch(e) {
            setOcrResults(p => ({ ...p, [docKey]: { error: e.message } }));
          }
          setOcrLoading(p => ({ ...p, [docKey]: false }));
          setUploadLoading(p => ({ ...p, [docKey]: false }));
        };
        reader.readAsDataURL(file);
      };

      const applyToForm = (docKey) => {
        const dt = DOC_TYPES.find(d=>d.key===docKey);
        if (!dt) return;
        const exp = manualExpiry[docKey] || ocrResults[docKey]?.expiryDate || '';
        const num = manualNo[docKey]     || ocrResults[docKey]?.docNumber  || '';
        if (exp && dt.expiryKey) setField(dt.expiryKey, exp);
        if (docKey === 'insurance') {
          if (manualInsuranceCo) setField('insurance_id', manualInsuranceCo);
        } else {
          if (num && dt.noKey) setField(dt.noKey, num);
        }
        setApplyStatus(p => ({ ...p, [docKey]: 'applied' }));
        setTimeout(() => setApplyStatus(p => ({ ...p, [docKey]: null })), 3000);
      };

      const rescanEmpDoc = async (docKey) => {
        const src = getImgSrc(docKey);
        if (!src) return;
        const dt = DOC_TYPES.find(d => d.key === docKey);
        setOcrResults(p => ({ ...p, [docKey]: null }));
        setOcrLoading(p => ({ ...p, [docKey]: true }));
        try {
          const base64 = src.split(',')[1];
          const mtype = src.startsWith('data:image/') ? src.split(';')[0].split(':')[1] : 'image/jpeg';
          const res = await fetch('/api/claude', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
              messages: [{ role: 'user', content: [
                { type: 'image', source: { type: 'base64', media_type: mtype, data: base64 } },
                { type: 'text', text: docKey === 'insurance'
                  ? `You are an OCR assistant for a UAE health/medical insurance card or certificate. Extract:
1. Insurance company / provider name (e.g. Daman, AXA Gulf, Orient, GIG Gulf, Fidelity United, Neuron, NAS, ADNIC, Dubai Insurance, Sukoon, etc.)
2. Policy number or card number (the main ID on the card)
3. Expiry date — the date the insurance EXPIRES (YYYY-MM-DD)
4. Employee / member name
Reply ONLY as valid JSON, no markdown:
{"companyName":"...","docNumber":"...","expiryDate":"YYYY-MM-DD","holderName":"...","rawText":"...brief..."}
Use null for missing fields. expiryDate must be YYYY-MM-DD.`
                  : `You are an OCR assistant. Extract from this ${dt?.label||'document'} image:
1. Document number
2. Expiry date (the date the document EXPIRES, NOT the issue date)
Reply ONLY with valid JSON, no markdown:
{"docNumber":"...","expiryDate":"YYYY-MM-DD","rawText":"...brief OCR text..."}
Use null for missing fields. expiryDate must be YYYY-MM-DD.
For passports: expiry is bottom-right of data page, verify via MRZ (YYMMDD format).` }
              ]}]
            })
          });
          const json = await res.json();
          const rawText = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
          let parsed = {};
          try { parsed = parseClaudeJson(rawText); } catch(e) { parsed = { error: 'Parse failed: '+e.message }; }
          setOcrResults(p => ({ ...p, [docKey]: parsed }));
          if (parsed.expiryDate) setManualExpiry(p => ({ ...p, [docKey]: parsed.expiryDate }));
          if (parsed.docNumber)  setManualNo(p => ({ ...p, [docKey]: parsed.docNumber }));
          if (docKey === 'insurance' && parsed.companyName) setManualInsuranceCo(parsed.companyName);
        } catch(e) {
          setOcrResults(p => ({ ...p, [docKey]: { error: e.message } }));
        }
        setOcrLoading(p => ({ ...p, [docKey]: false }));
      };

      const activeType = DOC_TYPES.find(d => d.key === activeDoc);
      const imgSrc = getImgSrc(activeDoc);
      const fileName = localImgs[activeDoc] ? '(newly uploaded)' : (activeType && data[activeType.imgKey] ? 'Saved document' : null);
      const isTrainingTab = activeDoc === '__training';
      const trainCerts = getTrainCerts();
      const tcCert = tcActiveCid ? trainCerts.find(c => c.cid === tcActiveCid) || null : null;
      const tcOcr  = tcActiveCid ? (tcOcrData[tcActiveCid] || null) : null;
      const tcScan = tcActiveCid ? (tcOcrBusy[tcActiveCid] || false) : false;
      const tcWasApplied = tcActiveCid ? (tcApplied[tcActiveCid] || false) : false;
      const tcImgSrc = (() => {
        if (!tcActiveCid || tcImgErr[tcActiveCid]) return null;
        const img = tcCert?.imgData;
        return img?.startsWith('data:') || img?.startsWith('http') ? img : null;
      })();
      // Auto-select first cert when tab opened and certs exist
      if (isTrainingTab && trainCerts.length > 0 && !tcActiveCid) {
        setTimeout(() => setTcActiveCid(trainCerts[0].cid), 0);
      }

      return (
        <div style={{ background:'#fafbfc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px', marginBottom:'4px' }}>
          {/* ── Tab strip ── */}
          <div style={{ display:'flex', gap:'7px', flexWrap:'wrap', marginBottom:'14px' }}>
            {DOC_TYPES.map(dt => {
              const hasSaved = !!(data[dt.imgKey] || localImgs[dt.key]);
              const isActive = activeDoc === dt.key;
              return (
                <button key={dt.key} type="button" onClick={() => setActiveDoc(dt.key)}
                  style={{
                    background: isActive ? dt.color : hasSaved ? '#f0fdf4' : '#fff',
                    color: isActive ? '#fff' : hasSaved ? '#166534' : '#475569',
                    border: `1.5px ${isActive?'solid':'dashed'} ${isActive ? dt.color : hasSaved ? '#86efac' : dt.border}`,
                    padding:'6px 13px', borderRadius:'20px', fontSize:'12px', fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', transition:'all 0.15s'
                  }}>
                  <EmojiIcon e={hasSaved ? '✅' : '➕'} style={{ marginRight:5 }} />{dt.label}
                </button>
              );
            })}
            {/* Training Certificates tab */}
            {(() => {
              const hasCerts = trainCerts.length > 0;
              const isActive = activeDoc === '__training';
              return (
                <button type="button" onClick={() => setActiveDoc('__training')}
                  style={{
                    background: isActive ? '#0f766e' : hasCerts ? '#f0fdf4' : '#fff',
                    color: isActive ? '#fff' : hasCerts ? '#166534' : '#475569',
                    border: `1.5px ${isActive ? 'solid' : 'dashed'} ${isActive ? '#0f766e' : hasCerts ? '#86efac' : '#99f6e4'}`,
                    padding:'6px 13px', borderRadius:'20px', fontSize:'12px', fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', transition:'all 0.15s'
                  }}>
                  <EmojiIcon e={hasCerts ? '✅' : '➕'} style={{ marginRight:5 }} />Training Certs {hasCerts ? `(${trainCerts.length})` : ''}
                </button>
              );
            })()}
          </div>

          {/* ── Standard doc panel ── */}
          {!isTrainingTab && activeType && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              {/* LEFT — image/pdf preview / upload */}
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {imgSrc && !imgError[activeDoc] ? (
                  <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden', background:'#fff' }}>
                    {isPdfUrl(imgSrc) ? (
                      <div
                        onClick={() => setEmpPreviewDoc({ url: imgSrc, label: activeType?.label || 'Document', isPdf: true })}
                        style={{ width:'100%', minHeight:'180px', maxHeight:'240px', background:'#eff6ff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', cursor:'zoom-in' }}
                        title="Click to view PDF">
                        <span style={{ fontSize:'48px' }}><EmojiIcon e="📄" /></span>
                        <span style={{ fontSize:'12px', fontWeight:700, color:'#2563eb' }}>PDF — Click to View</span>
                      </div>
                    ) : (
                      <img src={imgSrc} alt="Document scan"
                        onError={() => { setImgError(p => ({ ...p, [activeDoc]: true })); const dt = DOC_TYPES.find(d=>d.key===activeDoc); if (dt?.imgKey) setField(dt.imgKey, null); }}
                        onClick={() => setEmpPreviewDoc({ url: imgSrc, label: activeType?.label || 'Document', isPdf: false })}
                        style={{ width:'100%', display:'block', maxHeight:'240px', objectFit:'contain', background:'#f8fafc', cursor:'zoom-in' }} crossOrigin="anonymous"
                        title="Click to view full size" />
                    )}
                    <div style={{ padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid var(--bd3)', background:'#fff' }}>
                      <span style={{ fontSize:'11px', color:'#64748b' }}><EmojiLabel text={localImgs[activeDoc] ? '📎 New upload' : '☁️ Saved document'} /></span>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <button type="button" onClick={() => rescanEmpDoc(activeDoc)}
                          style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', padding:'3px 10px', borderRadius:'6px', fontSize:'11px', fontWeight:600, cursor:'pointer' }}><EmojiIcon e="🤖" /> Re-scan</button>
                        <label style={{ cursor:'pointer', fontSize:'11px', color:'#2563eb', fontWeight:600 }}><EmojiIcon e="🔄" /> Replace<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display:'none' }}
                            onChange={e => e.target.files[0] && handleFileChange(activeDoc, e.target.files[0])} />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px', border:`2px dashed ${activeType.border}`, borderRadius:'8px', padding:'32px 16px', cursor:'pointer', background:'#fff', minHeight:'180px' }}>
                    {imgError[activeDoc] ? (
                      <><span style={{ fontSize:'28px' }}><EmojiIcon e="📷" /></span><span style={{ fontSize:'12px', color:'#475569', fontWeight:600, textAlign:'center' }}>Previous image link expired.<br/>Click to upload a new one.</span></>
                    ) : (
                      <><span style={{ fontSize:'32px' }}><EmojiIcon e="📄" /></span><span style={{ fontSize:'13px', color:'#475569', fontWeight:600, textAlign:'center' }}>Click to upload {activeType.label}</span></>
                    )}
                    <span style={{ fontSize:'11px', color:'#94a3b8' }}>JPG, PNG, WEBP, or PDF</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display:'none' }}
                      onChange={e => e.target.files[0] && handleFileChange(activeDoc, e.target.files[0])} />
                  </label>
                )}
              </div>

              {/* RIGHT — OCR + editable fields */}
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}><EmojiIcon e="🔍" /> Auto-detect</div>
                {ocrLoading[activeDoc] && (
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px', background:'#eff6ff', borderRadius:'8px' }}>
                    <div className="spinner" style={{ width:'18px', height:'18px', borderWidth:'2px', flexShrink:0 }}></div>
                    <span style={{ fontSize:'12px', color:'#1e40af' }}>Scanning document…</span>
                  </div>
                )}
                {!ocrLoading[activeDoc] && !imgSrc && (
                  <div style={{ fontSize:'12px', color:'#94a3b8', padding:'12px', background:'#f8fafc', borderRadius:'8px', lineHeight:1.5 }}>
                    Upload a scan to auto-detect the number & expiry.<br/>
                    <span style={{ fontSize:'11px' }}>You can also type values manually below.</span>
                  </div>
                )}
                {ocrResults[activeDoc]?.error && (
                  <div style={{ fontSize:'11.5px', color:'#991b1b', background:'#fee2e2', padding:'10px', borderRadius:'8px' }}><EmojiIcon e="⚠" /> Scan issue: {ocrResults[activeDoc].error}<br/>
                    <span style={{ fontSize:'10.5px' }}>Enter values manually below.</span>
                  </div>
                )}
                {activeDoc === 'insurance' ? (
                  /* Insurance company selector in scanner panel */
                  <div>
                    <label style={{ display:'block', fontSize:'11px', color:'#64748b', marginBottom:'4px', fontWeight:600 }}>
                      Insurance Company
                    </label>
                    {(() => {
                      const curVal = manualInsuranceCo || data.insurance_id || '';
                      const isKnown = INSURANCE_COMPANIES.includes(curVal) || curVal === '';
                      const selVal = isKnown ? curVal : 'Other';
                      return (
                        <>
                          <select value={selVal} onChange={e => {
                            if (e.target.value === 'Other') setManualInsuranceCo('__other__');
                            else { setManualInsuranceCo(e.target.value); }
                          }} style={{ ...S.input, width:'100%', marginBottom: selVal === 'Other' ? '6px' : 0 }}>
                            <option value="">Select provider…</option>
                            {INSURANCE_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {selVal === 'Other' && (
                            <input type="text"
                              value={curVal === '__other__' ? '' : (!isKnown ? curVal : '')}
                              onChange={e => setManualInsuranceCo(e.target.value)}
                              placeholder="Type insurance company name…"
                              style={{ ...S.input, width:'100%' }} />
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : activeType.noKey && (
                  <div>
                    <label style={{ display:'block', fontSize:'11px', color:'#64748b', marginBottom:'4px', fontWeight:600 }}>
                      {activeDoc === 'bank' ? 'Account Number' : 'Document Number'}
                      {ocrResults[activeDoc]?.docNumber && !ocrResults[activeDoc]?.error &&
                        <span style={{ color:'#0891b2', marginLeft:'5px', fontSize:'10px' }}>● OCR detected</span>}
                    </label>
                    <input type="text"
                      value={manualNo[activeDoc] !== undefined ? manualNo[activeDoc] : (ocrResults[activeDoc]?.docNumber || data[activeType.noKey] || '')}
                      onChange={e => setManualNo(p => ({ ...p, [activeDoc]: e.target.value }))}
                      placeholder={activeDoc === 'bank' ? 'e.g. 0123456789' : 'e.g. U4387829'}
                      style={{ ...S.input, width:'100%', background: ocrResults[activeDoc]?.docNumber ? '#f0f9ff' : '#fff' }} />
                  </div>
                )}
                {/* Extra fields for Bank */}
                {activeDoc === 'bank' && (
                  <>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', color:'#64748b', marginBottom:'4px', fontWeight:600 }}>
                        Bank Name
                        {ocrResults[activeDoc]?.bankName && <span style={{ color:'#0891b2', marginLeft:'5px', fontSize:'10px' }}>● OCR detected</span>}
                      </label>
                      <input type="text" value={data.bank_name || ''} onChange={e => setField('bank_name', e.target.value)}
                        placeholder="e.g. Emirates NBD, ADCB, ENBD"
                        style={{ ...S.input, width:'100%', background: ocrResults[activeDoc]?.bankName ? '#f0f9ff' : '#fff' }} />
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', color:'#64748b', marginBottom:'4px', fontWeight:600 }}>
                        IBAN
                        {ocrResults[activeDoc]?.iban && <span style={{ color:'#0891b2', marginLeft:'5px', fontSize:'10px' }}>● OCR detected</span>}
                      </label>
                      <input type="text" value={data.bank_iban || ''} onChange={e => setField('bank_iban', e.target.value)}
                        placeholder="e.g. AE070331234567890123456"
                        style={{ ...S.input, width:'100%', background: ocrResults[activeDoc]?.iban ? '#f0f9ff' : '#fff' }} />
                    </div>
                  </>
                )}
                {/* Extra fields for MOHRE contract */}
                {activeDoc === 'mohre' && (
                  <div>
                    <label style={{ display:'block', fontSize:'11px', color:'#64748b', marginBottom:'4px', fontWeight:600 }}>
                      Contract Start Date
                      {ocrResults[activeDoc]?.startDate && <span style={{ color:'#0891b2', marginLeft:'5px', fontSize:'10px' }}>● OCR detected</span>}
                    </label>
                    <input type="date" value={data.mohre_contract_start || ''} onChange={e => setField('mohre_contract_start', e.target.value)}
                      style={{ ...S.input, width:'100%' }} />
                  </div>
                )}
                {/* Expiry date — hide for Bank */}
                {activeDoc !== 'bank' && activeType.expiryKey && (
                <div>
                  <label style={{ display:'block', fontSize:'11px', color:'#64748b', marginBottom:'4px', fontWeight:600 }}>
                    {activeDoc === 'mohre' ? 'Contract End Date (Expiry)' : 'Expiry Date'}
                    {ocrResults[activeDoc]?.expiryDate && !ocrResults[activeDoc]?.error &&
                      <span style={{ marginLeft:'5px', fontSize:'10px', color:'#ca8a04', background:'#fef3c7', padding:'1px 6px', borderRadius:'6px' }}>
                        OCR: {ocrResults[activeDoc].expiryDate}
                      </span>}
                  </label>
                  <input type="date"
                    value={manualExpiry[activeDoc] !== undefined ? manualExpiry[activeDoc] : (data[activeType.expiryKey] || '')}
                    onChange={e => setManualExpiry(p => ({ ...p, [activeDoc]: e.target.value }))}
                    style={{ ...S.input, width:'100%', fontSize:'13px', border: ocrResults[activeDoc]?.expiryDate ? '2px solid #f59e0b' : '1px solid #cbd5e1' }} />
                  {ocrResults[activeDoc]?.expiryDate && (
                    <div style={{ fontSize:'10px', color:'#92400e', marginTop:'3px' }}><EmojiIcon e="⚠" /> Always verify against the physical document.</div>
                  )}
                </div>
                )}
                {ocrResults[activeDoc]?.rawText && (
                  <details>
                    <summary style={{ cursor:'pointer', color:'#64748b', fontSize:'11px', fontWeight:600 }}>▾ Show raw OCR text</summary>
                    <textarea readOnly value={ocrResults[activeDoc].rawText}
                      style={{ ...S.input, width:'100%', minHeight:'64px', marginTop:'4px', fontFamily:'monospace', fontSize:'10px', background:'#fafbfc', resize:'vertical' }} />
                  </details>
                )}
                <button type="button" onClick={() => applyToForm(activeDoc)}
                  style={{ ...S.btnPri, marginTop:'auto', background: applyStatus[activeDoc]==='applied' ? '#059669' : activeType.color }}>
                  <EmojiLabel text={applyStatus[activeDoc]==='applied' ? '✓ Applied to form below!' : `Use → Copy to ${activeType.label} fields`} />
                </button>
                {applyStatus[activeDoc]==='applied' && (
                  <div style={{ fontSize:'11px', color:'#059669', textAlign:'center', fontWeight:600 }}>
                    Scroll down ↓ to confirm in the Documents fields, then Save.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Training Certificates panel ── */}
          {isTrainingTab && (
            <div>
              {/* cert count + add button */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <div style={{ fontSize:'11.5px', color:'#475569', fontWeight:600 }}>
                  Upload training certificate scans — auto-detect reads course, provider &amp; expiry. Saves automatically.
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  {!tcLoaded && <div className="spinner" style={{ width:'14px', height:'14px', borderWidth:'2px' }}></div>}
                  <span style={{ background:'#ccfbf1', color:'#0f766e', padding:'2px 9px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>
                    {trainCerts.length} cert{trainCerts.length !== 1 ? 's' : ''}
                  </span>
                  <button type="button" onClick={tcAdd}
                    style={{ background:'#0f766e', color:'#fff', border:'none', padding:'5px 12px', borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>
                    + Add Certificate
                  </button>
                </div>
              </div>

              {/* cert tab strip */}
              {trainCerts.length > 0 && (
                <div style={{ display:'flex', gap:'6px', overflowX:'auto', paddingBottom:'6px', marginBottom:'12px' }} className="hr-scroll">
                  {trainCerts.map((c, i) => {
                    const isActive = tcActiveCid === c.cid;
                    const hasImg   = !!(c.imgData?.startsWith('data:') || c.imgData?.startsWith('http'));
                    const label    = c.courseName || `Cert ${i + 1}`;
                    const d        = c.expiry ? daysUntil(c.expiry) : null;
                    const dCol     = d === null ? null : d < 0 ? '#dc2626' : d <= 30 ? '#d97706' : '#059669';
                    return (
                      <button key={c.cid} type="button" onClick={() => setTcActiveCid(c.cid)}
                        style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'20px',
                          fontSize:'11.5px', fontWeight:700, cursor:'pointer', transition:'all 0.15s', maxWidth:'240px',
                          background: isActive ? '#0f766e' : hasImg ? '#f0fdf4' : '#fff',
                          color:      isActive ? '#fff'    : hasImg ? '#166534' : '#475569',
                          border: `1.5px ${isActive?'solid':'dashed'} ${isActive?'#0f766e':hasImg?'#86efac':'#99f6e4'}` }}>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:5 }}>{label}</span>
                        {c.issuingCompany && !isActive && <span style={{ fontSize:'9.5px', opacity:0.65, whiteSpace:'nowrap', flexShrink:0 }}>· {c.issuingCompany}</span>}
                        {d !== null && (
                          <span style={{ fontSize:'9.5px', fontWeight:700, flexShrink:0, padding:'1px 5px', borderRadius:'8px', whiteSpace:'nowrap',
                            background: isActive ? 'rgba(255,255,255,0.22)' : dCol+'18', color: isActive ? '#fff' : dCol }}>
                            {d < 0 ? 'Exp' : d+'d'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* empty state */}
              {trainCerts.length === 0 && (
                <div style={{ textAlign:'center', padding:'28px', color:'#94a3b8', fontSize:'12.5px', border:'1px dashed var(--bd1)', borderRadius:'8px', background:'#fff' }}>
                  No training certificates yet — click <strong>+ Add Certificate</strong> above.
                </div>
              )}

              {/* active cert body */}
              {tcActiveCid && tcCert && (
                <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden', background:'#fff' }}>
                  {/* sub-header */}
                  <div style={{ padding:'7px 14px', background:'#f0fdfa', borderBottom:'1px solid #ccfbf1', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:'12px', fontWeight:700, color:'#0f766e' }}>
                      Certificate {trainCerts.findIndex(c=>c.cid===tcActiveCid)+1} of {trainCerts.length}
                      {tcCert.issuingCompany && <span style={{ color:'#475569', fontWeight:400, marginLeft:'8px' }}>· {tcCert.issuingCompany}</span>}
                    </div>
                    <button type="button" onClick={() => tcRemove(tcActiveCid)}
                      style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'3px 10px', borderRadius:'6px', fontSize:'11px', fontWeight:600, cursor:'pointer' }}>Remove</button>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                    {/* LEFT — image */}
                    <div style={{ padding:'14px', borderRight:'1px solid var(--bd3)', display:'flex', flexDirection:'column', gap:'10px' }}>
                      {tcScan && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px', background:'#eff6ff', borderRadius:'8px' }}>
                          <div className="spinner" style={{ width:'16px', height:'16px', borderWidth:'2px', flexShrink:0 }}></div>
                          <span style={{ fontSize:'12px', color:'#1e40af' }}>Scanning certificate…</span>
                        </div>
                      )}
                      {tcImgSrc ? (
                        <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden' }}>
                          <img src={tcImgSrc} alt="Training cert"
                            onError={() => setTcImgErr(d => ({ ...d, [tcActiveCid]: true }))}
                            style={{ width:'100%', display:'block', maxHeight:'280px', objectFit:'contain', background:'#f8fafc' }} />
                          <div style={{ padding:'7px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid var(--bd3)' }}>
                            <span style={{ fontSize:'11px', color:'#64748b' }}><EmojiIcon e="☁️" /> Saved certificate</span>
                            <label style={{ cursor:'pointer', fontSize:'11px', color:'#2563eb', fontWeight:600 }}><EmojiIcon e="🔄" /> Replace<input type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }}
                                onChange={e => e.target.files[0] && tcHandleFile(tcActiveCid, e.target.files[0])} />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px',
                          border:'2px dashed #99f6e4', borderRadius:'8px', padding:'32px 16px', cursor:'pointer', background:'#fff', minHeight:'200px' }}>
                          <span style={{ fontSize:'36px' }}><EmojiIcon e="📄" /></span>
                          <span style={{ fontSize:'13px', color:'#475569', fontWeight:600, textAlign:'center' }}>Click to upload certificate scan</span>
                          <span style={{ fontSize:'11px', color:'#94a3b8' }}>JPG, PNG, or WEBP</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }}
                            onChange={e => e.target.files[0] && tcHandleFile(tcActiveCid, e.target.files[0])} />
                        </label>
                      )}
                    </div>

                    {/* RIGHT — auto-detect + fields */}
                    <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:'10px', overflowY:'auto', maxHeight:'400px' }}>
                      <div style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}><EmojiIcon e="🔍" /> Auto-detect</div>
                      {!tcScan && !tcImgSrc && (
                        <div style={{ fontSize:'11.5px', color:'#94a3b8', padding:'10px', background:'#f8fafc', borderRadius:'8px', lineHeight:1.5 }}>
                          Upload a scan to auto-detect course, provider &amp; expiry.<br/>
                          <span style={{ fontSize:'10.5px' }}>Or enter values manually below.</span>
                        </div>
                      )}
                      {tcOcr && !tcOcr.error && !tcWasApplied && (
                        <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'10px' }}>
                          <div style={{ fontSize:'11px', color:'#166534', fontWeight:700, marginBottom:'5px' }}><EmojiIcon e="✓" /> Detected — click Use to apply:</div>
                          {tcOcr.courseName     && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="📚" /> {tcOcr.courseName}</div>}
                          {tcOcr.issuingCompany && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="🏢" /> {tcOcr.issuingCompany}</div>}
                          {tcOcr.certNo         && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="🔢" /> {tcOcr.certNo}</div>}
                          {tcOcr.issueDate      && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="📅" /> Issued: {fmtDateDisplay(tcOcr.issueDate)}</div>}
                          {tcOcr.expiryDate     && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="📅" /> Expires: {fmtDateDisplay(tcOcr.expiryDate)}</div>}
                          <button type="button" onClick={() => tcApplyOcr(tcActiveCid)}
                            style={{ marginTop:'8px', width:'100%', background:'#0f766e', color:'#fff', border:'none', padding:'7px', borderRadius:'6px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
                            Use → Copy to fields below
                          </button>
                        </div>
                      )}
                      {tcWasApplied && (
                        <div style={{ background:'#dcfce7', border:'1px solid #86efac', borderRadius:'8px', padding:'10px', fontSize:'12px', color:'#166534', fontWeight:700, textAlign:'center' }}>
                          ✓ Applied! Verify below, then Save Employee.
                        </div>
                      )}
                      {tcOcr?.error && <div style={{ fontSize:'11px', color:'#991b1b', background:'#fee2e2', padding:'8px', borderRadius:'6px' }}><EmojiIcon e="⚠" /> {tcOcr.error}</div>}

                      <div>
                        <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>
                          Certification / Course Name
                        </label>
                        <input value={tcCert.courseName || ''} onChange={e => tcUpdate(tcActiveCid, { courseName: e.target.value })}
                          placeholder="e.g. Safe Scaffolding Erection and Dismantling"
                          style={{ ...S.input, width:'100%', fontSize:'12px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>
                          Certification Company / Training Provider
                        </label>
                        <input value={tcCert.issuingCompany || ''} onChange={e => tcUpdate(tcActiveCid, { issuingCompany: e.target.value })}
                          placeholder="e.g. Crosswind, OPITO, Bureau Veritas"
                          style={{ ...S.input, width:'100%', fontSize:'12px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>Certificate No</label>
                        <input value={tcCert.certNo || ''} onChange={e => tcUpdate(tcActiveCid, { certNo: e.target.value })}
                          placeholder="e.g. T2026-6614-01" style={{ ...S.input, width:'100%', fontSize:'12px' }} />
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                        <div>
                          <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>Issue Date</label>
                          <input type="date" value={tcCert.issueDate || ''} onChange={e => tcUpdate(tcActiveCid, { issueDate: e.target.value })}
                            style={{ ...S.input, width:'100%', fontSize:'12px' }} />
                        </div>
                        <div>
                          <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>
                            Expiry Date
                            {tcCert.expiry && (() => {
                              const d2 = daysUntil(tcCert.expiry);
                              return <span style={{ marginLeft:'5px', fontSize:'10px', fontWeight:700,
                                color: d2 < 0 ? '#dc2626' : d2 <= 30 ? '#d97706' : '#059669' }}>
                                {d2 < 0 ? `⚠ ${Math.abs(d2)}d ago` : `✓ ${d2}d`}
                              </span>;
                            })()}
                          </label>
                          <input type="date" value={tcCert.expiry || ''} onChange={e => tcUpdate(tcActiveCid, { expiry: e.target.value })}
                            style={{ ...S.input, width:'100%', fontSize:'12px',
                              borderColor: tcCert.expiry && daysUntil(tcCert.expiry) < 0 ? '#fca5a5'
                                         : tcCert.expiry && daysUntil(tcCert.expiry) <= 30 ? '#fcd34d' : undefined }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Employee Document Preview Lightbox */}
          {empPreviewDoc && (
            <div onClick={()=>setEmpPreviewDoc(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
              <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'12px', overflow:'hidden', maxWidth: empPreviewDoc.isPdf ? '92vw' : '90vw', maxHeight:'93vh', width: empPreviewDoc.isPdf ? '88vw' : 'auto', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--bd1)', background:'#f8fafc' }}>
                  <span style={{ fontWeight:700, fontSize:'14px', color:'#0f172a' }}>{empPreviewDoc.label}</span>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    {empPreviewDoc.isPdf && empPdfBlobUrl && (
                      <button onClick={()=>window.open(empPdfBlobUrl,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Open in New Tab</button>
                    )}
                    <button onClick={()=>{ const a=document.createElement('a'); a.href=empPreviewDoc.url; a.download=empPreviewDoc.label.replace(/[^a-z0-9]/gi,'_')+(empPreviewDoc.isPdf?'.pdf':'.jpg'); a.click(); }} style={{ background:'#0f2744', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Save to Folder</button>
                    <button onClick={()=>setEmpPreviewDoc(null)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#64748b', lineHeight:1 }}><EmojiIcon e="✕" /></button>
                  </div>
                </div>
                <div style={{ overflow: empPreviewDoc.isPdf ? 'hidden' : 'auto', flex:1, padding: empPreviewDoc.isPdf ? '0' : '8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {empPreviewDoc.isPdf ? (
                    empPdfBlobUrl
                      ? <object data={empPdfBlobUrl} type="application/pdf" style={{ width:'100%', height:'85vh', border:'none' }}>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px', padding:'40px', color:'#64748b' }}>
                            <div style={{ fontSize:'48px' }}><EmojiIcon e="📄" /></div>
                            <div style={{ fontWeight:600 }}>PDF cannot display inline in this browser.</div>
                            <button onClick={()=>window.open(empPdfBlobUrl,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'10px 22px', borderRadius:'8px', fontSize:'15px', fontWeight:700, cursor:'pointer' }}>Open PDF in New Tab</button>
                          </div>
                        </object>
                      : <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px', color:'#94a3b8', padding:'40px', textAlign:'center' }}>
                          <div style={{ fontSize:'48px' }}><EmojiIcon e="📄" /></div>
                          <div style={{ fontWeight:600, color:'#64748b' }}>Building PDF preview…</div>
                        </div>
                  ) : (
                    <img src={empPreviewDoc.url} alt="Document" style={{ maxWidth:'80vw', maxHeight:'80vh', objectFit:'contain', display:'block' }} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
      const getImgSrc = (docKey) => {
        if (imgError[docKey]) return null; // don't retry broken URLs
        if (localImgs[docKey]) return localImgs[docKey];
        const dt = DOC_TYPES.find(d=>d.key===docKey);
        const stored = dt && data[dt.imgKey] ? data[dt.imgKey] : null;
        // base64 data URLs always work; only http URLs can go stale
        if (stored && stored.startsWith('data:')) return stored;
        if (stored && stored.startsWith('http')) return stored;
        return null;
      };

      const handleFileChange = async (docKey, file) => {
        if (!file) return;
        setActiveDoc(docKey);
        setImgError(p => ({ ...p, [docKey]: false }));
        setUploadLoading(p => ({ ...p, [docKey]: true }));

        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          setLocalImgs(p => ({ ...p, [docKey]: dataUrl }));

          // Persist a Storage URL to the DB instead of base64 — avoids egress
          // blowup since employee fields are re-fetched on every load.
          const dt2 = DOC_TYPES.find(d=>d.key===docKey);
          if (dt2?.imgKey) {
            const storedUrl = await uploadCertImage(employeeId, docKey, file, 'employee-docs');
            setField(dt2.imgKey, storedUrl || dataUrl);
            console.log('[UPLOAD] stored to Storage, URL saved to field:', dt2.imgKey);
          }

          // OCR
          setOcrResults(p => ({ ...p, [docKey]: null }));
          setOcrLoading(p => ({ ...p, [docKey]: true }));
          try {
            const base64 = dataUrl.split(',')[1];
            const mtype  = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
            const res = await fetch('/api/claude', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1000,
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'image', source: { type: 'base64', media_type: mtype, data: base64 } },
                    { type: 'text', text: `You are an OCR assistant. Extract from this ${DOC_TYPES.find(d=>d.key===docKey)?.label||'document'} image:
1. Document number
2. Expiry date (the date the document EXPIRES, NOT the issue date)

Reply ONLY with valid JSON, no markdown:
{"docNumber":"...","expiryDate":"YYYY-MM-DD","rawText":"...brief OCR text..."}

Use null for missing fields. expiryDate must be YYYY-MM-DD.
For passports: "Date of Expiry" is bottom-right of data page. Verify via MRZ second line — expiry is first 6 digits after the document number checksum (format YYMMDD).` }
                  ]
                }]
              })
            });
            const json = await res.json();
            const rawText = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
            const cleaned = rawText.replace(/```json|```/g,'').trim();
            let parsed = {};
            try { parsed = parseClaudeJson(rawText); } catch(e) { parsed = { error: 'Parse failed: '+e.message, rawText }; }
            setOcrResults(p => ({ ...p, [docKey]: parsed }));
            if (parsed.expiryDate) setManualExpiry(p => ({ ...p, [docKey]: parsed.expiryDate }));
            if (parsed.docNumber)  setManualNo(p => ({ ...p, [docKey]: parsed.docNumber }));
          } catch(e) {
            setOcrResults(p => ({ ...p, [docKey]: { error: e.message } }));
          }
          setOcrLoading(p => ({ ...p, [docKey]: false }));
          setUploadLoading(p => ({ ...p, [docKey]: false }));
        };
        reader.readAsDataURL(file);
      };

      const applyToForm = (docKey) => {
        const dt = DOC_TYPES.find(d=>d.key===docKey);
        if (!dt) return;
        const exp = manualExpiry[docKey] || ocrResults[docKey]?.expiryDate || '';
        const num = manualNo[docKey]     || ocrResults[docKey]?.docNumber  || '';
        if (exp) setField(dt.expiryKey, exp);
        if (docKey === 'insurance') {
          if (manualInsuranceCo) setField('insurance_id', manualInsuranceCo);
        } else {
          if (num && dt.noKey) setField(dt.noKey, num);
        }
        setApplyStatus(p => ({ ...p, [docKey]: 'applied' }));
        setTimeout(() => setApplyStatus(p => ({ ...p, [docKey]: null })), 3000);
      };


    // ============================================================
    // TRAINING DOCUMENT UPLOAD PANEL — unlimited certificates
    // Uses stable cid (string) keys so removal never corrupts state
    // ============================================================
    const mkCid = () => Math.random().toString(36).slice(2, 10);

    function TrainingDocUploadPanel({ trRec, setTrRec, employeeId }) {
      // Always read certs fresh from trRec (source of truth)
      const getCerts = () => {
        try { return JSON.parse(trRec?.training_records || '{}').__other || []; }
        catch { return []; }
      };

      const [activeCid, setActiveCid] = useState(null);   // stable string ID of selected cert
      const [ocrData,   setOcrData]   = useState({});      // cid -> OCR result object
      const [ocrBusy,   setOcrBusy]   = useState({});      // cid -> bool
      const [applied,   setApplied]   = useState({});      // cid -> bool
      const [imgErr,    setImgErr]     = useState({});      // cid -> bool
      const [tdPreview, setTdPreview] = useState(null);    // { url, isPdf, label }
      const [tdPdfBlob, setTdPdfBlob] = useState(null);

      useEffect(() => {
        if (!tdPreview || !tdPreview.isPdf || !tdPreview.url) { setTdPdfBlob(null); return; }
        if (!tdPreview.url.startsWith('data:')) { setTdPdfBlob(tdPreview.url); return; }
        try {
          const b64 = tdPreview.url.split(',')[1];
          const bytes = atob(b64);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          const blob = new Blob([arr], { type: 'application/pdf' });
          const bUrl = URL.createObjectURL(blob);
          setTdPdfBlob(bUrl);
          return () => URL.revokeObjectURL(bUrl);
        } catch(e) { setTdPdfBlob(null); }
      }, [tdPreview]);

      // ── helpers ──────────────────────────────────────────────
      const mutateCerts = (fn) => {
        setTrRec(prev => {
          let p; try { p = JSON.parse(prev?.training_records || '{}'); } catch { p = {}; }
          p.__other = fn([...(p.__other || [])]);
          return { ...prev, training_records: JSON.stringify(p) };
        });
      };

      const updateCert = (cid, fields) => mutateCerts(arr => {
        const i = arr.findIndex(c => c.cid === cid);
        if (i >= 0) arr[i] = { ...arr[i], ...fields };
        return arr;
      });

      const addCert = () => {
        const cid = mkCid();
        mutateCerts(arr => [...arr, { cid, label:'', courseName:'', issuingCompany:'', certNo:'', issueDate:'', expiry:'', imgData:'' }]);
        setActiveCid(cid);
      };

      const removeCert = (cid) => {
        if (!window.confirm('Remove this certificate?')) return;
        mutateCerts(arr => {
          const rest = arr.filter(c => c.cid !== cid);
          // Move to adjacent cert or null
          const idx = arr.findIndex(c => c.cid === cid);
          const next = rest[idx] || rest[idx - 1] || null;
          setActiveCid(next ? next.cid : null);
          setOcrData(d  => { const n={...d};  delete n[cid]; return n; });
          setApplied(d  => { const n={...d};  delete n[cid]; return n; });
          setImgErr(d   => { const n={...d};  delete n[cid]; return n; });
          return rest;
        });
      };

      // ── upload + OCR ─────────────────────────────────────────
      const handleFile = (cid, file) => {
        if (!file) return;
        setImgErr(d => ({ ...d, [cid]: false }));
        setOcrBusy(d => ({ ...d, [cid]: true }));
        setOcrData(d => ({ ...d, [cid]: null }));
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          const url = await uploadCertImage(employeeId, cid, file);
          updateCert(cid, { imgData: url || dataUrl });
          try {
            const base64 = dataUrl.split(',')[1];
            const mtype  = file.type?.startsWith('image/') ? file.type : 'image/jpeg';
            const res = await fetch('/api/claude', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 600,
                messages: [{ role: 'user', content: [
                  { type: 'image', source: { type: 'base64', media_type: mtype, data: base64 } },
                  { type: 'text', text: `OCR this training/safety certificate. Extract:
1. Certificate number
2. Issue date (YYYY-MM-DD)
3. Expiry / valid-until date (YYYY-MM-DD) — NOT issue date
4. Full course / training name (e.g. "Safe Scaffolding Erection and Dismantling")
5. Issuing company / training provider (e.g. "Crosswind", "OPITO")
6. Holder name

Return ONLY valid JSON, no markdown:
{"certNo":"...","issueDate":"YYYY-MM-DD","expiryDate":"YYYY-MM-DD","courseName":"...","issuingCompany":"...","holderName":"..."}
Use null for missing fields.` }
                ]}]
              })
            });
            const json = await res.json();
            const raw = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
            let result = {};
            try { result = parseClaudeJson(raw); }
            catch { result = { error: 'Could not parse response' }; }
            setOcrData(d => ({ ...d, [cid]: result }));
          } catch(e) {
            setOcrData(d => ({ ...d, [cid]: { error: e.message } }));
          }
          setOcrBusy(d => ({ ...d, [cid]: false }));
        };
        reader.readAsDataURL(file);
      };

      const applyOcr = (cid) => {
        const ocr = ocrData[cid];
        if (!ocr || ocr.error) return;
        const u = {};
        if (ocr.certNo)        u.certNo        = ocr.certNo;
        if (ocr.issueDate)     u.issueDate     = ocr.issueDate;
        if (ocr.expiryDate)    u.expiry        = ocr.expiryDate;
        if (ocr.courseName)  { u.courseName    = ocr.courseName; u.label = ocr.courseName; }
        if (ocr.issuingCompany) u.issuingCompany = ocr.issuingCompany;
        if (Object.keys(u).length) updateCert(cid, u);
        setApplied(d => ({ ...d, [cid]: true }));
        setTimeout(() => setApplied(d => ({ ...d, [cid]: false })), 3000);
      };

      // ── derived state ─────────────────────────────────────────
      const certs    = getCerts();
      const certObj  = activeCid ? (certs.find(c => c.cid === activeCid) || null) : null;
      const ocr      = activeCid ? (ocrData[activeCid] || null) : null;
      const scanning = activeCid ? (ocrBusy[activeCid] || false) : false;
      const wasApplied = activeCid ? (applied[activeCid] || false) : false;
      const imgSrc   = (() => {
        if (!activeCid || imgErr[activeCid]) return null;
        return certObj?.imgData?.startsWith('data:') || certObj?.imgData?.startsWith('http') ? certObj.imgData : null;
      })();

      // If saved certs exist but no tab selected yet, auto-select the first
      if (certs.length > 0 && activeCid === null) {
        // Use effect-like: set on first render only
        setTimeout(() => setActiveCid(certs[0].cid), 0);
      }

      // Migrate legacy certs (no cid) on first render
      const needsMigration = certs.some(c => !c.cid);
      if (needsMigration) {
        mutateCerts(arr => arr.map(c => c.cid ? c : { ...c, cid: mkCid() }));
      }

      return (
        <div style={{ background:'#fafbfc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px', marginBottom:'12px' }}>

          {/* ── Header ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <div style={{ fontSize:'11.5px', color:'#475569', fontWeight:700 }}><EmojiIcon e="🎓" /> Training Certificates<span style={{ fontSize:'10px', color:'#94a3b8', fontWeight:400, marginLeft:'8px' }}>
                Upload scans — auto-detect reads course, provider &amp; expiry. Click "Use →" to apply.
              </span>
            </div>
            <span style={{ background:'#ccfbf1', color:'#0f766e', padding:'2px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700, flexShrink:0 }}>
              {certs.length} cert{certs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* ── Scrollable tab strip ── */}
          <div style={{ display:'flex', gap:'6px', overflowX:'auto', paddingBottom:'6px', marginBottom:'12px' }} className="hr-scroll">
            {certs.map((c, i) => {
              const isActive = activeCid === c.cid;
              const hasImg   = !!(c.imgData?.startsWith('data:') || c.imgData?.startsWith('http'));
              const label    = c.courseName || c.label || `Cert ${i + 1}`;
              const d        = c.expiry ? daysUntil(c.expiry) : null;
              const dColor   = d === null ? null : d < 0 ? '#dc2626' : d <= 30 ? '#d97706' : '#059669';
              return (
                <button key={c.cid} type="button" onClick={() => setActiveCid(c.cid)}
                  style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'20px',
                    fontSize:'11.5px', fontWeight:700, cursor:'pointer', transition:'all 0.15s', maxWidth:'230px',
                    background: isActive ? '#0f766e' : hasImg ? '#f0fdf4' : '#fff',
                    color:      isActive ? '#fff'    : hasImg ? '#166534' : '#475569',
                    border: `1.5px ${isActive ? 'solid' : 'dashed'} ${isActive ? '#0f766e' : hasImg ? '#86efac' : '#99f6e4'}` }}>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    <EmojiIcon e={hasImg ? '✅' : '📄'} style={{ marginRight:5 }} />{label}
                  </span>
                  {c.issuingCompany && !isActive && (
                    <span style={{ fontSize:'9.5px', opacity:0.65, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'80px' }}>· {c.issuingCompany}</span>
                  )}
                  {d !== null && (
                    <span style={{ fontSize:'9.5px', fontWeight:700, flexShrink:0, whiteSpace:'nowrap', padding:'1px 5px', borderRadius:'8px',
                      background: isActive ? 'rgba(255,255,255,0.22)' : dColor + '18',
                      color:      isActive ? '#fff' : dColor }}>
                      {d < 0 ? 'Exp' : d + 'd'}
                    </span>
                  )}
                </button>
              );
            })}
            <button type="button" onClick={addCert}
              style={{ flexShrink:0, background:'#fff', color:'#0f766e', border:'1.5px dashed #99f6e4',
                padding:'6px 14px', borderRadius:'20px', fontSize:'13.5px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              + Add Certificate
            </button>
          </div>

          {/* ── Empty state ── */}
          {certs.length === 0 && (
            <div style={{ textAlign:'center', padding:'30px', color:'#94a3b8', fontSize:'12.5px',
              border:'1px dashed var(--bd1)', borderRadius:'8px', background:'#fff' }}>
              No training certificates yet — click <strong>+ Add Certificate</strong> above to get started.
            </div>
          )}

          {/* ── Active cert viewer ── */}
          {activeCid && certObj && (
            <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden', background:'#fff' }}>

              {/* cert sub-header */}
              <div style={{ padding:'8px 14px', background:'#f0fdfa', borderBottom:'1px solid #ccfbf1',
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:'#0f766e' }}>
                  Certificate {certs.findIndex(c => c.cid === activeCid) + 1} of {certs.length}
                  {certObj.issuingCompany && (
                    <span style={{ color:'#475569', fontWeight:400, marginLeft:'8px' }}>· {certObj.issuingCompany}</span>
                  )}
                </div>
                <button type="button" onClick={() => removeCert(activeCid)}
                  style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'4px 10px',
                    borderRadius:'6px', fontSize:'11px', fontWeight:600, cursor:'pointer' }}>Remove</button>
              </div>

              {/* two-column body */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>

                {/* LEFT — image viewer */}
                <div style={{ padding:'14px', borderRight:'1px solid var(--bd3)', display:'flex', flexDirection:'column', gap:'10px' }}>
                  {scanning && (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px', background:'#eff6ff', borderRadius:'8px' }}>
                      <div className="spinner" style={{ width:'16px', height:'16px', borderWidth:'2px', flexShrink:0 }}></div>
                      <span style={{ fontSize:'12px', color:'#1e40af' }}>Scanning certificate…</span>
                    </div>
                  )}

                  {imgSrc ? (
                    <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden' }}>
                      {isPdfUrl(imgSrc) ? (
                        <div
                          onClick={() => setTdPreview({ url: imgSrc, isPdf: true, label: certObj.courseName || certObj.label || 'Certificate' })}
                          style={{ width:'100%', minHeight:'240px', maxHeight:'300px', background:'#eff6ff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', cursor:'zoom-in' }}
                          title="Click to view PDF">
                          <span style={{ fontSize:'52px' }}><EmojiIcon e="📄" /></span>
                          <span style={{ fontSize:'12px', fontWeight:700, color:'#2563eb' }}>PDF — Click to View</span>
                        </div>
                      ) : (
                        <img src={imgSrc} alt="Training certificate"
                          onError={() => setImgErr(d => ({ ...d, [activeCid]: true }))}
                          onClick={() => setTdPreview({ url: imgSrc, isPdf: false, label: certObj.courseName || certObj.label || 'Certificate' })}
                          style={{ width:'100%', display:'block', maxHeight:'300px', objectFit:'contain', background:'#f8fafc', cursor:'zoom-in' }}
                          title="Click to view full size" />
                      )}
                      <div style={{ padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center',
                        borderTop:'1px solid var(--bd3)', background:'#fff' }}>
                        <span style={{ fontSize:'11px', color:'#64748b' }}><EmojiIcon e="☁️" /> Saved certificate</span>
                        <label style={{ cursor:'pointer', fontSize:'11px', color:'#2563eb', fontWeight:600 }}><EmojiIcon e="🔄" /> Replace<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display:'none' }}
                            onChange={e => e.target.files[0] && handleFile(activeCid, e.target.files[0])} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      gap:'10px', border:'2px dashed #99f6e4', borderRadius:'8px', padding:'36px 16px',
                      cursor:'pointer', background:'#fff', minHeight:'220px' }}>
                      <span style={{ fontSize:'40px' }}><EmojiIcon e="📄" /></span>
                      <span style={{ fontSize:'13px', color:'#475569', fontWeight:600, textAlign:'center' }}>Click to upload certificate scan</span>
                      <span style={{ fontSize:'11px', color:'#94a3b8' }}>JPG, PNG, WEBP, or PDF</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display:'none' }}
                        onChange={e => e.target.files[0] && handleFile(activeCid, e.target.files[0])} />
                    </label>
                  )}
                </div>

                {/* RIGHT — auto-detect + editable fields */}
                <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:'10px', overflowY:'auto', maxHeight:'420px' }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}><EmojiIcon e="🔍" /> Auto-detect</div>

                  {!scanning && !imgSrc && (
                    <div style={{ fontSize:'11.5px', color:'#94a3b8', padding:'10px', background:'#f8fafc', borderRadius:'8px', lineHeight:1.5 }}>
                      Upload a scan to auto-detect the course, provider &amp; expiry.<br/>
                      <span style={{ fontSize:'10.5px' }}>You can also enter values manually below.</span>
                    </div>
                  )}

                  {/* OCR result box */}
                  {ocr && !ocr.error && !wasApplied && (
                    <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'10px' }}>
                      <div style={{ fontSize:'11px', color:'#166534', fontWeight:700, marginBottom:'6px' }}><EmojiIcon e="✓" /> Detected — click Use to copy:</div>
                      {ocr.courseName    && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="📚" /> {ocr.courseName}</div>}
                      {ocr.issuingCompany && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="🏢" /> {ocr.issuingCompany}</div>}
                      {ocr.certNo        && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="🔢" /> {ocr.certNo}</div>}
                      {ocr.issueDate     && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="📅" /> Issued: {fmtDateDisplay(ocr.issueDate)}</div>}
                      {ocr.expiryDate    && <div style={{ fontSize:'11px', color:'#166534' }}><EmojiIcon e="📅" /> Expires: {fmtDateDisplay(ocr.expiryDate)}</div>}
                      <button type="button" onClick={() => applyOcr(activeCid)}
                        style={{ marginTop:'8px', width:'100%', background:'#0f766e', color:'#fff', border:'none',
                          padding:'8px', borderRadius:'6px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
                        Use → Copy to fields below
                      </button>
                    </div>
                  )}
                  {wasApplied && (
                    <div style={{ background:'#dcfce7', border:'1px solid #86efac', borderRadius:'8px', padding:'10px',
                      fontSize:'12px', color:'#166534', fontWeight:700, textAlign:'center' }}>
                      ✓ Applied! Verify fields below, then Save Training.
                    </div>
                  )}
                  {ocr?.error && (
                    <div style={{ fontSize:'11px', color:'#991b1b', background:'#fee2e2', padding:'8px', borderRadius:'6px' }}><EmojiIcon e="⚠" /> {ocr.error}</div>
                  )}

                  {/* Editable fields */}
                  <div>
                    <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>Course / Training Name</label>
                    <input value={certObj.courseName || certObj.label || ''}
                      onChange={e => updateCert(activeCid, { courseName: e.target.value, label: e.target.value })}
                      placeholder="e.g. Safe Scaffolding Erection and Dismantling"
                      style={{ ...S.input, width:'100%', fontSize:'12px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>Training Provider / Issuing Company</label>
                    <input value={certObj.issuingCompany || ''}
                      onChange={e => updateCert(activeCid, { issuingCompany: e.target.value })}
                      placeholder="e.g. Crosswind, OPITO, Bureau Veritas"
                      style={{ ...S.input, width:'100%', fontSize:'12px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>Certificate No</label>
                    <input value={certObj.certNo || ''}
                      onChange={e => updateCert(activeCid, { certNo: e.target.value })}
                      placeholder="e.g. T2026-6614-01"
                      style={{ ...S.input, width:'100%', fontSize:'12px' }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    <div>
                      <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>Issue Date</label>
                      <input type="date" value={certObj.issueDate || ''}
                        onChange={e => updateCert(activeCid, { issueDate: e.target.value })}
                        style={{ ...S.input, width:'100%', fontSize:'12px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>
                        Expiry Date
                        {certObj.expiry && (() => {
                          const d2 = daysUntil(certObj.expiry);
                          return <span style={{ marginLeft:'6px', fontWeight:700, fontSize:'10px',
                            color: d2 < 0 ? '#dc2626' : d2 <= 30 ? '#d97706' : '#059669' }}>
                            {d2 < 0 ? `⚠ ${Math.abs(d2)}d ago` : `✓ ${d2}d`}
                          </span>;
                        })()}
                      </label>
                      <input type="date" value={certObj.expiry || ''}
                        onChange={e => updateCert(activeCid, { expiry: e.target.value })}
                        style={{ ...S.input, width:'100%', fontSize:'12px',
                          borderColor: certObj.expiry && daysUntil(certObj.expiry) < 0 ? '#fca5a5'
                                     : certObj.expiry && daysUntil(certObj.expiry) <= 30 ? '#fcd34d' : undefined }} />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        {/* PDF/Image Lightbox */}
        {tdPreview && (
          <div onClick={()=>setTdPreview(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'12px', overflow:'hidden', maxWidth: tdPreview.isPdf ? '92vw' : '90vw', maxHeight:'93vh', width: tdPreview.isPdf ? '88vw' : 'auto', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--bd1)', background:'#f8fafc' }}>
                <span style={{ fontWeight:700, fontSize:'14px', color:'#0f172a' }}><EmojiIcon e="📄" /> {tdPreview.label}</span>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  {tdPreview.isPdf && tdPdfBlob && (
                    <button onClick={()=>window.open(tdPdfBlob,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Open in New Tab</button>
                  )}
                  <button onClick={()=>{ const a=document.createElement('a'); a.href=tdPreview.url; a.download=(tdPreview.label.replace(/[^a-z0-9]/gi,'_'))+(tdPreview.isPdf?'.pdf':'.jpg'); a.click(); }} style={{ background:'#0f2744', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Save to Folder</button>
                  <button onClick={()=>setTdPreview(null)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#64748b', lineHeight:1 }}><EmojiIcon e="✕" /></button>
                </div>
              </div>
              <div style={{ overflow: tdPreview.isPdf ? 'hidden' : 'auto', flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {tdPreview.isPdf ? (
                  tdPdfBlob
                    ? <object data={tdPdfBlob} type="application/pdf" style={{ width:'100%', height:'85vh', border:'none' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px', padding:'40px', color:'#64748b' }}>
                          <div style={{ fontSize:'48px' }}><EmojiIcon e="📄" /></div>
                          <div style={{ fontWeight:600 }}>PDF cannot display inline in this browser.</div>
                          <button onClick={()=>window.open(tdPdfBlob,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'10px 22px', borderRadius:'8px', fontSize:'15px', fontWeight:700, cursor:'pointer' }}>Open PDF in New Tab</button>
                        </div>
                      </object>
                    : <div style={{ padding:'40px', textAlign:'center', color:'#64748b' }}><div style={{ fontSize:'48px' }}><EmojiIcon e="📄" /></div><div style={{ marginTop:'12px', fontWeight:600 }}>Building PDF preview…</div></div>
                ) : (
                  <img src={tdPreview.url} alt="Certificate" style={{ maxWidth:'80vw', maxHeight:'85vh', objectFit:'contain', display:'block' }} />
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      );
    }

    function TrainingInlinePanel({ employeeId, employeeName, position, cicpaLocations }) {
      const [trRec, setTrRec] = useState(null);
      const [loading, setLoading] = useState(true);
      const [activeCat, setActiveCat] = useState('baseline');
      const [expandedTr, setExpandedTr] = useState(null);
      const [saving, setSaving] = useState(false);

      useEffect(() => {
        if (!employeeId) { setLoading(false); return; }
        db.from('employee_trainings').select('*').eq('employee_id', employeeId).single()
          .then(({ data }) => {
            setTrRec(data || { employee_id: employeeId, full_name: employeeName, position, cicpa_locations: cicpaLocations, training_records: '{}' });
            setLoading(false);
          });
      }, [employeeId]);

      const parsed = (() => { try { return JSON.parse(trRec?.training_records || '{}'); } catch { return {}; } })();

      const setRec = (trainingId, fields) => {
        setTrRec(prev => {
          const p = { ...parsed };
          p[trainingId] = { ...(p[trainingId] || {}), ...fields };
          return { ...prev, training_records: JSON.stringify(p) };
        });
      };

      const statusStyle = (s) => {
        if (s === 'valid') return { bg:'#dcfce7', color:'#166534', label:'✓ Valid' };
        if (s === 'expired') return { bg:'#fee2e2', color:'#991b1b', label:'⚠ Expired' };
        if (s === 'not_required') return { bg:'#f1f5f9', color:'#64748b', label:'— N/A' };
        return { bg:'#fff', color:'#94a3b8', label:'○ Pending' };
      };

      const handleSave = async () => {
        if (!trRec) return;
        setSaving(true);
        if (trRec.id) {
          await db.from('employee_trainings').update({ training_records: trRec.training_records, full_name: employeeName, position, cicpa_locations: cicpaLocations }).eq('id', trRec.id);
        } else {
          const { data } = await db.from('employee_trainings').insert({ employee_id: employeeId, full_name: employeeName, position, cicpa_locations: cicpaLocations, training_records: trRec.training_records }).select().single();
          if (data) setTrRec(data);
        }
        setSaving(false);
      };

      if (!employeeId) return <div style={{ color:'#94a3b8', fontSize:'12px', padding:'12px' }}>Save the employee first to manage training records.</div>;
      if (loading) return <div style={{ padding:'20px', textAlign:'center' }}><div className="spinner" style={{ width:'20px', height:'20px', margin:'0 auto' }}></div></div>;

      const activeCatObj = TRAINING_CATEGORIES.find(c => c.id === activeCat);

      return (
        <div style={{ border:'1px solid var(--bd1)', borderRadius:'10px', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#f8fafc', borderBottom:'1px solid var(--bd1)' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}><EmojiIcon e="🎓" /> Training Certificates — {employeeName}</div>
            <button type="button" className="hr-btn" onClick={handleSave} disabled={saving}
              style={{ ...S.btnPri, fontSize:'11.5px', padding:'5px 12px', background:'#7c3aed' }}>
              <EmojiLabel text={saving ? 'Saving…' : '💾 Save Training'} />
            </button>
          </div>

          {/* === Certificate Upload Panel (mirrors Documents tab) === */}
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bd1)', background:'#fff' }}>
            <TrainingDocUploadPanel trRec={trRec} setTrRec={setTrRec} employeeId={employeeId} />
          </div>

          {/* === Training Matrix (status tracking per category) === */}
          <div style={{ display:'flex' }}>
            {/* Category tabs */}
            <div style={{ width:'170px', flexShrink:0, borderRight:'1px solid var(--bd1)', padding:'8px 6px', background:'#fafbfc', maxHeight:'420px', overflowY:'auto' }}>
              {TRAINING_CATEGORIES.map(cat => {
                const valid = cat.trainings.filter(t => parsed[t.id]?.status === 'valid').length;
                return (
                  <button key={cat.id} type="button" onClick={() => setActiveCat(cat.id)}
                    style={{ width:'100%', textAlign:'left', padding:'7px 8px', borderRadius:'5px', border:'none', cursor:'pointer', marginBottom:'2px',
                      background: activeCat === cat.id ? cat.bg : 'transparent',
                      borderLeft: activeCat === cat.id ? `3px solid ${cat.color}` : '3px solid transparent' }}>
                    <div style={{ fontSize:'11px', fontWeight:600, color: activeCat === cat.id ? cat.color : '#475569', lineHeight:1.3 }}>{cat.label.split('—')[1]?.trim() || cat.label}</div>
                    <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'1px' }}>{valid}/{cat.trainings.length} certified</div>
                  </button>
                );
              })}
            </div>
            {/* Training list */}
            <div style={{ flex:1, padding:'10px 14px', maxHeight:'420px', overflowY:'auto' }}>
              {activeCatObj && activeCatObj.trainings.map(tr => {
                const rec = parsed[tr.id] || {};
                const st = statusStyle(rec.status);
                const isExp = expandedTr === tr.id;
                return (
                  <div key={tr.id} style={{ border:'1px solid var(--bd1)', borderRadius:'7px', marginBottom:'6px', overflow:'hidden' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', background:'#fff', cursor:'pointer' }}
                      onClick={() => setExpandedTr(isExp ? null : tr.id)}>
                      <select value={rec.status||''} onClick={e=>e.stopPropagation()} onChange={e => setRec(tr.id, { status: e.target.value })}
                        style={{ fontSize:'11px', padding:'2px 6px', border:'1px solid var(--bd1)', borderRadius:'10px', background: st.bg, color: st.color, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                        <option value="">○ Pending</option>
                        <option value="valid">Valid</option>
                        <option value="expired">Expired</option>
                        <option value="not_required">— N/A</option>
                      </select>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'12px', fontWeight:600, color:'#0f172a' }}>{tr.label}</div>
                        <div style={{ fontSize:'10px', color:'#64748b' }}>
                          {tr.site} {rec.certNo ? '· ' + rec.certNo : ''} {rec.issuingCompany ? '· ' + rec.issuingCompany : ''} {rec.expiry ? '· Exp: ' + fmtDateDisplay(rec.expiry) : ''}
                        </div>
                      </div>
                      <span style={{ fontSize:'10px', color:'#94a3b8' }}>{isExp ? '▲' : '▼'}</span>
                    </div>
                    {isExp && (
                      <div style={{ padding:'10px', borderTop:'1px solid var(--bd3)', background:'#fafbfc' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                          <div style={{ gridColumn:'span 2' }}><label style={{ ...S.label, fontSize:'10.5px' }}>Course / Training Name</label>
                            <input value={rec.courseName||''} onChange={e => setRec(tr.id, { courseName: e.target.value })} style={{ ...S.input, width:'100%', fontSize:'12px' }} placeholder="e.g. Safe Scaffolding Erection and Dismantling" /></div>
                          <div><label style={{ ...S.label, fontSize:'10.5px' }}>Certificate No</label>
                            <input value={rec.certNo||''} onChange={e => setRec(tr.id, { certNo: e.target.value })} style={{ ...S.input, width:'100%', fontSize:'12px' }} /></div>
                          <div><label style={{ ...S.label, fontSize:'10.5px' }}>Expiry Date</label>
                            <input type="date" value={rec.expiry||''} onChange={e => setRec(tr.id, { expiry: e.target.value, status: daysUntil(e.target.value) >= 0 ? 'valid' : 'expired' })} style={{ ...S.input, width:'100%', fontSize:'12px' }} /></div>
                          <div style={{ gridColumn:'span 2' }}><label style={{ ...S.label, fontSize:'10.5px' }}>Issuing Company / Training Provider</label>
                            <input value={rec.issuingCompany||''} onChange={e => setRec(tr.id, { issuingCompany: e.target.value })} style={{ ...S.input, width:'100%', fontSize:'12px' }} placeholder="e.g. Crosswind, OPITO" /></div>
                        </div>
                        <TrainingCertUploadPanel
                          trainingId={tr.id} trainingLabel={tr.label} empId={employeeId}
                          existingImgUrl={rec.imgData||null} existingCertNo={rec.certNo||''} existingExpiry={rec.expiry||''}
                          existingCourseName={rec.courseName||''} existingIssuingCompany={rec.issuingCompany||''}
                          onApply={(vals) => setRec(tr.id, { certNo: vals.certNo||rec.certNo, expiry: vals.expiry||rec.expiry, imgData: vals.imgData||rec.imgData, courseName: vals.courseName||rec.courseName, issuingCompany: vals.issuingCompany||rec.issuingCompany, status: vals.expiry ? (daysUntil(vals.expiry)>=0?'valid':'expired') : rec.status })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // ============================================================
    // TRAINING VIEW & MODAL
    // ============================================================

    function TrainingCertUploadPanel({ trainingId, trainingLabel, empId, existingImgUrl, existingCertNo, existingExpiry, existingIssuingCompany, existingCourseName, onApply }) {
      const [localImg, setLocalImg] = useState(null);
      const [ocrResult, setOcrResult] = useState(null);
      const [ocrLoading, setOcrLoading] = useState(false);
      const [manualNo, setManualNo] = useState(existingCertNo || '');
      const [manualExpiry, setManualExpiry] = useState(existingExpiry || '');
      const [manualCourse, setManualCourse] = useState(existingCourseName || '');
      const [manualIssuer, setManualIssuer] = useState(existingIssuingCompany || '');
      const [applyDone, setApplyDone] = useState(false);
      const [tcpPreview, setTcpPreview] = useState(null);  // { url, isPdf, label }
      const [tcpPdfBlob, setTcpPdfBlob] = useState(null);

      useEffect(() => {
        if (!tcpPreview || !tcpPreview.isPdf || !tcpPreview.url) { setTcpPdfBlob(null); return; }
        try {
          const b64 = tcpPreview.url.split(',')[1];
          const bytes = atob(b64);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          const blob = new Blob([arr], { type: 'application/pdf' });
          const bUrl = URL.createObjectURL(blob);
          setTcpPdfBlob(bUrl);
          return () => URL.revokeObjectURL(bUrl);
        } catch(e) { setTcpPdfBlob(null); }
      }, [tcpPreview]);

      // Live-sync helper — calls onApply immediately whenever any field changes
      const liveApply = (patch, currentImg) => {
        const merged = {
          certNo:        patch.certNo        !== undefined ? patch.certNo        : manualNo,
          expiry:        patch.expiry        !== undefined ? patch.expiry        : manualExpiry,
          courseName:    patch.courseName    !== undefined ? patch.courseName    : manualCourse,
          issuingCompany:patch.issuingCompany!== undefined ? patch.issuingCompany: manualIssuer,
          imgData:       currentImg !== undefined           ? currentImg          : (localImg || existingImgUrl),
        };
        onApply(merged);
      };

      const setNo      = (v) => { setManualNo(v);       liveApply({ certNo: v }); };
      const setExpiry  = (v) => { setManualExpiry(v);   liveApply({ expiry: v }); };
      const setCourse  = (v) => { setManualCourse(v);   liveApply({ courseName: v }); };
      const setIssuer  = (v) => { setManualIssuer(v);   liveApply({ issuingCompany: v }); };

      const handleFile = async (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          setLocalImg(dataUrl);
          liveApply({}, dataUrl);   // push image immediately
          setOcrLoading(true);
          setOcrResult(null);
          try {
            const base64 = dataUrl.split(',')[1];
            const isPdfFile = file.type === 'application/pdf' || dataUrl.startsWith('data:application/pdf');
            const mtype = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
            const contentParts = isPdfFile
              ? [
                  { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                  { type: 'text', text: `You are an OCR assistant for training/safety certificates. Extract from this certificate:
1. Certificate / registration number (any ID or cert number on the cert)
2. Expiry / valid-until date (NOT issue date) — format as YYYY-MM-DD
3. Course / training name (the full title of the course or training, e.g. "Safe Scaffolding Erection and Dismantling")
4. Issuing company / training provider (the organization that issued the certificate, e.g. "Crosswind", "OPITO", "Bureau Veritas")
5. Holder's name if visible

Reply ONLY with valid JSON, no markdown fences:
{"certNo":"...","expiryDate":"YYYY-MM-DD","courseName":"...","issuingCompany":"...","holderName":"...","rawText":"...brief..."}
Use null for any missing fields.` }
                ]
              : [
                  { type: 'image', source: { type: 'base64', media_type: mtype, data: base64 } },
                  { type: 'text', text: `You are an OCR assistant for training/safety certificates. Extract from this certificate image:
1. Certificate / registration number (any ID or cert number on the cert)
2. Expiry / valid-until date (NOT issue date) — format as YYYY-MM-DD
3. Course / training name (the full title of the course or training, e.g. "Safe Scaffolding Erection and Dismantling")
4. Issuing company / training provider (the organization that issued the certificate, e.g. "Crosswind", "OPITO", "Bureau Veritas")
5. Holder's name if visible

Reply ONLY with valid JSON, no markdown fences:
{"certNo":"...","expiryDate":"YYYY-MM-DD","courseName":"...","issuingCompany":"...","holderName":"...","rawText":"...brief..."}
Use null for any missing fields.` }
                ];
            const res = await fetch('/api/claude', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: contentParts }] })
            });
            const json = await res.json();
            const raw = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
            let parsedOcr = {};
            try { parsedOcr = parseClaudeJson(raw); } catch(e) { parsedOcr = { error: 'Parse failed: '+e.message, rawText: raw }; }
            setOcrResult(parsedOcr);
            // Auto-apply OCR fields immediately — no button click needed
            if (!parsedOcr.error) {
              const patch = {};
              if (parsedOcr.certNo)         { patch.certNo         = parsedOcr.certNo;         setManualNo(parsedOcr.certNo); }
              if (parsedOcr.expiryDate)      { patch.expiry         = parsedOcr.expiryDate;     setManualExpiry(parsedOcr.expiryDate); }
              if (parsedOcr.courseName)      { patch.courseName     = parsedOcr.courseName;     setManualCourse(parsedOcr.courseName); }
              if (parsedOcr.issuingCompany)  { patch.issuingCompany = parsedOcr.issuingCompany; setManualIssuer(parsedOcr.issuingCompany); }
              if (Object.keys(patch).length) { liveApply(patch, dataUrl); setApplyDone(true); setTimeout(() => setApplyDone(false), 3000); }
            }
          } catch(e) {
            setOcrResult({ error: e.message });
          }
          setOcrLoading(false);
        };
        reader.readAsDataURL(file);
      };

      // Manual "confirm" apply (still available as a button, but fields are already live-synced)
      const apply = () => {
        onApply({ certNo: manualNo, expiry: manualExpiry, imgData: localImg || existingImgUrl, courseName: manualCourse, issuingCompany: manualIssuer });
        setApplyDone(true);
        setTimeout(() => setApplyDone(false), 2500);
      };

      const imgSrc = localImg || existingImgUrl;

      return (
        <div style={{ background:'#fafbfc', border:'1px solid var(--bd1)', borderRadius:'8px', padding:'12px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {/* Left: image/pdf */}
            <div>
              {imgSrc ? (
                <div style={{ border:'1px solid var(--bd1)', borderRadius:'6px', overflow:'hidden', background:'#fff', marginBottom:'6px' }}>
                  {isPdfUrl(imgSrc) ? (
                    <div
                      onClick={() => setTcpPreview({ url: imgSrc, isPdf: true, label: trainingLabel || 'Certificate' })}
                      style={{ width:'100%', minHeight:'120px', maxHeight:'160px', background:'#eff6ff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'6px', cursor:'zoom-in' }}
                      title="Click to view PDF">
                      <span style={{ fontSize:'36px' }}></span>
                      <span style={{ fontSize:'11px', fontWeight:700, color:'#2563eb' }}>PDF — Click to View</span>
                    </div>
                  ) : (
                    <img src={imgSrc} alt="Certificate"
                      onClick={() => setTcpPreview({ url: imgSrc, isPdf: false, label: trainingLabel || 'Certificate' })}
                      style={{ width:'100%', maxHeight:'160px', objectFit:'contain', display:'block', cursor:'zoom-in' }}
                      title="Click to view full size" />
                  )}
                  <div style={{ padding:'6px 10px', borderTop:'1px solid var(--bd3)', display:'flex', justifyContent:'flex-end' }}>
                    <label style={{ fontSize:'11px', color:'#2563eb', fontWeight:600, cursor:'pointer' }}>Replace<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display:'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
                    </label>
                  </div>
                </div>
              ) : (
                <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', border:'2px dashed #c4b5fd', borderRadius:'6px', padding:'24px 10px', cursor:'pointer', background:'#fff', minHeight:'120px', marginBottom:'6px' }}>
                  <span style={{ fontSize:'24px' }}><EmojiIcon e="📄" /></span>
                  <span style={{ fontSize:'11.5px', color:'#475569', fontWeight:600, textAlign:'center' }}>Upload certificate</span>
                  <span style={{ fontSize:'10.5px', color:'#94a3b8' }}>JPG, PNG, WEBP, or PDF</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display:'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
                </label>
              )}
            </div>
            {/* Right: OCR + fields */}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'11.5px', fontWeight:700, color:'#475569' }}><EmojiIcon e="🔍" /> Auto-detect</div>
              {ocrLoading && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px', background:'#eff6ff', borderRadius:'6px' }}>
                  <div className="spinner" style={{ width:'14px', height:'14px', borderWidth:'2px', flexShrink:0 }}></div>
                  <span style={{ fontSize:'11px', color:'#1e40af' }}>Scanning certificate…</span>
                </div>
              )}
              {ocrResult?.error && <div style={{ fontSize:'11px', color:'#991b1b', background:'#fee2e2', padding:'8px', borderRadius:'6px' }}><EmojiIcon e="⚠" /> {ocrResult.error}</div>}
              <div>
                <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>
                  Course / Training Name
                  {ocrResult?.courseName && !ocrResult.error && <span style={{ color:'#059669', marginLeft:'5px', fontSize:'10px' }}>● detected</span>}
                </label>
                <input type="text" value={manualCourse} onChange={e => setCourse(e.target.value)} placeholder="e.g. Safe Scaffolding Erection and Dismantling"
                  style={{ ...S.input, width:'100%', fontSize:'12px', background: ocrResult?.courseName ? '#f0fdf4' : '#fff', border: ocrResult?.courseName ? '2px solid #86efac' : '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>
                  Issuing Company / Training Provider
                  {ocrResult?.issuingCompany && !ocrResult.error && <span style={{ color:'#059669', marginLeft:'5px', fontSize:'10px' }}>● detected</span>}
                </label>
                <input type="text" value={manualIssuer} onChange={e => setIssuer(e.target.value)} placeholder="e.g. Crosswind, OPITO, Bureau Veritas"
                  style={{ ...S.input, width:'100%', fontSize:'12px', background: ocrResult?.issuingCompany ? '#f0fdf4' : '#fff', border: ocrResult?.issuingCompany ? '2px solid #86efac' : '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>
                  Certificate No
                  {ocrResult?.certNo && !ocrResult.error && <span style={{ color:'#0891b2', marginLeft:'5px', fontSize:'10px' }}>● detected</span>}
                </label>
                <input type="text" value={manualNo} onChange={e => setNo(e.target.value)} placeholder="e.g. T2026-6614-01"
                  style={{ ...S.input, width:'100%', fontSize:'12px', background: ocrResult?.certNo ? '#f0f9ff' : '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize:'11px', color:'#64748b', display:'block', marginBottom:'3px', fontWeight:600 }}>
                  Expiry Date
                  {ocrResult?.expiryDate && !ocrResult.error && <span style={{ color:'#ca8a04', marginLeft:'5px', fontSize:'10px' }}>● detected</span>}
                </label>
                <input type="date" value={manualExpiry} onChange={e => setExpiry(e.target.value)}
                  style={{ ...S.input, width:'100%', fontSize:'12px', border: ocrResult?.expiryDate ? '2px solid #f59e0b' : '1px solid #cbd5e1' }} />
              </div>
              <button type="button" onClick={apply} style={{ ...S.btnPri, marginTop:'auto', fontSize:'12px', background: applyDone ? '#059669' : '#7c3aed' }}>
                <EmojiLabel text={applyDone ? '✓ Auto-detected & saved!' : '✓ Confirm & apply to record'} />
              </button>
            </div>
          </div>

        {/* PDF/Image Lightbox */}
        {tcpPreview && (
          <div onClick={()=>setTcpPreview(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'12px', overflow:'hidden', maxWidth: tcpPreview.isPdf ? '92vw' : '90vw', maxHeight:'93vh', width: tcpPreview.isPdf ? '88vw' : 'auto', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--bd1)', background:'#f8fafc' }}>
                <span style={{ fontWeight:700, fontSize:'14px', color:'#0f172a' }}>{tcpPreview.label}</span>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  {tcpPreview.isPdf && tcpPdfBlob && (
                    <button onClick={()=>window.open(tcpPdfBlob,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Open in New Tab</button>
                  )}
                  <button onClick={()=>{ const a=document.createElement('a'); a.href=tcpPreview.url; a.download=(tcpPreview.label.replace(/[^a-z0-9]/gi,'_'))+(tcpPreview.isPdf?'.pdf':'.jpg'); a.click(); }} style={{ background:'#0f2744', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Save to Folder</button>
                  <button onClick={()=>setTcpPreview(null)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#64748b', lineHeight:1 }}></button>
                </div>
              </div>
              <div style={{ overflow: tcpPreview.isPdf ? 'hidden' : 'auto', flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {tcpPreview.isPdf ? (
                  tcpPdfBlob
                    ? <object data={tcpPdfBlob} type="application/pdf" style={{ width:'100%', height:'85vh', border:'none' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px', padding:'40px', color:'#64748b' }}>
                          <div style={{ fontSize:'48px' }}></div>
                          <div style={{ fontWeight:600 }}>PDF cannot display inline in this browser.</div>
                          <button onClick={()=>window.open(tcpPdfBlob,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'10px 22px', borderRadius:'8px', fontSize:'15px', fontWeight:700, cursor:'pointer' }}>Open PDF in New Tab</button>
                        </div>
                      </object>
                    : <div style={{ padding:'40px', textAlign:'center', color:'#64748b' }}><div style={{ fontSize:'48px' }}></div><div style={{ marginTop:'12px', fontWeight:600 }}>Building PDF preview…</div></div>
                ) : (
                  <img src={tcpPreview.url} alt="Certificate" style={{ maxWidth:'80vw', maxHeight:'85vh', objectFit:'contain', display:'block' }} />
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      );
    }

    // ══════════════════════════════════════════════════════════════
    // ResizablePanel — wraps any overlay with resize + minimize
    // Sizes: 'compact' (560px) | 'normal' (860px) | 'wide' (1100px) | 'full' (100vw)
    // ══════════════════════════════════════════════════════════════
    function ResizablePanel({ title, subtitle, headerColor, onClose, children, defaultSize = 'normal', zIndex = 9999 }) {
      // Fixed width per screen (set by the caller via defaultSize) — the old compact/normal/wide/
      // full toggle buttons in the header were confusing clutter, so sizing is no longer user-facing.
      const SIZE_W = { compact: '560px', normal: '860px', wide: '1100px', full: '100vw' };
      const size = defaultSize;
      const [minimized, setMinimized] = React.useState(false);

      const hdrBg = headerColor || '#d1fae5';

      if (minimized) {
        // Floating pill at bottom-right — click to restore
        return (
          <div style={{ position:'fixed', bottom:'20px', right:'24px', zIndex: zIndex + 1,
            background: hdrBg, color:'#fff', borderRadius:'30px',
            padding:'10px 20px', display:'flex', alignItems:'center', gap:'10px',
            boxShadow:'0 6px 24px rgba(0,0,0,0.35)', cursor:'pointer', userSelect:'none',
            maxWidth:'340px' }}
            data-minimised-pill="1"
            onClick={()=>setMinimized(false)}>
            <span style={{ fontSize:'16px' }}>▲</span>
            <div className="satco-panel-title-block" style={{ flex:1, minWidth:0 }}>
              <div className="satco-panel-title-main" style={{ fontWeight:700, fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
              {subtitle && <div className="satco-panel-title-sub" style={{ fontSize:'11px', opacity:0.75, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subtitle}</div>}
            </div>
            <button className="satco-close-panel" type="button" aria-label="Close panel" title="Close panel"
              onMouseDown={(e)=>{ e.stopPropagation(); }}
              onClick={(e)=>{ e.stopPropagation(); onClose && onClose(); }}
              style={{ background:'#ffffff', border:'3px solid #dc2626', color:'#111827', borderRadius:'12px', width:'44px', height:'44px', fontSize:'30px', fontWeight:950, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, lineHeight:1 }}>×</button>
          </div>
        );
      }

      const isFull = size === 'full';
      return (
        <div style={{ position:'fixed', inset:0, background: isFull ? 'transparent' : 'rgba(10,18,35,0.65)',
          zIndex, display:'flex', alignItems: isFull ? 'stretch' : 'center', justifyContent:'center',
          padding: isFull ? '0' : '16px' }}
          data-resizable-panel="1"
          onClick={(e)=>{ if (e.target === e.currentTarget && !isFull) onClose(); }}>
          <div style={{ width: SIZE_W[size], maxWidth:'100vw', height: isFull ? '100vh' : 'min(92vh,900px)',
            background:'#f8fafc', display:'flex', flexDirection:'column', overflow:'hidden',
            borderRadius: isFull ? '0' : '12px',
            boxShadow: isFull ? 'none' : '0 24px 64px rgba(0,0,0,0.4)',
            transition:'width 0.18s ease, border-radius 0.18s ease' }}
            onClick={e=>e.stopPropagation()}>

            {/* ── Panel chrome bar ── */}
            <div className="satco-panel-header" style={{ background: hdrBg, color:'#fff', padding:'8px 14px',
              display:'flex', alignItems:'center', gap:'8px', flexShrink:0, userSelect:'none' }}>
              {/* Title */}
              <div className="satco-panel-title-block" style={{ flex:1, minWidth:0 }}>
                <div className="satco-panel-title-main" style={{ fontWeight:700, fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
                {subtitle && <div className="satco-panel-title-sub" style={{ fontSize:'10.5px', opacity:0.75, marginTop:'1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subtitle}</div>}
              </div>
              {/* Minimize */}
              <button className="satco-panel-minimize" onClick={()=>setMinimized(true)} title="Minimise — keeps panel open in background"
                style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)',
                  color:'#fff', borderRadius:'5px', width:'26px', height:'26px', fontSize:'14px',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                ▼
              </button>
              {/* Close */}
              <button className="satco-close-panel" type="button" aria-label="Close panel" title="Close panel"
                onMouseDown={(e)=>{ e.stopPropagation(); }}
                onClick={(e)=>{ e.stopPropagation(); onClose && onClose(); }}
                style={{ background:'#ffffff', border:'3px solid #dc2626', color:'#111827', borderRadius:'12px', width:'48px', height:'48px', fontSize:'32px', fontWeight:950,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, boxShadow:'0 4px 14px rgba(220,38,38,0.18)' }}>×</button>
            </div>

            {/* ── Content ── */}
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              {children}
            </div>
          </div>
        </div>
      );
    }

    function TrainingModal({ record, employees, onSave, onClose, showToast }) {
      const [data, setData] = useState(() => {
        const recs = (() => { try { return JSON.parse(record.training_records || '{}'); } catch { return {}; } })();
        return { ...record, _parsed: recs };
      });
      const [activeCat, setActiveCat] = useState('baseline');
      const [expandedTr, setExpandedTr] = useState(null);
      const [otherTrainings, setOtherTrainings] = useState(() => {
        try {
          const p = JSON.parse(record.training_records || '{}');
          return (p.__other || []);
        } catch { return []; }
      });
      const [newOther, setNewOther] = useState({ label:'', certNo:'', expiry:'', notes:'' });

      const setRec = (trainingId, fields) => {
        setData(d => {
          const p = { ...d._parsed };
          p[trainingId] = { ...(p[trainingId] || {}), ...fields };
          return { ...d, _parsed: p };
        });
      };

      const toggleStatus = (trainingId) => {
        setData(d => {
          const p = { ...d._parsed };
          const cur = p[trainingId] || {};
          const cycle = ['', 'valid', 'expired', 'not_required'];
          const idx = cycle.indexOf(cur.status || '');
          p[trainingId] = { ...cur, status: cycle[(idx + 1) % cycle.length] };
          return { ...d, _parsed: p };
        });
      };

      const statusStyle = (s) => {
        if (s === 'valid') return { bg:'#dcfce7', color:'#166534', label:'✓ Valid' };
        if (s === 'expired') return { bg:'#fee2e2', color:'#991b1b', label:'⚠ Expired' };
        if (s === 'not_required') return { bg:'#f1f5f9', color:'#64748b', label:'— N/A' };
        return { bg:'#fff', color:'#94a3b8', label:'○ Pending' };
      };

      const [saving, setSaving] = useState(false);
      const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
          const allRecs = { ...data._parsed, __other: otherTrainings };
          const saveData = { ...data, training_records: JSON.stringify(allRecs), _parsed: undefined };
          delete saveData._parsed;
          await onSave(saveData);
        } catch (e) {
          console.error('Save Training Record failed:', e);
          (showToast||alert)('❌ Save failed: ' + (e && e.message ? e.message : 'unknown error — check browser console for details'), 'error');
        } finally {
          setSaving(false);
        }
      };

      const activeCatObj = TRAINING_CATEGORIES.find(c => c.id === activeCat);
      const parsed = data._parsed || {};

      return (
        <div style={S.overlay} onClick={onClose}>
          <div className="training-modal-shell" style={{ ...S.modal, maxWidth:'820px' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 22px', borderBottom:'1px solid var(--bd1)' }}>
              <div>
                <h2 style={{ margin:0, fontSize:'17px' }}>Training Record — {data.full_name || data.employee_id}</h2>
                <div style={{ fontSize:'11.5px', color:'#64748b', marginTop:'3px' }}>
                  {data.employee_id} {data.position ? '· ' + data.position : ''} {data.cicpa_locations ? '· CICPA: ' + data.cicpa_locations : ''}
                </div>
              </div>
              <button onClick={onClose} style={S.iconBtn}><EmojiIcon e="✖" /></button>
            </div>

            <div className="training-modal-body" style={{ display:'flex', flex:1, overflow:'hidden' }}>
              {/* Left: category tabs */}
              <div className="training-modal-sidebar" style={{ width:'200px', flexShrink:0, borderRight:'1px solid var(--bd1)', overflowY:'auto', padding:'10px 8px', background:'#fafbfc' }}>
                {/* Other / General trainings — at the top for easy access */}
                <button type="button" onClick={() => setActiveCat('__other')}
                  style={{ width:'100%', textAlign:'left', padding:'9px 10px', borderRadius:'6px', border:'none', cursor:'pointer', marginBottom:'6px',
                    background: activeCat === '__other' ? '#fef9c3' : '#fffbeb',
                    borderLeft: activeCat === '__other' ? '3px solid #ca8a04' : '3px solid #fde68a' }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color: activeCat === '__other' ? '#92400e' : '#78350f' }}><EmojiIcon e="📋" /> Other / General Trainings</div>
                  <div style={{ fontSize:'10.5px', color:'#94a3b8', marginTop:'2px' }}>{otherTrainings.length} added · Upload any certificate here</div>
                </button>
                <div style={{ height:'1px', background:'#e2e8f0', margin:'6px 0 8px' }} />
                {TRAINING_CATEGORIES.map(cat => {
                  const catRecs = cat.trainings.map(t => parsed[t.id]);
                  const validCount = catRecs.filter(r => r?.status === 'valid').length;
                  const total = cat.trainings.length;
                  return (
                    <button key={cat.id} type="button" onClick={() => setActiveCat(cat.id)}
                      style={{ width:'100%', textAlign:'left', padding:'9px 10px', borderRadius:'6px', border:'none', cursor:'pointer', marginBottom:'3px',
                        background: activeCat === cat.id ? cat.bg : 'transparent',
                        borderLeft: activeCat === cat.id ? `3px solid ${cat.color}` : '3px solid transparent' }}>
                      <div style={{ fontSize:'12px', fontWeight:600, color: activeCat === cat.id ? cat.color : '#475569', lineHeight:1.3 }}>{cat.label}</div>
                      <div style={{ fontSize:'10.5px', color:'#94a3b8', marginTop:'2px' }}>{validCount}/{total} certified</div>
                    </button>
                  );
                })}
                {/* (Other Trainings button moved to top) */}
                <button type="button" onClick={() => setActiveCat('__other')} style={{ display:'none' }}
                  >
                  <div style={{ fontSize:'12px', fontWeight:600, color: activeCat === '__other' ? '#92400e' : '#475569' }}>7 — Other Trainings</div>
                  <div style={{ fontSize:'10.5px', color:'#94a3b8', marginTop:'2px' }}>{otherTrainings.length} added</div>
                </button>
              </div>

              {/* Right: training list */}
              <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
                {activeCat === '__other' ? (
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'12px' }}>Other / Custom Trainings</div>
                    {/* Existing other trainings */}
                    {otherTrainings.map((ot, idx) => (
                      <div key={idx} style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'12px', marginBottom:'8px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div style={{ fontWeight:600, fontSize:'13px', color:'#92400e' }}>{ot.label}</div>
                          <button type="button" onClick={() => setOtherTrainings(p => p.filter((_,i)=>i!==idx))} style={{ ...S.iconBtn, fontSize:'12px', color:'#dc2626' }}><EmojiIcon e="✖" /></button>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'8px' }}>
                          <div><label style={{ ...S.label, fontSize:'10.5px' }}>Cert No</label>
                            <input value={ot.certNo||''} onChange={e => setOtherTrainings(p => p.map((x,i) => i===idx ? {...x, certNo:e.target.value} : x))}
                              style={{ ...S.input, width:'100%', fontSize:'12px' }} /></div>
                          <div><label style={{ ...S.label, fontSize:'10.5px' }}>Expiry</label>
                            <input type="date" value={ot.expiry||''} onChange={e => setOtherTrainings(p => p.map((x,i) => i===idx ? {...x, expiry:e.target.value} : x))}
                              style={{ ...S.input, width:'100%', fontSize:'12px' }} /></div>
                          <div style={{ gridColumn:'span 2' }}><label style={{ ...S.label, fontSize:'10.5px' }}>Issuing Company / Training Provider</label>
                            <input value={ot.issuingCompany||''} onChange={e => setOtherTrainings(p => p.map((x,i) => i===idx ? {...x, issuingCompany:e.target.value} : x))}
                              placeholder="e.g. Crosswind, OPITO" style={{ ...S.input, width:'100%', fontSize:'12px' }} /></div>
                          <div style={{ gridColumn:'span 2' }}><label style={{ ...S.label, fontSize:'10.5px' }}>Notes</label>
                            <input value={ot.notes||''} onChange={e => setOtherTrainings(p => p.map((x,i) => i===idx ? {...x, notes:e.target.value} : x))}
                              style={{ ...S.input, width:'100%', fontSize:'12px' }} /></div>
                        </div>
                      </div>
                    ))}
                    {/* Add new other training */}
                    <div style={{ background:'#f8fafc', border:'2px dashed var(--bd1)', borderRadius:'8px', padding:'12px', marginTop:'8px' }}>
                      <div style={{ fontSize:'12px', fontWeight:700, color:'#475569', marginBottom:'8px' }}>+ Add Other Training</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                        <div style={{ gridColumn:'span 2' }}><label style={S.label}>Training Name *</label>
                          <input value={newOther.label} onChange={e => setNewOther(p=>({...p, label:e.target.value}))} placeholder="e.g. Safe Scaffolding Erection and Dismantling" style={{ ...S.input, width:'100%' }} /></div>
                        <div><label style={S.label}>Cert No</label><input value={newOther.certNo} onChange={e => setNewOther(p=>({...p, certNo:e.target.value}))} style={{ ...S.input, width:'100%' }} /></div>
                        <div><label style={S.label}>Expiry Date</label><input type="date" value={newOther.expiry} onChange={e => setNewOther(p=>({...p, expiry:e.target.value}))} style={{ ...S.input, width:'100%' }} /></div>
                        <div style={{ gridColumn:'span 2' }}><label style={S.label}>Issuing Company / Training Provider</label><input value={newOther.issuingCompany||''} onChange={e => setNewOther(p=>({...p, issuingCompany:e.target.value}))} placeholder="e.g. Crosswind, OPITO, Bureau Veritas" style={{ ...S.input, width:'100%' }} /></div>
                        <div style={{ gridColumn:'span 2' }}><label style={S.label}>Notes</label><input value={newOther.notes} onChange={e => setNewOther(p=>({...p, notes:e.target.value}))} style={{ ...S.input, width:'100%' }} /></div>
                      </div>
                      <button type="button" onClick={() => {
                        if (!newOther.label.trim()) return;
                        setOtherTrainings(p => [...p, { ...newOther }]);
                        setNewOther({ label:'', certNo:'', expiry:'', issuingCompany:'', notes:'' });
                      }} style={{ ...S.btnPri, marginTop:'10px', fontSize:'12px' }}>+ Add to List</button>
                    </div>
                  </div>
                ) : activeCatObj ? (
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:700, color: activeCatObj.color, marginBottom:'12px' }}>{activeCatObj.label}</div>
                    {activeCatObj.trainings.map(tr => {
                      const rec = parsed[tr.id] || {};
                      const st = statusStyle(rec.status);
                      const isExpanded = expandedTr === tr.id;
                      return (
                        <div key={tr.id} style={{ border:'1px solid var(--bd1)', borderRadius:'8px', marginBottom:'7px', overflow:'hidden' }}>
                          {/* Row */}
                          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', background:'#fff', cursor:'pointer' }}
                            onClick={() => setExpandedTr(isExpanded ? null : tr.id)}>
                            <button type="button" onClick={e => { e.stopPropagation(); toggleStatus(tr.id); }}
                              style={{ background: st.bg, color: st.color, border:'none', padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                              <EmojiLabel text={st.label} size={11} gap={4} />
                            </button>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'12.5px', fontWeight:600, color:'#0f172a' }}>{tr.label}</div>
                              <div style={{ fontSize:'10.5px', color:'#64748b', marginTop:'1px' }}>
                                Site: {tr.site}
                                {rec.courseName ? ' · ' + rec.courseName : ''}
                                {rec.certNo ? ' · Cert: ' + rec.certNo : ''}
                                {rec.issuingCompany ? ' · ' + rec.issuingCompany : ''}
                                {rec.expiry ? ' · Exp: ' + fmtDateDisplay(rec.expiry) : ''}
                                {rec.expiry && daysUntil(rec.expiry) !== null && daysUntil(rec.expiry) <= 30
                                  ? <span style={{ color: daysUntil(rec.expiry) < 0 ? '#dc2626' : '#d97706', fontWeight:700 }}>
                                      {daysUntil(rec.expiry) < 0 ? ' ⚠ EXPIRED' : ` · ${daysUntil(rec.expiry)}d left`}
                                    </span>
                                  : null}
                              </div>
                            </div>
                            <span style={{ fontSize:'11px', color:'#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                          {/* Expanded */}
                          {isExpanded && (
                            <div style={{ padding:'12px', borderTop:'1px solid var(--bd3)', background:'#fafbfc' }}>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                                <div style={{ gridColumn:'span 2' }}><label style={S.label}>Course / Training Name</label>
                                  <input value={rec.courseName||''} onChange={e => setRec(tr.id, { courseName: e.target.value })}
                                    style={{ ...S.input, width:'100%' }} placeholder="e.g. Safe Scaffolding Erection and Dismantling" /></div>
                                <div><label style={S.label}>Certificate No</label>
                                  <input value={rec.certNo||''} onChange={e => setRec(tr.id, { certNo: e.target.value })}
                                    style={{ ...S.input, width:'100%' }} placeholder="Certificate number" /></div>
                                <div><label style={S.label}>Expiry Date</label>
                                  <input type="date" value={rec.expiry||''} onChange={e => setRec(tr.id, { expiry: e.target.value })}
                                    style={{ ...S.input, width:'100%' }} /></div>
                                <div><label style={S.label}>Issuing Company / Training Provider</label>
                                  <input value={rec.issuingCompany||''} onChange={e => setRec(tr.id, { issuingCompany: e.target.value })}
                                    style={{ ...S.input, width:'100%' }} placeholder="e.g. Crosswind, OPITO" /></div>
                                <div><label style={S.label}>Status</label>
                                  <select value={rec.status||''} onChange={e => setRec(tr.id, { status: e.target.value })}
                                    style={{ ...S.input, width:'100%' }}>
                                    <option value="">○ Pending</option>
                                    <option value="valid"><EmojiIcon e="✓" /> Valid</option>
                                    <option value="expired"><EmojiIcon e="⚠" /> Expired</option>
                                    <option value="not_required">— Not Required</option>
                                  </select>
                                </div>
                              </div>
                              <TrainingCertUploadPanel
                                trainingId={tr.id}
                                trainingLabel={tr.label}
                                empId={data.employee_id}
                                existingImgUrl={rec.imgData || null}
                                existingCertNo={rec.certNo || ''}
                                existingExpiry={rec.expiry || ''}
                                existingCourseName={rec.courseName || ''}
                                existingIssuingCompany={rec.issuingCompany || ''}
                                onApply={(vals) => {
                                  setRec(tr.id, {
                                    certNo: vals.certNo || rec.certNo,
                                    expiry: vals.expiry || rec.expiry,
                                    imgData: vals.imgData || rec.imgData,
                                    courseName: vals.courseName || rec.courseName,
                                    issuingCompany: vals.issuingCompany || rec.issuingCompany,
                                    status: vals.expiry ? (daysUntil(vals.expiry) >= 0 ? 'valid' : 'expired') : rec.status,
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {/* Notes */}
                <div style={{ marginTop:'16px' }}>
                  <label style={S.label}>General Notes</label>
                  <textarea value={data.notes||''} onChange={e => setData(d=>({...d, notes:e.target.value}))}
                    style={{ ...S.input, width:'100%', minHeight:'60px' }} placeholder="Any additional training notes..." />
                </div>
              </div>
            </div>

            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--bd1)', display:'flex', justifyContent:'flex-end', gap:'10px' }}>
              <button className="hr-btn" style={S.btnSec} onClick={onClose}>Cancel</button>
              <button className="hr-btn" style={{ ...S.btnPri, opacity: saving?0.7:1, cursor: saving?'default':'pointer' }} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save Training Record'}</button>
            </div>
          </div>
        </div>
      );
    }

    function TrainingView({ records, employees, onSave, onDelete, onSyncAll, showToast, loadAll }) {
      const [search, setSearch] = useState('');
      const [editing, setEditing] = useState(null);
      const [catFilter, setCatFilter] = useState('all');

      const sorted = useMemo(() => {
        let r = [...records].sort((a,b) => (a.employee_id||'').localeCompare(b.employee_id||''));
        if (search) {
          const s = search.toLowerCase();
          r = r.filter(x => {
            if ((x.employee_id||'').toLowerCase().includes(s)) return true;
            if ((x.full_name||'').toLowerCase().includes(s)) return true;
            if ((x.position||'').toLowerCase().includes(s)) return true;
            if ((x.cicpa_locations||'').toLowerCase().includes(s)) return true;
            if ((x.notes||'').toLowerCase().includes(s)) return true;
            // Search inside training_records JSON for course names, issuing companies, cert nos
            try {
              const p = JSON.parse(x.training_records || '{}');
              // Standard trainings
              if (ALL_STANDARD_TRAININGS.some(t => {
                const rec = p[t.id];
                if (!rec) return false;
                return (t.label||'').toLowerCase().includes(s) ||
                       (rec.courseName||'').toLowerCase().includes(s) ||
                       (rec.issuingCompany||'').toLowerCase().includes(s) ||
                       (rec.certNo||'').toLowerCase().includes(s) ||
                       (rec.notes||'').toLowerCase().includes(s);
              })) return true;
              // Other/custom trainings
              if ((p.__other || []).some(ot =>
                (ot.label||'').toLowerCase().includes(s) ||
                (ot.issuingCompany||'').toLowerCase().includes(s) ||
                (ot.certNo||'').toLowerCase().includes(s) ||
                (ot.notes||'').toLowerCase().includes(s)
              )) return true;
            } catch {}
            return false;
          });
        }
        return r;
      }, [records, search]);

      const getStats = (rec) => {
        try {
          const p = JSON.parse(rec.training_records || '{}');
          const valid = ALL_STANDARD_TRAININGS.filter(t => p[t.id]?.status === 'valid').length;
          const expired = ALL_STANDARD_TRAININGS.filter(t => p[t.id]?.status === 'expired').length;
          const total = ALL_STANDARD_TRAININGS.length;
          const others = (p.__other || []).length;
          return { valid, expired, total, others };
        } catch { return { valid:0, expired:0, total: ALL_STANDARD_TRAININGS.length, others:0 }; }
      };

      const handleEdit = async (rec) => {
        // Fetch latest from DB before opening modal
        const { data } = await db.from('employee_trainings').select('*').eq('id', rec.id).single();
        setEditing(data || rec);
      };

      return (
        <div>
          {/* Toolbar */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'14px 18px', marginBottom:'14px', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by Emp ID, Name, Position, CICPA locations, Course, Issuer, Cert No, Notes…"
              style={{ ...S.input, flex:1, minWidth:'200px' }} />
            <button className="hr-btn" style={{ ...S.btnSec, background:'#f0fdf4', color:'#166534', border:'1px solid #86efac', fontWeight:700 }} onClick={onSyncAll}>Sync All from Employees</button>
          </div>

          {/* Category legend */}
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
            {TRAINING_CATEGORIES.map(cat => (
              <div key={cat.id} style={{ background: cat.bg, color: cat.color, border:`1px solid ${cat.color}33`, padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:600 }}>
                {cat.label.split('—')[1]?.trim() || cat.label}
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
            <div className="xl-wrap hr-scroll">
              <table className="xl-table" style={{ width:'100%', minWidth:'700px' }}>
                <thead style={{ background:'#f8fafc' }}>
                  <tr>
                    <th className="xl-frozen" style={{ ...S.th, left:0, width:80, minWidth:80, maxWidth:80 }}>EMP ID</th>
                    <th className="xl-frozen xl-frozen-edge" style={{ ...S.th, left:80, width:170, minWidth:170, maxWidth:170 }}>FULL NAME</th>
                    <th className="hide-mobile" style={S.th}>POSITION</th>
                    <th className="hide-mobile" style={S.th}>CICPA LOCATIONS</th>
                    <th style={S.th}>ILOE</th>
                    <th style={S.th}>CERTIFICATIONS</th>
                    <th style={S.th}>EXPIRY DATES</th>
                    <th className="hide-mobile" style={S.th}>NOTES</th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>
                      {records.length === 0 ? 'No training records — click "Sync All from Employees" to create rows' : 'No results match your search'}
                    </td></tr>
                  ) : sorted.map(rec => {
                    const st = getStats(rec);
                    return (
                      <tr key={rec.id} className="hr-row" onClick={() => handleEdit(rec)} title="Click to open training record" style={{ borderTop:'1px solid var(--bd3)', cursor:'pointer' }}>
                        <td className="xl-frozen" style={{ ...S.td, left:0, width:80, minWidth:80, maxWidth:80, background:'#fff', fontFamily:'ui-monospace,monospace', fontWeight:700, color:'#2563eb' }}>{rec.employee_id}</td>
                        <td className="xl-frozen xl-frozen-edge" onClick={() => handleEdit(rec)} style={{ ...S.td, left:80, width:170, minWidth:170, maxWidth:170, overflow:'hidden', background:'#fff', fontWeight:600, cursor:'pointer' }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:'3px', overflow:'hidden' }}>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'12px', color:'#0078d4', textDecoration:'underline dotted' }} title={rec.full_name}>{rec.full_name}</span>
                            {(() => {
                              const { valid, expired, total, others } = st;
                              if (valid === 0 && expired === 0) return null;
                              return (
                                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                                  {valid > 0 && <span style={{ background:'#dcfce7', color:'#166534', fontSize:'9.5px', fontWeight:700, padding:'1px 6px', borderRadius:'8px' }}>{valid}/{total} valid</span>}
                                  {expired > 0 && <span style={{ background:'#fee2e2', color:'#991b1b', fontSize:'9.5px', fontWeight:700, padding:'1px 6px', borderRadius:'8px' }}>{expired} expired</span>}
                                  {others > 0 && <span style={{ background:'#eff6ff', color:'#1e40af', fontSize:'9.5px', fontWeight:700, padding:'1px 6px', borderRadius:'8px' }}>+{others} custom</span>}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="hide-mobile" style={{ ...S.td, fontSize:'12px' }}>{rec.position || '—'}</td>
                        <td className="hide-mobile" style={{ ...S.td, fontSize:'11.5px' }}>
                          {rec.cicpa_locations ? (
                            <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
                              {rec.cicpa_locations.split(',').map(l => l.trim()).filter(Boolean).map(l => (
                                <span key={l} style={{ background:'#f3e8ff', color:'#6b21a8', padding:'1px 7px', borderRadius:'10px', fontSize:'10.5px', fontWeight:600 }}>{l}</span>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ ...S.td, fontSize:'11.5px', color:'#64748b', maxWidth:'220px' }}>
                          {(() => {
                            try {
                              const p = JSON.parse(rec.training_records || '{}');
                              // Standard trainings (cat 1-6) that have any data entered
                              const stdItems = ALL_STANDARD_TRAININGS
                                .map(t => ({ ...p[t.id], _label: t.label, _id: t.id }))
                                .filter(r => r.status === 'valid' || r.status === 'expired' || r.certNo || r.issuingCompany || r.expiry);
                              // Custom / other certs
                              const otherItems = (p.__other || []);
                              const allItems = [...stdItems, ...otherItems];
                              if (!allItems.length) return <span style={{ color:'#94a3b8', fontSize:'11px' }}>—</span>;
                              return (
                                <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                                  {stdItems.map((r, i) => {
                                    const statusColor = r.status === 'valid' ? '#166534' : r.status === 'expired' ? '#991b1b' : '#64748b';
                                    const statusBg    = r.status === 'valid' ? '#dcfce7'  : r.status === 'expired' ? '#fee2e2'  : '#f1f5f9';
                                    const statusBdr   = r.status === 'valid' ? '#86efac'  : r.status === 'expired' ? '#fca5a5'  : '#e2e8f0';
                                    return (
                                      <div key={r._id + i}
                                        title={[r.courseName || r._label, r.issuingCompany, r.certNo, r.expiry ? 'Exp: '+fmtDateDisplay(r.expiry) : ''].filter(Boolean).join(' · ')}
                                        style={{ display:'flex', flexDirection:'column', background: statusBg, border:`1px solid ${statusBdr}`,
                                          padding:'3px 8px', borderRadius:'6px', fontSize:'10.5px' }}>
                                        <span style={{ fontWeight:700, color: statusColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'170px' }}>
                                          {r.courseName || r._label}
                                        </span>
                                        {r.issuingCompany && <span style={{ color:'#475569', fontSize:'10px' }}>{r.issuingCompany}</span>}
                                        {r.certNo && <span style={{ color:'#64748b', fontSize:'9.5px', fontFamily:'ui-monospace,monospace' }}>{r.certNo}</span>}
                                      </div>
                                    );
                                  })}
                                  {otherItems.map((ot, i) => (
                                    <div key={'oth'+i}
                                      title={[ot.courseName||ot.label, ot.issuingCompany, ot.certNo, ot.expiry ? 'Exp: '+fmtDateDisplay(ot.expiry) : ''].filter(Boolean).join(' · ')}
                                      style={{ display:'flex', flexDirection:'column', background:'#eff6ff', border:'1px solid #bfdbfe',
                                        padding:'3px 8px', borderRadius:'6px', fontSize:'10.5px' }}>
                                      <span style={{ fontWeight:700, color:'#1e40af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'170px' }}>
                                        {ot.courseName || ot.label || `Cert ${i+1}`}
                                      </span>
                                      {ot.issuingCompany && <span style={{ color:'#475569', fontSize:'10px' }}>{ot.issuingCompany}</span>}
                                      {ot.certNo && <span style={{ color:'#64748b', fontSize:'9.5px', fontFamily:'ui-monospace,monospace' }}>{ot.certNo}</span>}
                                    </div>
                                  ))}
                                </div>
                              );
                            } catch { return <span style={{ color:'#94a3b8', fontSize:'11px' }}>—</span>; }
                          })()}
                        </td>
                        <td style={{ ...S.td, fontSize:'11.5px', minWidth:'160px' }}>
                          {(() => {
                            try {
                              const p = JSON.parse(rec.training_records || '{}');
                              // Standard trainings with expiry dates
                              const stdWithExpiry = ALL_STANDARD_TRAININGS
                                .map(t => ({ ...p[t.id], _label: t.label, _id: t.id }))
                                .filter(r => r.expiry);
                              // Custom certs with expiry
                              const otherWithExpiry = (p.__other || []).filter(c => c.expiry);
                              const allWithExpiry = [...stdWithExpiry, ...otherWithExpiry];
                              if (!allWithExpiry.length) return <span style={{ color:'#94a3b8', fontSize:'11px' }}>—</span>;
                              return (
                                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                  {allWithExpiry.map((item, i) => {
                                    const d = daysUntil(item.expiry);
                                    const expired = d !== null && d < 0;
                                    const col = d === null ? '#64748b' : expired ? '#dc2626' : d <= 30 ? '#d97706' : '#059669';
                                    const name = item.courseName || item._label || item.label || '';
                                    return (
                                      <div key={item._id || item.cid || i} style={{ display:'flex', flexDirection:'column', gap:'2px',
                                        background: expired ? '#fee2e2' : d !== null && d <= 30 ? '#fef3c7' : '#f0fdf4',
                                        border: `1px solid ${col}30`, borderRadius:'6px', padding:'4px 8px' }}>
                                        {name && <span style={{ fontSize:'9.5px', color:'#475569', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'150px' }} title={name}>{name}</span>}
                                        <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                                          <span style={{ fontSize:'10px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDateDisplay(item.expiry)}</span>
                                          <span style={{ flexShrink:0, background: col, color:'#fff', padding:'1px 6px',
                                            borderRadius:'8px', fontSize:'10px', fontWeight:700, whiteSpace:'nowrap' }}>
                                            {d === null ? '?' : expired ? `${Math.abs(d)}d expired` : `${d}d left`}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {(p.__other || []).filter(c => !c.expiry).length > 0 && (
                                    <span style={{ color:'#94a3b8', fontSize:'10px' }}>{(p.__other||[]).filter(c=>!c.expiry).length} no expiry set</span>
                                  )}
                                </div>
                              );
                            } catch { return <span style={{ color:'#94a3b8', fontSize:'11px' }}>—</span>; }
                          })()}
                        </td>
                        <td style={{ ...S.td, fontSize:'11.5px', maxWidth:'140px', color:'#64748b' }}>{rec.notes || '—'}</td>
                        <td style={{ ...S.td, textAlign:'right' }}>
                          <div style={{ display:'flex', gap:'4px', justifyContent:'flex-end' }}>
                            <button onClick={() => handleEdit(rec)} style={{ ...S.iconBtn, color:'#2563eb' }} title="Edit training">&#9998;</button>
                            <button onClick={() => onDelete(rec.id, rec.full_name)} style={{ ...S.iconBtn, color:'#dc2626' }} title="Delete training record"></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b' }}>{sorted.length} record{sorted.length !== 1 ? 's' : ''}</div>

          {editing && <TrainingModal record={editing} employees={employees} onSave={async (d) => { await onSave(d); setEditing(null); }} onClose={() => setEditing(null)} showToast={showToast} />}
        </div>
      );
    }

  