    // ── PART 3: Employee Modal · Contacts · MobDemob · Hiring Pipeline ──
    // ============ MODALS ============
    function EmployeeModal({ employee, onSave, onClose, showToast }) {
      const [data, setData] = useState(employee);
      const [saving, setSaving] = useState(false);
      const [showJoiningReport, setShowJoiningReport] = useState(false);
      const set = (k,v) => setData(d => ({ ...d, [k]:v }));
      const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try { await onSave(data); }
        catch (e) { console.error('Save Employee failed:', e); (showToast||alert)('❌ Save failed: ' + (e && e.message ? e.message : 'unknown error — check browser console for details'), 'error'); }
        finally { setSaving(false); }
      };
      const groups = { identity:'Identity', employment:'Employment', salary:'Salary', documents:'Documents', contact:'Contact', emergency:'Emergency Contact', training:'Training' };
      const isNew = !employee.id;
      return (
        <div style={S.overlay} onClick={onClose}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 22px', borderBottom:'1px solid var(--bd1)' }}><h2 style={{ margin:0, fontSize:'17px' }}>{isNew?'Add Employee':`Edit: ${employee.full_name||employee.employee_id}`}</h2><button onClick={onClose} style={S.iconBtn}>×</button></div>
            <div style={{ padding:'18px 22px', overflowY:'auto', flex:1 }}>
              {Object.entries(groups).map(([gk,gl])=>(
                <div key={gk} style={{ marginBottom:'20px' }}>
                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', margin:'0 0 10px', fontWeight:700 }}>{gl}</h3>

                  {/* Document upload panel only inside Documents group */}
                  {gk === 'documents' && (
                    <div style={{ marginBottom:'14px' }}>
                      <div style={{ fontSize:'11.5px', color:'#475569', fontWeight:600, marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px' }}>Documents<span style={{ fontSize:'10px', color:'#94a3b8', fontWeight:400 }}>Upload passport, EID, visa, insurance, or CICPA scans. Click "Use →" after scanning to copy detected values — then verify and correct if needed.</span>
                      </div>
                      <DocumentUploadPanel data={data} setField={set} employeeId={data.employee_id || data.id} />
                    </div>
                  )}

                  {/* Training section — upload certs directly from employee modal */}
                  {gk === 'training' && (
                    <TrainingInlinePanel employeeId={data.employee_id} employeeName={data.full_name} position={data.position} cicpaLocations={data.cicpa_locations} />
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px' }}>
                    {gk !== 'training' && EMPLOYEE_FIELDS.filter(f=>f.group===gk && f.type !== 'img_url').map(f=>{
                      if (f.type === 'locations') {
                        const current = (data[f.key] || '').split(',').map(s=>s.trim()).filter(Boolean);
                        const presetSelected = current.filter(loc => CICPA_LOCATIONS.includes(loc));
                        const customLocations = current.filter(loc => !CICPA_LOCATIONS.includes(loc)).join(', ');
                        const toggle = (loc) => {
                          const next = presetSelected.includes(loc)
                            ? presetSelected.filter(x=>x!==loc)
                            : [...presetSelected, loc];
                          const customList = customLocations.split(',').map(s=>s.trim()).filter(Boolean);
                          const merged = [...next, ...customList].join(', ');
                          set(f.key, merged);
                        };
                        const updateCustom = (val) => {
                          const customList = val.split(',').map(s=>s.trim()).filter(Boolean);
                          const merged = [...presetSelected, ...customList].join(', ');
                          set(f.key, merged);
                        };
                        return (
                          <div key={f.key} style={{ gridColumn:'span 2', background:'#fafbfc', border:'1px solid var(--bd1)', borderRadius:'8px', padding:'12px' }}>
                            <label style={{ display:'block', fontSize:'11.5px', color:'#475569', marginBottom:'8px', fontWeight:600 }}>{f.label} <span style={{ color:'#94a3b8', fontWeight:400, fontSize:'10.5px' }}>(tick all that apply)</span></label>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
                              {CICPA_LOCATIONS.map(loc => {
                                const active = presetSelected.includes(loc);
                                return (
                                  <button key={loc} type="button" onClick={()=>toggle(loc)}
                                    style={{ background: active ? '#7c3aed' : '#fff', color: active ? '#fff' : '#475569', border: active ? '1px solid #7c3aed' : '1px solid #cbd5e1', padding:'5px 11px', borderRadius:'16px', fontSize:'11.5px', fontWeight:600, cursor:'pointer' }}>
                                    {active && <EmojiIcon e="✅" style={{ marginRight:5 }} />}{loc}
                                  </button>
                                );
                              })}
                            </div>
                            <label style={{ display:'block', fontSize:'10.5px', color:'#64748b', marginBottom:'4px' }}>Other ADNOC location(s) <span style={{ color:'#94a3b8' }}>— comma-separated</span></label>
                            <input type="text" value={customLocations} onChange={e=>updateCustom(e.target.value)} placeholder="e.g. Bu Hasa, Sahil" style={{ ...S.input, width:'100%' }} />
                            {current.length > 0 && <div style={{ marginTop:'8px', fontSize:'10.5px', color:'#7c3aed', fontWeight:600 }}>Selected: {current.join(' • ')}</div>}
                          </div>
                        );
                      }
                      // Insurance company dropdown
                      if (f.type === 'insurance_company') {
                        const currentVal = data[f.key] || '';
                        const isKnown = INSURANCE_COMPANIES.filter(c => c !== 'Other').includes(currentVal);
                        const selectVal = (currentVal === '__other__' || (!isKnown && currentVal !== '')) ? 'Other' : (isKnown ? currentVal : '');
                        return (
                          <div key={f.key}>
                            <label style={{ display:'block', fontSize:'11.5px', color:'#475569', marginBottom:'4px', fontWeight:500 }}>{f.label}</label>
                            <select value={selectVal} onChange={e => {
                              if (e.target.value === 'Other') set(f.key, '__other__');
                              else set(f.key, e.target.value);
                            }} style={{ ...S.input, width:'100%', marginBottom: selectVal === 'Other' ? '6px' : 0 }}>
                              <option value="">Select provider…</option>
                              {INSURANCE_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {selectVal === 'Other' && (
                              <input type="text" value={currentVal === '__other__' ? '' : (!isKnown ? currentVal : '')}
                                onChange={e => set(f.key, e.target.value)}
                                placeholder="Type insurance company name…"
                                style={{ ...S.input, width:'100%' }} />
                            )}
                          </div>
                        );
                      }
                      // Date fields: always render as type="date" for calendar picker
                      if (f.type === 'date') {
                        const isExpiry = !!f.expiry;
                        return (
                          <div key={f.key}>
                            <label style={{ display:'block', fontSize:'11.5px', color:'#475569', marginBottom:'4px', fontWeight:500 }}>
                              {f.label}
                              {f.required && <span style={{color:'#dc2626'}}> *</span>}
                              {isExpiry && <span style={{color:'#ea580c',marginLeft:'4px',fontSize:'10px'}}>(tracked)</span>}
                            </label>
                            <input
                              type="date"
                              value={data[f.key] || ''}
                              onChange={e => set(f.key, e.target.value)}
                              style={{ ...S.input, width:'100%',
                                border: isExpiry && data[f.key] ? '1.5px solid #f59e0b' : '1px solid #cbd5e1' }}
                            />
                            {isExpiry && data[f.key] && (() => {
                              const d = daysUntil(data[f.key]);
                              if (d === null) return null;
                              const c = d < 0 ? '#dc2626' : d <= 30 ? '#ea580c' : '#059669';
                              return <div style={{ fontSize:'10.5px', color:c, marginTop:'3px', fontWeight:600 }}>
                                <EmojiLabel text={d < 0 ? `⚠ Expired ${Math.abs(d)}d ago` : `✓ ${d} days remaining`} />
                              </div>;
                            })()}
                          </div>
                        );
                      }
                      return (
                        <div key={f.key}><label style={{ display:'block', fontSize:'11.5px', color:'#475569', marginBottom:'4px', fontWeight:500 }}>{f.label}{f.required&&<span style={{color:'#dc2626'}}> *</span>}{f.expiry&&<span style={{color:'#ea580c',marginLeft:'4px',fontSize:'10px'}}>(tracked)</span>}</label>
                          <input type={f.type==='number'?'number':'text'} value={data[f.key]||''} onChange={e=>set(f.key,e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--bd1)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px' }}>
              <div style={{ display:'flex', gap:'10px' }}>
                <button className="hr-btn" onClick={() => printEmployeeProfile(data)} style={{ background:'#0f2744', color:'#fff', border:'none', padding:'8px 16px', borderRadius:'6px', fontSize:'14.5px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>Print Profile</button>
                <button className="hr-btn" onClick={() => setShowJoiningReport(true)} style={{ background:'#0f766e', color:'#fff', border:'none', padding:'8px 16px', borderRadius:'6px', fontSize:'14.5px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}><EmojiLabel text="📝 Joining Report" /></button>
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button className="hr-btn" style={S.btnSec} onClick={onClose} disabled={saving}>Cancel</button>
                <button className="hr-btn" style={{ ...S.btnPri, opacity: saving?0.7:1, cursor: saving?'default':'pointer' }} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save Employee'}</button>
              </div>
            </div>
            {showJoiningReport && (
              <JoiningReportModal
                employee={data}
                onClose={()=>setShowJoiningReport(false)}
                onSaved={async (patch) => { setData(d => ({ ...d, ...patch })); }}
                showToast={showToast}
              />
            )}
          </div>
        </div>
      );
    }


    // ============================================================
    // JOINING REPORT — one-page PDF stamped on the real SATCO letterhead
    // (header/footer artwork fetched from satco-letterhead-header.jpg / -footer.jpg)
    // ============================================================
    const generateJoiningReportPdf = async (f) => {
      const { PDFDocument, rgb, StandardFonts } = PDFLib;

      const NAVY  = rgb(0.051,0.133,0.251);
      const BLACK = rgb(0,0,0);
      const DGRAY = rgb(0.282,0.349,0.412);
      const MGRAY = rgb(0.580,0.631,0.690);
      const LGRAY = rgb(0.945,0.961,0.980);
      const BORDER= rgb(0.796,0.851,0.906);

      const pdfDoc = await PDFDocument.create();
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const fetchBytes = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());
      const headerImg = await pdfDoc.embedJpg(await fetchBytes('./satco-letterhead-header.jpg'));
      const footerImg = await pdfDoc.embedJpg(await fetchBytes('./satco-letterhead-footer.jpg'));

      const PW = 595.28, PH = 841.89;
      const ML = 34, MR = 34, CW = PW - ML - MR;

      const page = pdfDoc.addPage([PW, PH]);

      // ── real letterhead header artwork ──
      const hRatio = headerImg.height / headerImg.width;
      const hW = CW, hH = hW * hRatio;
      page.drawImage(headerImg, { x: ML, y: PH - 22 - hH, width: hW, height: hH });

      // ── real letterhead footer artwork ──
      const fRatio = footerImg.height / footerImg.width;
      const fW = CW, fH = fW * fRatio;
      page.drawImage(footerImg, { x: ML, y: 18, width: fW, height: fH });

      let y = PH - 22 - hH - 20;

      const toWA = s => String(s||'')
        .replace(/–/g,'-').replace(/—/g,'--')
        .replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
        .replace(/•/g,'*').replace(/…/g,'...')
        .replace(/[^\x00-\xFF]/g,'?');

      const txt = (s, x, yy, opts={}) => {
        const drawn = toWA(s);
        if (!drawn) return;
        page.drawText(drawn, { x, y:yy, font: opts.bold?bold:reg, size: opts.size||9, color: opts.color||BLACK });
      };

      const rect = (x, yy, w, h, opts={}) => page.drawRectangle({
        x, y:yy, width:w, height:h,
        color:opts.fill||undefined, borderColor:opts.stroke||undefined, borderWidth: opts.lw||(opts.stroke?0.6:0)
      });

      // Paragraph made of alternating [text, isBold] runs, word-wrapped across the page width
      const drawRuns = (runs, x, yy, maxW, size, lineGap) => {
        const words = [];
        runs.forEach(([t,isBold]) => {
          const parts = toWA(t).split(/(\s+)/);
          parts.forEach(chunk => { if (chunk) words.push([chunk, isBold]); });
        });
        let cx = x, cy = yy, lineWords = [];
        const flush = () => {
          let px = x;
          lineWords.forEach(([w,b]) => {
            if (w.trim()==='') { px += reg.widthOfTextAtSize(' ', size); return; }
            const fnt = b?bold:reg;
            page.drawText(w, { x:px, y:cy, size, font:fnt, color: b?NAVY:BLACK });
            px += fnt.widthOfTextAtSize(w, size);
          });
          lineWords = []; cy -= lineGap; cx = x;
        };
        words.forEach(([w,b]) => {
          const fnt = b?bold:reg;
          const ww = fnt.widthOfTextAtSize(w, size);
          if (cx - x + ww > maxW && w.trim()!=='') flush();
          lineWords.push([w,b]); cx += ww;
        });
        if (lineWords.length) flush();
        return cy;
      };

      const sectionHead = (label, yy) => {
        rect(ML, yy-14, CW, 14, {fill:NAVY});
        txt(label.toUpperCase(), ML+7, yy-10.5, {bold:true, size:8, color:rgb(1,1,1)});
        return yy - 18;
      };

      const fieldRow = (label, value, x, yy, w) => {
        const IH = 22;
        rect(x, yy-IH, w, IH, {fill:LGRAY, stroke:BORDER, lw:0.5});
        txt(label.toUpperCase(), x+5, yy-9, {bold:true, size:6, color:DGRAY});
        txt(value||'—', x+5, yy-IH+6, {size:8.5, bold:true, color: value?BLACK:MGRAY});
        return IH+3;
      };

      const fieldGrid = (pairs, yy, cols=2) => {
        const gap=6, cw=(CW-(cols-1)*gap)/cols;
        let ci=0, rowY=yy, rowH=0;
        pairs.forEach(([label,value])=>{
          const x = ML + ci*(cw+gap);
          const h = fieldRow(label, value, x, rowY, cw);
          rowH = Math.max(rowH, h); ci++;
          if (ci>=cols) { rowY -= rowH; rowH=0; ci=0; }
        });
        if (ci) rowY -= rowH;
        return yy - rowY;
      };

      const checkRow = (label, yesNo, yy) => {
        txt(label, ML, yy, {size:8.5, color:DGRAY});
        const mk = (bx, checked, letter) => {
          rect(bx, yy-9, 10, 10, {stroke:BORDER, lw:0.6});
          if (checked) txt('X', bx+2.5, yy-7, {bold:true, size:8, color:NAVY});
          txt(letter, bx+14, yy-7, {size:8, color:DGRAY});
        };
        mk(ML+300, yesNo==='Yes', 'Yes');
        mk(ML+350, yesNo==='No', 'No');
        return yy - 16;
      };

      // ── TITLE ──
      const title = 'JOINING REPORT';
      txt(title, PW/2 - bold.widthOfTextAtSize(title,15)/2, y, {bold:true, size:15, color:NAVY});
      y -= 6;
      page.drawLine({ start:{x:ML,y:y-4}, end:{x:PW-MR,y:y-4}, thickness:1, color:NAVY });
      y -= 20;

      txt('Dated:', PW-MR-150, y, {bold:true, size:9, color:DGRAY});
      txt(f.reportDateDisp||'', PW-MR-105, y, {size:9, color:BLACK});
      page.drawLine({start:{x:PW-MR-108,y:y-2},end:{x:PW-MR,y:y-2},thickness:0.6,color:BORDER});
      y -= 24;

      // ── STATEMENT ──
      const runs = [
        ['I, Mr. / Mrs. / Miss ', false], [f.fullName||'_______________', true],
        [' appointed as ', false], [f.position||'_______________', true],
        [', has reported for duty at ', false], [f.dutyLocation||'SATCO Arabia Head Office - ME-12', true],
        [' on this day ', false], [f.reportDateDisp||'_______________', true],
        [' at ', false], [f.reportTime||'____', true], [' hours.', false],
      ];
      y = drawRuns(runs, ML, y, CW, 9.5, 15) - 6;

      page.drawLine({ start:{x:PW-MR-160, y}, end:{x:PW-MR, y}, thickness:0.6, color:BLACK });
      y -= 10;
      txt('Signature of Employee', PW-MR-160, y, {size:7.5, color:MGRAY});
      y -= 20;

      // ── EMPLOYEE DETAILS ──
      y = sectionHead('Employee Details', y);
      y -= fieldGrid([
        ['Employee No.', f.employeeId],
        ['Nationality', f.nationality],
        ['Mobile Number', f.mobile],
        ['Email', f.email],
        ['Passport No.', f.passportNo],
        ['Passport Expiry', f.passportExpiryDisp],
        ['Date of Actual Arrival / Coming to Camp', f.campArrivalDateDisp],
        ['Date of Actual Joining (Residence Visa Issued)', f.actualJoiningDateDisp],
      ], y);
      y -= 8;

      // ── EMERGENCY CONTACT ──
      y = sectionHead('Emergency Contact', y);
      y -= fieldGrid([
        ['Contact Name', f.emergencyName],
        ['Relationship', f.emergencyRelation],
        ['Mobile Number', f.emergencyMobile],
        ['Country', f.emergencyCountry],
      ], y);
      y -= 10;

      // ── FOR OFFICE USE ONLY ──
      y = sectionHead('For Office Use Only', y);
      y -= 4;
      txt('Employee Number', ML, y, {size:8.5, bold:true, color:DGRAY});
      txt(f.employeeId||'_______________', ML+110, y, {size:9, bold:true, color:BLACK});
      txt('issued.', ML+260, y, {size:8.5, color:DGRAY});
      y -= 16;
      txt('Selected for', ML, y, {size:8.5, bold:true, color:DGRAY});
      txt(f.selectedFor||'Workforce', ML+110, y, {size:9, bold:true, color:BLACK});
      txt('site office.', ML+260, y, {size:8.5, color:DGRAY});
      y -= 16;
      y = checkRow('Accommodation arranged', f.accommodationArranged, y);
      y = checkRow('All relevant documents completed', f.docsCompleted, y);
      y -= 14;

      page.drawLine({ start:{x:ML, y}, end:{x:ML+170, y}, thickness:0.6, color:BLACK });
      y -= 10;
      txt('( Head of Personnel )', ML, y, {size:7.5, color:MGRAY});
      y -= 20;

      txt('Distribution:', ML, y, {bold:true, size:8, color:DGRAY}); y -= 13;
      txt('1.  Personal File', ML+10, y, {size:8, color:DGRAY}); y -= 12;
      txt('2.  Others', ML+10, y, {size:8, color:DGRAY});

      txt('SATCO Arabia General Contracting LLC  ·  CONFIDENTIAL  ·  Generated ' + (f.printedOn||''), ML, 18 + fH + 6, {size:6, color:MGRAY});

      return await pdfDoc.save();
    };

    // ============================================================
    // JOINING REPORT MODAL — HR previews & edits before saving as PDF
    // ============================================================
    function JoiningReportModal({ employee, onClose, onSaved, showToast }) {
      const e = employee || {};
      const today = new Date().toISOString().slice(0,10);
      const [form, setForm] = useState({
        fullName: e.full_name || '',
        employeeId: e.employee_id || '',
        position: e.position || '',
        nationality: e.nationality || '',
        mobile: e.mobile || e.uae_contact || '',
        email: e.email || '',
        passportNo: e.passport_no || '',
        passportExpiry: e.passport_expiry || '',
        dutyLocation: 'SATCO Arabia Head Office - ME-12',
        reportDate: today,
        reportTime: '09:00',
        campArrivalDate: e.camp_arrival_date || '',
        actualJoiningDate: e.actual_joining_date || '',
        emergencyName: e.emergency_name || '',
        emergencyRelation: e.emergency_relation || '',
        emergencyMobile: e.emergency_mobile || '',
        emergencyCountry: e.emergency_country || '',
        selectedFor: e.department || 'Workforce',
        accommodationArranged: '',
        docsCompleted: '',
      });
      const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
      const [pdfUrl, setPdfUrl] = useState(null);
      const [pdfBytes, setPdfBytes] = useState(null);
      const [busy, setBusy] = useState(false);
      const [previewError, setPreviewError] = useState(null);
      const canvasRef = React.useRef(null);
      const set = (k,v) => setForm(d => ({ ...d, [k]: v }));

      useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

      // Render the generated PDF onto a <canvas> via pdf.js. We do this instead of an
      // <iframe src=blob:...> because inline blob-PDF viewing depends on the host browser's
      // native PDF plugin, which isn't always available inside an embedded/desktop webview —
      // canvas rendering works everywhere.
      useEffect(() => {
        if (mode !== 'preview' || !pdfBytes) return;
        let cancelled = false;
        setPreviewError(null);
        (async () => {
          try {
            if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
            }
            const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes.slice() });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = canvasRef.current;
            if (!canvas || cancelled) return;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          } catch (err) {
            console.error('PDF preview render failed:', err);
            if (!cancelled) setPreviewError(err && err.message ? err.message : 'Could not render preview');
          }
        })();
        return () => { cancelled = true; };
      }, [mode, pdfBytes]);

      const buildFields = () => ({
        fullName: form.fullName, employeeId: form.employeeId, position: form.position,
        nationality: form.nationality, mobile: form.mobile, email: form.email,
        passportNo: form.passportNo,
        passportExpiryDisp: form.passportExpiry ? fmtDateDisplay(form.passportExpiry) : '',
        dutyLocation: form.dutyLocation,
        reportDateDisp: form.reportDate ? fmtDateDisplay(form.reportDate) : '',
        reportTime: form.reportTime,
        campArrivalDateDisp: form.campArrivalDate ? fmtDateDisplay(form.campArrivalDate) : '',
        actualJoiningDateDisp: form.actualJoiningDate ? fmtDateDisplay(form.actualJoiningDate) : '',
        emergencyName: form.emergencyName, emergencyRelation: form.emergencyRelation,
        emergencyMobile: form.emergencyMobile, emergencyCountry: form.emergencyCountry,
        selectedFor: form.selectedFor, accommodationArranged: form.accommodationArranged,
        docsCompleted: form.docsCompleted,
        printedOn: new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),
      });

      const runPreview = async () => {
        setBusy(true);
        try {
          const bytes = await generateJoiningReportPdf(buildFields());
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setPdfBytes(bytes); setPdfUrl(url); setMode('preview');
        } catch (err) {
          console.error('Joining report generation failed:', err);
          (showToast||alert)('❌ Could not generate PDF: ' + (err && err.message ? err.message : 'unknown error'), 'error');
        } finally { setBusy(false); }
      };

      const doSaveAndDownload = async () => {
        setBusy(true);
        try {
          if (onSaved) {
            await onSaved({
              camp_arrival_date: form.campArrivalDate || null,
              actual_joining_date: form.actualJoiningDate || null,
              emergency_name: form.emergencyName || null,
              emergency_relation: form.emergencyRelation || null,
              emergency_mobile: form.emergencyMobile || null,
              emergency_country: form.emergencyCountry || null,
            });
          }
          const bytes = pdfBytes || await generateJoiningReportPdf(buildFields());
          const blob = new Blob([bytes], { type:'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `SATCO_Joining_Report_${(form.fullName||'Employee').replace(/[^a-zA-Z0-9]/g,'_')}.pdf`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(()=>URL.revokeObjectURL(url), 4000);
          (showToast||(()=>{}))('✅ Joining report saved & downloaded', 'success');
          onClose();
        } catch (err) {
          console.error('Save & download failed:', err);
          (showToast||alert)('❌ Save failed: ' + (err && err.message ? err.message : 'unknown error'), 'error');
        } finally { setBusy(false); }
      };

      const Field = ({ label, k, type='text' }) => (
        <label style={{ display:'flex', flexDirection:'column', gap:'4px', fontSize:'11.5px', color:'#475569', fontWeight:600 }}>
          {label}
          <input type={type} value={form[k]||''} onChange={ev=>set(k, ev.target.value)} style={{ ...S.input }} />
        </label>
      );
      const Select = ({ label, k, options }) => (
        <label style={{ display:'flex', flexDirection:'column', gap:'4px', fontSize:'11.5px', color:'#475569', fontWeight:600 }}>
          {label}
          <select value={form[k]||''} onChange={ev=>set(k, ev.target.value)} style={{ ...S.input }}>
            <option value="">— Select —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );

      return (
        <div style={{ ...S.overlay, zIndex:300 }} onClick={onClose}>
          <div style={{ ...S.modal, maxWidth:'920px', width:'95%', height:'90vh', maxHeight:'90vh' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 22px', borderBottom:'1px solid var(--bd1)' }}>
              <h2 style={{ margin:0, fontSize:'17px' }}><EmojiLabel text={`📝 Joining Report — ${form.fullName || 'Employee'}`} /></h2>
              <button onClick={onClose} style={S.iconBtn}>×</button>
            </div>

            {mode === 'edit' && (
              <>
                <div style={{ padding:'18px 22px', overflowY:'auto', flex:1 }}>
                  <div style={{ fontSize:'12px', color:'#64748b', marginBottom:'14px' }}>
                    Review and fill in the details, then preview the PDF before saving. The Date of Arrival at Camp, Date of Actual Joining and Emergency Contact details entered here are also saved back onto this employee's record.
                  </div>

                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', margin:'0 0 10px', fontWeight:700 }}>Statement</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px', marginBottom:'18px' }}>
                    <Field label="Full Name" k="fullName" />
                    <Field label="Position / Designation" k="position" />
                    <Field label="Reporting Location" k="dutyLocation" />
                    <Field label="Date of Reporting" k="reportDate" type="date" />
                    <Field label="Reporting Time" k="reportTime" type="time" />
                  </div>

                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', margin:'0 0 10px', fontWeight:700 }}>Employee Details</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px', marginBottom:'18px' }}>
                    <Field label="Employee Number" k="employeeId" />
                    <Field label="Nationality" k="nationality" />
                    <Field label="Mobile Number" k="mobile" />
                    <Field label="Email" k="email" />
                    <Field label="Passport No." k="passportNo" />
                    <Field label="Passport Expiry" k="passportExpiry" type="date" />
                    <Field label="Date of Actual Arrival / Coming to Camp" k="campArrivalDate" type="date" />
                    <Field label="Date of Actual Joining (Residence Visa Issued)" k="actualJoiningDate" type="date" />
                  </div>

                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', margin:'0 0 10px', fontWeight:700 }}>Emergency Contact</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px', marginBottom:'18px' }}>
                    <Field label="Contact Name" k="emergencyName" />
                    <Field label="Relationship" k="emergencyRelation" />
                    <Field label="Mobile Number" k="emergencyMobile" />
                    <Field label="Country" k="emergencyCountry" />
                  </div>

                  <h3 style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', margin:'0 0 10px', fontWeight:700 }}>For Office Use Only</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px' }}>
                    <Field label="Selected For (Site / Department)" k="selectedFor" />
                    <Select label="Accommodation Arranged" k="accommodationArranged" options={['Yes','No']} />
                    <Select label="All Relevant Documents Completed" k="docsCompleted" options={['Yes','No']} />
                  </div>
                </div>
                <div style={{ padding:'14px 22px', borderTop:'1px solid var(--bd1)', display:'flex', justifyContent:'flex-end', gap:'10px' }}>
                  <button className="hr-btn" onClick={onClose} style={S.btnSec}>Cancel</button>
                  <button className="hr-btn" onClick={runPreview} disabled={busy} style={{ ...S.btnPri, opacity: busy?0.7:1 }}>{busy ? 'Generating…' : 'Preview PDF →'}</button>
                </div>
              </>
            )}

            {mode === 'preview' && (
              <>
                <div style={{ flex:1, overflow:'auto', padding:'12px 22px', display:'flex', flexDirection:'column', alignItems:'center', background:'#f1f5f9' }}>
                  {previewError ? (
                    <div style={{ padding:'20px', textAlign:'center', color:'#dc2626', fontSize:'13px' }}>
                      Could not render an in-app preview ({previewError}).<br/>
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#2563eb', fontWeight:700 }}>Open the PDF in a new tab</a> to check it before saving.
                    </div>
                  ) : (
                    <canvas ref={canvasRef} style={{ boxShadow:'0 2px 10px rgba(0,0,0,0.15)', background:'#fff', maxWidth:'100%' }} />
                  )}
                  {!previewError && pdfUrl && (
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop:'10px', fontSize:'11.5px', color:'#2563eb' }}>Open in new tab ↗</a>
                  )}
                </div>
                <div style={{ padding:'14px 22px', borderTop:'1px solid var(--bd1)', display:'flex', justifyContent:'flex-end', gap:'10px' }}>
                  <button className="hr-btn" onClick={()=>setMode('edit')} style={S.btnSec}>← Edit</button>
                  <button className="hr-btn" onClick={doSaveAndDownload} disabled={busy} style={{ ...S.btnPri, opacity: busy?0.7:1 }}><EmojiLabel text={busy ? 'Saving…' : '💾 Save & Download PDF'} /></button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    // ============================================================
    // PRINT EMPLOYEE PROFILE — Smart A4 PDF, skips empty sections
    // ============================================================
    const printEmployeeProfile = async (emp) => {
      const { PDFDocument, rgb, StandardFonts } = PDFLib;

      const NAVY  = rgb(0.059,0.133,0.251);
      const BLUE  = rgb(0.102,0.337,0.859);
      const WHITE = rgb(1,1,1);
      const BLACK = rgb(0,0,0);
      const DGRAY = rgb(0.282,0.349,0.412);
      const MGRAY = rgb(0.580,0.631,0.690);
      const LGRAY = rgb(0.945,0.961,0.980);
      const BORDER= rgb(0.796,0.851,0.906);
      const GREEN = rgb(0.024,0.373,0.243);
      const GREEN_B=rgb(0.878,0.996,0.925);
      const RED   = rgb(0.863,0.149,0.149);
      const RED_B = rgb(0.994,0.886,0.886);
      const AMBER = rgb(0.851,0.471,0.027);
      const AMB_B = rgb(0.996,0.957,0.882);

      const pdfDoc = await PDFDocument.create();
      const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const PW = 595.28, PH = 841.89;
      const ML = 14*2.835, MR = 14*2.835, CW = PW-ML-MR;

      let page, y;
      const addPage = () => {
        page = pdfDoc.addPage([PW,PH]);
        y = PH - 10*2.835;
        // Footer on every page
        page.drawLine({start:{x:ML,y:8*2.835+8},end:{x:PW-MR,y:8*2.835+8},thickness:0.4,color:MGRAY});
        drawTxt('SATCO Arabia General Contracting  |  satcoarabiaengg.com  |  CONFIDENTIAL', ML, 8*2.835+2, {size:5.5,color:MGRAY});
        drawTxt(emp.employee_id||'', PW-MR-40, 8*2.835+2, {size:5.5,color:MGRAY,bold:true});
      };

      // ── helpers ──────────────────────────────────────────────────────────
      const toWA = s => String(s||'').replace(/[^-ÿ]/g,'?')
        .replace(/–/g,'-').replace(/—/g,'--')
        .replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
        .replace(/•/g,'*').replace(/…/g,'...');

      const clip = (str, fnt, sz, maxW) => {
        const s = toWA(str);
        if (!s) return '';
        if (fnt.widthOfTextAtSize(s,sz) <= maxW) return s;
        let c = s;
        while (c.length>1 && fnt.widthOfTextAtSize(c+'...',sz)>maxW) c=c.slice(0,-1);
        return c+'...';
      };

      const drawTxt = (s, x, yy, opts={}) => {
        const drawn = clip(String(s||''), opts.bold?bold:reg, opts.size||8, opts.maxW||9999);
        if (!drawn) return;
        page.drawText(drawn, {x, y:yy, font:opts.bold?bold:reg, size:opts.size||8, color:opts.color||BLACK});
      };

      const drawRect = (x, yy, w, h, opts={}) =>
        page.drawRectangle({x, y:yy, width:w, height:h,
          color:opts.fill||undefined, borderColor:opts.stroke||undefined, borderWidth:opts.lw||(opts.stroke?0.5:0)});

      // Check if we need a new page
      const checkY = (need) => { if (y < 14*2.835 + need) { addPage(); } };

      // Section header — returns new y
      const secHdr = (label, icon, yy) => {
        const H = 14;
        drawRect(ML, yy-H, CW, H, {fill:NAVY});
        drawTxt((icon||'') + '  ' + label.toUpperCase(), ML+8, yy-H+3.5, {bold:true, size:8, color:WHITE});
        return yy - H - 4;
      };

      // Single field row: LABEL: value
      const drawField = (label, value, x, yy, w, opts={}) => {
        if (!value && !opts.showEmpty) return 0;
        const LW = opts.labelW || 90;
        const IH = 12;
        drawRect(x, yy-IH, w, IH, {fill: opts.highlight||LGRAY, stroke:BORDER, lw:0.4});
        drawTxt(label.toUpperCase(), x+4, yy-IH+3.5, {bold:true, size:6, color:DGRAY, maxW:LW-6});
        if (value) {
          const col = opts.valueColor || BLACK;
          drawTxt(value, x+LW, yy-IH+3.5, {bold:opts.boldVal, size:7.5, color:col, maxW:w-LW-6});
        }
        return IH + 2;
      };

      // Two-column field grid — returns height consumed
      const fieldGrid = (pairs, yy, cols=2) => {
        const gap = 4, cw = (CW-(cols-1)*gap)/cols;
        const xs = Array.from({length:cols},(_,i)=>ML+i*(cw+gap));
        let ci=0, rowY=yy, rowH=0;
        pairs.forEach(([label, value, opts]) => {
          if (!value) return; // skip empty
          const h = drawField(label, value, xs[ci], rowY, cw, opts||{});
          rowH = Math.max(rowH, h);
          ci++;
          if (ci>=cols) { rowY-=rowH; rowH=0; ci=0; }
        });
        if (ci) rowY -= rowH;
        return yy - rowY + 2;
      };

      // Expiry badge colour
      const expiryColor = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr); d.setHours(0,0,0,0);
        const t = new Date(); t.setHours(0,0,0,0);
        const days = Math.round((d-t)/86400000);
        if (days < 0)   return { col:RED,   bg:RED_B,   txt:`EXPIRED ${Math.abs(days)}d ago` };
        if (days <= 30) return { col:AMBER,  bg:AMB_B,   txt:`${days}d left` };
        if (days <= 90) return { col:AMBER,  bg:AMB_B,   txt:`${days}d left` };
        return { col:GREEN, bg:GREEN_B, txt:`${days}d` };
      };

      const drawDocField = (label, docNo, expiryDate, x, yy, w) => {
        if (!docNo && !expiryDate) return 0;
        const IH = 13;
        drawRect(x, yy-IH, w, IH, {fill:LGRAY, stroke:BORDER, lw:0.4});
        drawTxt(label.toUpperCase(), x+4, yy-IH+4, {bold:true, size:5.5, color:DGRAY});
        if (docNo) drawTxt(toWA(docNo), x+4, yy-IH+10.5, {size:7, color:BLACK, maxW:w/2-8, bold:true});
        if (expiryDate) {
          const fmtd = fmtDateDisplay(expiryDate);
          const ex = expiryColor(expiryDate);
          if (ex) {
            drawRect(x+w/2, yy-IH+2, w/2-4, 9, {fill:ex.bg, stroke:ex.col, lw:0.5});
            drawTxt('Exp: '+fmtd, x+w/2+3, yy-IH+5, {size:6.5, color:ex.col, bold:true, maxW:w/2-24});
            drawTxt(ex.txt, x+w-40, yy-IH+5, {size:6, color:ex.col, bold:true});
          } else {
            drawTxt('Exp: '+fmtd, x+w/2+3, yy-IH+5, {size:7, color:DGRAY, maxW:w/2-8});
          }
        }
        return IH + 2;
      };

      // ── START PAGE ───────────────────────────────────────────────────────
      addPage();

      // ── HEADER BAR ───────────────────────────────────────────────────────
      const HDR_H = 28;
      drawRect(ML, y-HDR_H, CW, HDR_H, {fill:NAVY});
      // Logo box
      drawRect(ML+4, y-HDR_H+5, 32, 18, {fill:WHITE});
      drawTxt('SATCO', ML+5.5, y-HDR_H+9, {bold:true, size:9, color:NAVY});
      // Company name
      drawTxt('SATCO Arabia General Contracting', ML+42, y-HDR_H+19, {bold:true, size:10, color:WHITE});
      drawTxt('Abu Dhabi, UAE  |  satcoarabiaengg.com', ML+42, y-HDR_H+11, {size:7, color:rgb(0.69,0.82,0.99)});
      // Title right
      drawTxt('EMPLOYEE PROFILE', PW-MR-80, y-HDR_H+20, {bold:true, size:8.5, color:WHITE});
      const today = new Date();
      drawTxt('Printed: '+today.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}), PW-MR-80, y-HDR_H+12, {size:6.5, color:rgb(0.69,0.82,0.99)});
      y -= HDR_H + 5;

      // ── EMPLOYEE IDENTITY BANNER ──────────────────────────────────────────
      const ID_H = 22;
      drawRect(ML, y-ID_H, CW, ID_H, {fill:rgb(0.937,0.953,0.996), stroke:BORDER, lw:0.6});
      // Employee ID badge
      drawRect(ML+4, y-ID_H+4, 50, 14, {fill:BLUE});
      drawTxt(emp.employee_id||'—', ML+8, y-ID_H+8, {bold:true, size:9, color:WHITE});
      // Name + position
      drawTxt(toWA(emp.full_name||'—'), ML+62, y-ID_H+14, {bold:true, size:13, color:NAVY});
      const positionStr = [emp.position, emp.department].filter(Boolean).join('  ·  ');
      if (positionStr) drawTxt(positionStr, ML+62, y-ID_H+5, {size:8, color:DGRAY});
      // Status badge right
      const statusColors = {
        'Employee':rgb(0.024,0.373,0.243), 'Employed':rgb(0.024,0.373,0.243),
        'Work permit':rgb(0.851,0.471,0.027), 'Employment visa issued':rgb(0.102,0.337,0.859),
      };
      const statusCol = statusColors[emp.status] || MGRAY;
      if (emp.status) {
        const statusW = bold.widthOfTextAtSize(toWA(emp.status),8) + 16;
        drawRect(PW-MR-statusW-4, y-ID_H+7, statusW, 12, {fill:statusCol});
        drawTxt(emp.status, PW-MR-statusW, y-ID_H+11, {bold:true, size:8, color:WHITE});
      }
      y -= ID_H + 6;

      // ── SECTION: PERSONAL ────────────────────────────────────────────────
      const personal = [
        ['Nationality',    emp.nationality],
        ['Date of Birth',  emp.dob ? fmtDateDisplay(emp.dob) : null],
        ['Joining Date',   emp.joining_date ? fmtDateDisplay(emp.joining_date) : null],
        ['Arrived at Camp', emp.camp_arrival_date ? fmtDateDisplay(emp.camp_arrival_date) : null],
        ['Actual Joining (Visa)', emp.actual_joining_date ? fmtDateDisplay(emp.actual_joining_date) : null],
        ['Work Experience',emp.work_experience ? emp.work_experience+' years' : null],
        ['Email',          emp.email],
        ['Mobile (UAE)',   emp.uae_contact || emp.mobile],
        ['Mobile (India)', emp.india_contact],
        ['Location',       emp.location],
        ['Reference By',   emp.reference_by],
        ['Ref. Contact',   emp.reference_contact],
      ].filter(([,v]) => v);

      if (personal.length) {
        checkY(60);
        y = secHdr('Personal & Employment', '👤', y);
        const rows = [];
        personal.forEach(([l,v]) => rows.push([l,v]));
        // also salary
        if (emp.basic_salary) rows.push(['Basic Salary', 'AED ' + Number(emp.basic_salary).toLocaleString()]);
        if (emp.allowance)    rows.push(['Allowance',    'AED ' + Number(emp.allowance).toLocaleString()]);
        const h = fieldGrid(rows, y);
        y -= h;
      }

      // ── SECTION: DOCUMENTS ──────────────────────────────────────────────
      const docs = [
        ['Passport',       emp.passport_no,          emp.passport_expiry],
        ['Emirates ID',    emp.eid_no,                emp.eid_expiry],
        ['Visa',           null,                      emp.visa_expiry],
        ['Employment eVisa',emp.evisa_no,             emp.evisa_expiry],
        ['Insurance',      emp.insurance_id,          emp.insurance_expiry],
        ['CICPA Gate Pass',emp.cicpa_no,              emp.cicpa_expiry],
        ['ILOE',           emp.iloe_cert_no,          emp.iloe_expiry],
        ['MOHRE Contract', emp.mohre_contract_no,     emp.mohre_contract_end],
      ].filter(([,no,exp]) => no || exp);

      if (docs.length) {
        checkY(60);
        y = secHdr('Documents & Expiry Dates', '📄', y);
        const gap=4, cw=(CW-gap)/2;
        let ci=0, rowY=y, rowH=0;
        docs.forEach(([label, no, exp]) => {
          const cx = ci===0 ? ML : ML+cw+gap;
          const h = drawDocField(label, no, exp, cx, rowY, cw);
          rowH = Math.max(rowH, h);
          ci++;
          if (ci>=2) { rowY-=rowH; rowH=0; ci=0; }
        });
        if (ci) rowY -= rowH;
        y = rowY - 4;
        // CICPA locations
        if (emp.cicpa_locations) {
          checkY(20);
          drawTxt('CICPA PERMITTED LOCATIONS:', ML+4, y-8, {bold:true, size:6, color:DGRAY});
          const locs = emp.cicpa_locations.split(',').map(s=>s.trim()).filter(Boolean);
          let lx = ML + 110;
          locs.forEach(loc => {
            const lw = bold.widthOfTextAtSize(loc,7)+10;
            if (lx + lw > PW-MR) { lx = ML+110; y -= 12; }
            drawRect(lx, y-11, lw, 9, {fill:rgb(0.937,0.914,0.996), stroke:rgb(0.490,0.231,0.988), lw:0.4});
            drawTxt(loc, lx+5, y-9, {bold:true, size:6.5, color:rgb(0.490,0.231,0.988)});
            lx += lw + 4;
          });
          y -= 14;
        }
        // Bank details
        if (emp.bank_name || emp.bank_account_no || emp.bank_iban) {
          checkY(20);
          const bankPairs = [
            ['Bank', emp.bank_name],
            ['Account No', emp.bank_account_no],
            ['IBAN', emp.bank_iban],
          ].filter(([,v])=>v);
          if (bankPairs.length) {
            const bh = fieldGrid(bankPairs, y);
            y -= bh;
          }
        }
      }

      // ── SECTION: TRAINING (only if any certs have data) ──────────────────
      // Load training record from the hiring pipeline (passed in as emp doesn't have it directly)
      // We look at ALL_STANDARD_TRAININGS — only show those with status/certNo/expiry
      // emp doesn't have training_records directly, so we fetch from Supabase
      // But we're in a standalone function — we use a pre-fetched approach:
      // The training data was already loaded in the app — we pass it via closure from loadAll
      // Since we can't easily pass trainings here, skip training section if emp._trainings not set
      const trainRec = emp._trainings;
      if (trainRec) {
        let parsed = {};
        try { parsed = JSON.parse(trainRec.training_records||'{}'); } catch {}

        const validStd = ALL_STANDARD_TRAININGS.filter(t => {
          const r = parsed[t.id];
          return r && (r.status==='valid'||r.certNo||r.expiry);
        });
        const otherCerts = (parsed.__other||[]).filter(c => c.courseName||c.certNo||c.expiry);

        if (validStd.length || otherCerts.length) {
          checkY(50);
          y = secHdr('Training & Certifications', '🎓', y);

          const allCerts = [
            ...validStd.map(t => {
              const r = parsed[t.id];
              return { name: r.courseName||t.label, certNo: r.certNo, expiry: r.expiry, status: r.status, issuer: r.issuingCompany };
            }),
            ...otherCerts.map(c => ({ name: c.courseName||c.label||'Certificate', certNo: c.certNo, expiry: c.expiry, status:'valid', issuer: c.issuingCompany })),
          ];

          const gap=4, cw=(CW-gap)/2;
          let ci2=0, rowY2=y, rowH2=0;
          allCerts.forEach(cert => {
            checkY(16);
            const cx = ci2===0 ? ML : ML+cw+gap;
            const IH=13;
            const ex = cert.expiry ? expiryColor(cert.expiry) : null;
            const bgFill = ex ? ex.bg : GREEN_B;
            const borderCol = ex ? ex.col : GREEN;
            drawRect(cx, rowY2-IH, cw, IH, {fill:bgFill, stroke:borderCol, lw:0.5});
            drawTxt(cert.name||'—', cx+4, rowY2-IH+8, {bold:true, size:6.5, color:NAVY, maxW:cw/2-8});
            if (cert.issuer) drawTxt(cert.issuer, cx+4, rowY2-IH+2.5, {size:5.5, color:DGRAY, maxW:cw/2-8});
            if (cert.certNo) drawTxt(cert.certNo, cx+cw/2+2, rowY2-IH+8.5, {size:6, color:DGRAY, bold:true, maxW:cw/4-4});
            if (cert.expiry) {
              const fmtd = fmtDateDisplay(cert.expiry);
              const col2 = ex ? ex.col : GREEN;
              drawTxt('Exp: '+fmtd, cx+cw*3/4, rowY2-IH+8.5, {size:6, color:col2, bold:!!ex, maxW:cw/4});
            }
            rowH2 = Math.max(rowH2, IH+2);
            ci2++;
            if (ci2>=2) { rowY2-=rowH2; rowH2=0; ci2=0; }
          });
          if (ci2) rowY2 -= rowH2;
          y = rowY2 - 4;
        }
      }

      // ── SIGNATURE STRIP ──────────────────────────────────────────────────
      checkY(40);
      y -= 10;
      page.drawLine({start:{x:ML,y},end:{x:PW-MR,y},thickness:0.5,color:BORDER});
      y -= 3;
      const SW=(CW-12)/3;
      ['Employee Signature','HR Manager','Department Head'].forEach((label,i) => {
        const sx = ML+i*(SW+6);
        page.drawLine({start:{x:sx,y:y-20},end:{x:sx+SW,y:y-20},thickness:0.8,color:NAVY});
        drawTxt(label, sx, y-26, {size:6.5, color:DGRAY, bold:true});
        drawTxt('Date: ________________', sx, y-33, {size:6, color:MGRAY});
      });

      // ── DOWNLOAD ────────────────────────────────────────────────────────
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes],{type:'application/pdf'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const fname = 'SATCO_Profile_'+(toWA(emp.employee_id||'EMP'))+'_'+(toWA(emp.full_name||'').replace(/\s+/g,'_'))+'.pdf';
      a.href=url; a.download=fname; a.click();
      URL.revokeObjectURL(url);
    };

    // ============ CONTACT DIRECTORY ============
    function ContactsView({ contacts, employees, onAdd, onEdit, onDelete, onSyncAll }) {
      const [search, setSearch] = useState('');
      const [filterBy, setFilterBy] = useState('all');

      const filtered = useMemo(() => {
        let r = contacts;
        if (search) {
          const s = search.toLowerCase();
          r = r.filter(c =>
            (c.employee_number||'').toLowerCase().includes(s) ||
            (c.full_name||'').toLowerCase().includes(s) ||
            (c.mobile_uae||'').includes(s) ||
            (c.mobile_home||'').includes(s) ||
            (c.email||'').toLowerCase().includes(s) ||
            (c.whatsapp||'').includes(s) ||
            (c.home_address||'').toLowerCase().includes(s) ||
            (c.uae_address||'').toLowerCase().includes(s) ||
            (c.emergency_name||'').toLowerCase().includes(s) ||
            (c.emergency_relation||'').toLowerCase().includes(s) ||
            (c.emergency_country||'').toLowerCase().includes(s) ||
            (c.emergency_mobile||'').includes(s) ||
            (c.notes||'').toLowerCase().includes(s)
          );
        }
        if (filterBy === 'has_uae') r = r.filter(c => c.mobile_uae);
        if (filterBy === 'has_home') r = r.filter(c => c.mobile_home);
        if (filterBy === 'has_emergency') r = r.filter(c => c.emergency_mobile);
        if (filterBy === 'incomplete') r = r.filter(c => !c.mobile_uae);
        return r;
      }, [contacts, search, filterBy]);

      // Build quick-lookup from employees table to enrich data
      const empMap = useMemo(() => {
        const m = {};
        employees.forEach(e => { if (e.employee_id) m[e.employee_id] = e; });
        return m;
      }, [employees]);

      return (
        <div>
          {/* Action bar */}
          <div style={{ display:'flex', gap:'12px', marginBottom:'14px', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'11px 16px', fontSize:'12.5px', color:'#1e40af' }}>
              Contact data is stored in the <strong>employee_contacts</strong> table. Run SQL in Settings &rarr; DB Setup if the table does not exist yet.
            </div>
            <button className="hr-btn" onClick={onSyncAll}
              style={{ background:'#0f172a', color:'#fff', border:'none', padding:'11px 18px', borderRadius:'10px', fontSize:'15px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'8px' }}>
              Sync All from Employees
              <span style={{ background:'rgba(255,255,255,0.18)', fontSize:'11px', padding:'2px 8px', borderRadius:'8px', fontWeight:600 }}>{employees.length}</span>
            </button>
          </div>

          {/* Toolbar */}
          <div style={{ display:'flex', gap:'10px', marginBottom:'10px', flexWrap:'wrap', alignItems:'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search by Emp No, Name, Mobile, Email, Address, Emergency Contact, Notes…"
              style={{ ...S.input, flex:1, minWidth:'260px', maxWidth:'420px' }} />
            <select value={filterBy} onChange={e => setFilterBy(e.target.value)} style={S.input}>
              <option value="all">All contacts ({contacts.length})</option>
              <option value="has_uae">Has UAE Mobile</option>
              <option value="has_home">Has Home Country Mobile</option>
              <option value="has_emergency">Has Emergency Contact</option>
              <option value="incomplete">Incomplete (no UAE mobile)</option>
            </select>
            <button className="hr-btn" style={S.btnPri} onClick={onAdd}>+ Add Contact</button>
          </div>
          {/* Sync status bar */}
          {(() => {
            const synced = contacts.filter(c => c.full_name && c.employee_number).length;
            const needsDetails = contacts.filter(c => !c.mobile_uae).length;
            return (
              <div style={{ display:'flex', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
                <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'7px 14px', fontSize:'12px', color:'#166534' }}><strong>{synced}</strong> employee{synced!==1?'s':''} synced from All Employees
                </div>
                {needsDetails > 0 && (
                  <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'8px', padding:'7px 14px', fontSize:'12px', color:'#92400e' }}><strong>{needsDetails}</strong> missing UAE mobile — click ✏️ to complete
                  </div>
                )}
              </div>
            );
          })()}

          {/* Sync status */}
          {(() => {
            const empIds = new Set(employees.map(e => e.employee_id).filter(Boolean));
            const synced = contacts.filter(c => empIds.has(c.employee_number)).length;
            const total = empIds.size;
            const missing = total - synced;
            const noMobile = contacts.filter(c => !c.mobile_uae).length;
            return (
              <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
                <div style={{ background: synced === total && total > 0 ? '#f0fdf4' : '#fffbeb', border: '1px solid ' + (synced === total && total > 0 ? '#86efac' : '#fcd34d'), borderRadius:'8px', padding:'7px 14px', fontSize:'12px', color: synced === total && total > 0 ? '#166534' : '#92400e', fontWeight:600 }}>
                  {synced === total && total > 0 ? '✅' : '⚠️'} {synced}/{total} employees in directory
                  {missing > 0 && <span> &mdash; <strong>{missing} missing</strong> &mdash; click &ldquo;Sync All&rdquo; button above</span>}
                </div>
                {noMobile > 0 && (
                  <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'8px', padding:'7px 14px', fontSize:'12px', color:'#92400e', fontWeight:600 }}>
                    {noMobile} contacts missing UAE mobile &mdash; click edit to complete
                  </div>
                )}
              </div>
            );
          })()}
          <ContactTable filtered={filtered} onEdit={onEdit} onDelete={onDelete} contacts={contacts} />
          <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b' }}>Showing {filtered.length} of {contacts.length} contacts</div>
        </div>
      );
    }
    function ContactTable({ filtered, onEdit, onDelete, contacts }) {
      const colGetters = {
        emp_no: c => c.employee_number||'—',
        name: c => c.full_name||'—',
        uae_mobile: c => c.mobile_uae||'—',
        home_mobile: c => c.mobile_home||'—',
        whatsapp: c => c.whatsapp||'—',
        email: c => c.email||'—',
        address: c => c.uae_address||'—',
        emergency: c => c.emergency_name||'—',
      };
      const { filters, setColFilter, clearAll, filteredRows: rows, activeCount } = useColumnFilters(filtered, colGetters);
      const FROZEN_W = [90, 160];
      const FROZEN_LEFT = [0, FROZEN_W[0]];
      return (
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
            {activeCount > 0 && (
              <div style={{ padding:'7px 12px', background:'#eff6ff', borderBottom:'1px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'11.5px', color:'#1e40af' }}>
                <span>{activeCount} column filter{activeCount!==1?'s':''} active — showing {rows.length} of {filtered.length}</span>
                <button onClick={clearAll} style={{ background:'none', border:'none', color:'#1e40af', fontWeight:700, cursor:'pointer', fontSize:'13.5px' }}>Clear all filters</button>
              </div>
            )}
            <div className="xl-wrap hr-scroll">
              <table className="xl-table" style={{ width:'100%', fontSize:'12px', minWidth:'1200px' }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    <ExcelTh label="Emp No" colKey="emp_no" rows={filtered} getValue={colGetters.emp_no} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[0]} style={{ width:FROZEN_W[0] }} />
                    <ExcelTh label="Full Name" colKey="name" rows={filtered} getValue={colGetters.name} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[1]} style={{ width:FROZEN_W[1] }} className="xl-frozen-edge" />
                    <ExcelTh label="UAE Mobile" colKey="uae_mobile" rows={filtered} getValue={colGetters.uae_mobile} filters={filters} setColFilter={setColFilter} />
                    <ExcelTh label="Home Mobile" colKey="home_mobile" rows={filtered} getValue={colGetters.home_mobile} filters={filters} setColFilter={setColFilter} />
                    <ExcelTh label="WhatsApp" colKey="whatsapp" rows={filtered} getValue={colGetters.whatsapp} filters={filters} setColFilter={setColFilter} />
                    <ExcelTh label="Email" colKey="email" rows={filtered} getValue={colGetters.email} filters={filters} setColFilter={setColFilter} />
                    <ExcelTh label="UAE Address" colKey="address" rows={filtered} getValue={colGetters.address} filters={filters} setColFilter={setColFilter} />
                    <ExcelTh label="Emergency Contact" colKey="emergency" rows={filtered} getValue={colGetters.emergency} filters={filters} setColFilter={setColFilter} />
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0
                    ? <tr><td colSpan={9} style={{ textAlign:'center', padding:'50px', color:'#94a3b8' }}>
                        {contacts.length === 0 ? '📞 No contacts yet — click "+ Add Contact" to get started' : 'No results match your search'}
                      </td></tr>
                    : rows.map(c => (
                      <tr key={c.id} className="hr-row" onClick={(e) => { if(e.detail===2){ e.preventDefault(); onEdit(c); } }} title="Double-click to edit" style={{ borderTop:'1px solid var(--bd3)', cursor:'pointer' }}>
                        <td className="xl-frozen" style={{ ...S.td, left:FROZEN_LEFT[0], width:FROZEN_W[0], background:'#fff', fontFamily:'ui-monospace,monospace', fontWeight:700, color:'#2563eb' }}>{c.employee_number || '—'}</td>
                        <td className="xl-frozen xl-frozen-edge" style={{ ...S.td, left:FROZEN_LEFT[1], width:FROZEN_W[1], background:'#fff', fontWeight:600 }}>{c.full_name || '—'}</td>
                        <td style={S.td}>
                          {c.mobile_uae
                            ? <a href={`tel:${c.mobile_uae}`} onDoubleClick={e=>{ e.preventDefault(); e.stopPropagation(); onEdit(c); }} style={{ color:'#059669', fontWeight:600, textDecoration:'none' }}>{c.mobile_uae}</a>
                            : <span style={{ color:'#cbd5e1' }}>—</span>}
                        </td>
                        <td style={S.td}>
                          {c.mobile_home
                            ? <div><div style={{ fontSize:'12px', fontWeight:600 }}>{c.mobile_home}</div></div>
                            : <span style={{ color:'#cbd5e1' }}>—</span>}
                        </td>
                        <td style={S.td}>
                          {c.whatsapp
                            ? <a href={`https://wa.me/${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                                onDoubleClick={e=>{ e.preventDefault(); e.stopPropagation(); onEdit(c); }}
                                style={{ color:'#25D366', fontWeight:600, textDecoration:'none' }}>{c.whatsapp}</a>
                            : <span style={{ color:'#cbd5e1' }}>—</span>}
                        </td>
                        <td style={S.td}>
                          {c.email
                            ? <a href={`mailto:${c.email}`} onDoubleClick={e=>{ e.preventDefault(); e.stopPropagation(); onEdit(c); }} style={{ color:'#2563eb', textDecoration:'none', fontSize:'12px' }}>{c.email}</a>
                            : <span style={{ color:'#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ ...S.td, maxWidth:'180px', fontSize:'11.5px', color:'#475569' }}>{c.uae_address || <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                        <td style={S.td}>
                          {c.emergency_name
                            ? <div>
                                <div style={{ fontWeight:600, fontSize:'12px' }}>{c.emergency_name}</div>
                                <div style={{ color:'#64748b', fontSize:'11px' }}>{[c.emergency_relation, c.emergency_country].filter(Boolean).join(' · ')}</div>
                                {c.emergency_mobile && <div style={{ color:'#dc2626', fontWeight:600, fontSize:'11.5px', marginTop:'2px' }}>{c.emergency_mobile}</div>}
                              </div>
                            : <span style={{ color:'#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ ...S.td, textAlign:'right', whiteSpace:'nowrap' }}>
                          <button onClick={() => onEdit(c)} style={S.iconBtn}></button>
                          <button onClick={() => onDelete(c.id)} style={S.iconBtn}></button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
      );
    }

    // Stable field component defined OUTSIDE modal to prevent focus loss on re-render
    function ContactField({ label, field, placeholder, type='text', hint, wide, data, set }) {
      return (
        <div style={{ gridColumn: wide ? 'span 2' : 'span 1' }}>
          <label style={S.label}>
            {label}
            {hint && <span style={{ color:'#94a3b8', marginLeft:'4px', fontWeight:400 }}>({hint})</span>}
          </label>
          {type === 'textarea'
            ? <textarea
                value={data[field]||''}
                onChange={e => set(field, e.target.value)}
                placeholder={placeholder}
                style={{ ...S.input, width:'100%', minHeight:'58px', resize:'vertical' }} />
            : <input
                type={type}
                value={data[field]||''}
                onChange={e => set(field, e.target.value)}
                placeholder={placeholder}
                style={{ ...S.input, width:'100%' }} />}
        </div>
      );
    }

        function ContactModal({ record, employees, onSave, onClose, showToast }) {
      const [data, setData] = useState({ ...record });
      const [saving, setSaving] = useState(false);
      const set = (k, v) => setData(d => ({ ...d, [k]: v }));
      const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try { await onSave(data); }
        catch (e) { console.error('Save Contact failed:', e); (showToast||alert)('❌ Save failed: ' + (e && e.message ? e.message : 'unknown error — check browser console for details'), 'error'); }
        finally { setSaving(false); }
      };

      // When employee is selected from dropdown, auto-fill both ID and Name
      const handleEmpSelect = (empId) => {
        const match = employees.find(e => e.employee_id === empId);
        if (match) {
          setData(d => ({ ...d, employee_number: match.employee_id, full_name: match.full_name }));
        } else {
          setData(d => ({ ...d, employee_number: empId }));
        }
      };

      // Field component defined outside modal (see ContactField below)

      return (
        <div style={S.overlay} onClick={onClose}>
          <div style={{ ...S.modal, maxWidth:'720px' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 22px', borderBottom:'1px solid var(--bd1)' }}>
              <div>
                <h2 style={{ margin:0, fontSize:'17px' }}>{record.id ? 'Edit Contact' : 'Add Contact'}</h2>
                <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'3px' }}>Employee contact details &amp; emergency info</div>
              </div>
              <button onClick={onClose} style={S.iconBtn}>×</button>
            </div>

            {/* Body */}
            <div style={{ overflowY:'auto', flex:1, padding:'20px 22px' }}>

              {/* Section: Identity */}
              <div style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #dbeafe' }}>Employee Identity</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px' }}>
                  <div style={{ gridColumn:'span 2' }}>
                    <label style={S.label}>
                      Select Employee <span style={{color:'#dc2626'}}>*</span>
                      <span style={{ color:'#059669', marginLeft:'8px', fontWeight:400, fontSize:'10.5px' }}><EmojiIcon e="✓" /> Auto-filled from All Employees</span>
                    </label>
                    <select value={data.employee_number||''} onChange={e => handleEmpSelect(e.target.value)}
                      style={{ ...S.input, width:'100%', background: data.employee_number ? '#f0fdf4' : '#fff', borderColor: data.employee_number ? '#86efac' : '#cbd5e1' }}>
                      <option value="">-- Select an employee --</option>
                      {[...employees].sort((a,b)=>(a.employee_id||'').localeCompare(b.employee_id||'')).map(e =>
                        <option key={e.id} value={e.employee_id}>{e.employee_id} — {e.full_name}</option>
                      )}
                    </select>
                    {data.employee_number && data.full_name && (
                      <div style={{ marginTop:'6px', padding:'8px 12px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'6px', fontSize:'12px', color:'#166534', display:'flex', alignItems:'center', gap:'8px' }}>
                        <span><EmojiIcon e="✅" /></span>
                        <span><strong>{data.employee_number}</strong> — {data.full_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: UAE Contact */}
              <div style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:'#059669', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #d1fae5' }}><EmojiIcon e="🇦🇪" /> UAE Contact Details</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px' }}>
                  <ContactField label="UAE Mobile Number" field="mobile_uae" placeholder="+971 50 000 0000" hint="primary" data={data} set={set} />
                  <ContactField label="WhatsApp Number" field="whatsapp" placeholder="+971 50 000 0000" hint="with country code" data={data} set={set} />
                  <ContactField label="Email Address" field="email" placeholder="name@example.com" type="email" data={data} set={set} />
                  <ContactField label="UAE Local Address" field="uae_address" placeholder="Flat, Building, Area, Emirate" data={data} set={set} />
                </div>
              </div>

              {/* Section: Home Country Contact */}
              <div style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #ede9fe' }}><EmojiIcon e="🌏" /> Home Country Contact</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px' }}>
                  <ContactField label="Mobile (India / Pakistan / Other)" field="mobile_home" placeholder="+91 98000 00000" data={data} set={set} />
                  <ContactField label="Home Address" field="home_address" placeholder="Full address in home country" wide data={data} set={set} />
                </div>
              </div>

              {/* Section: Emergency Contact */}
              <div style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:'#dc2626', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid #fee2e2' }}>🆘 Emergency / Next of Kin Contact</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px' }}>
                  <ContactField label="Contact Name" field="emergency_name" placeholder="Full name of relative" data={data} set={set} />
                  <ContactField label="Relationship" field="emergency_relation" placeholder="e.g. Father, Wife, Brother" data={data} set={set} />
                  <ContactField label="Country" field="emergency_country" placeholder="e.g. India, Pakistan, Bangladesh" data={data} set={set} />
                  <ContactField label="Mobile Number" field="emergency_mobile" placeholder="+91 98000 00000" data={data} set={set} />
                </div>
              </div>

              {/* Section: Notes */}
              <div>
                <div style={{ fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'5px', borderBottom:'2px solid var(--bd1)' }}><EmojiIcon e="📝" /> Additional Notes</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'12px' }}>
                  <ContactField label="Notes / Other Details" field="notes" placeholder="Any other useful contact information…" type="textarea" wide data={data} set={set} />
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--bd1)', display:'flex', justifyContent:'flex-end', gap:'10px' }}>
              <button className="hr-btn" style={S.btnSec} onClick={onClose} disabled={saving}>Cancel</button>
              <button className="hr-btn" style={{ ...S.btnPri, opacity: saving?0.7:1, cursor: saving?'default':'pointer' }} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save Contact'}</button>
            </div>
          </div>
        </div>
      );
    }

    function MobDemobModal({ record, employees, onSave, onClose, showToast }) {
      const [data, setData] = useState(record);
      const [saving, setSaving] = useState(false);
      const set = (k,v) => setData(d => ({ ...d, [k]:v }));
      const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try { await onSave(data); }
        catch (e) { console.error('Save Mob/Demob record failed:', e); (showToast||alert)('❌ Save failed: ' + (e && e.message ? e.message : 'unknown error — check browser console for details'), 'error'); }
        finally { setSaving(false); }
      };
      const pick = (eid) => {
        const e = employees.find(x => x.employee_id === eid);
        if (e) setData(d => ({ ...d, employee_id: e.employee_id, full_name: e.full_name, position: e.position, eid_no: e.eid_no }));
        else setData(d => ({ ...d, employee_id: eid }));
      };

      // Compute days worked preview
      const daysPreview = (() => {
        const mob = data.mobilization_date ? new Date(data.mobilization_date) : null;
        const demob = data.demobilization_date ? new Date(data.demobilization_date) : null;
        if (!mob) return null;
        const end = demob || new Date();
        const days = Math.round((end - mob) / 86400000);
        return { days, ongoing: !demob };
      })();

      return (
        <div style={S.overlay} onClick={onClose}>
          <div style={{ ...S.modal, maxWidth:'580px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 22px', borderBottom:'1px solid var(--bd1)' }}>
              <div>
                <h2 style={{ margin:0, fontSize:'17px' }}>{record.id?'Edit Record':'Add Mob/Demob Record'}</h2>
                <div style={{ fontSize:'11.5px', color:'#059669', marginTop:'3px' }}><EmojiIcon e="✓" /> Employee name &amp; details auto-filled from All Employees</div>
              </div>
              <button onClick={onClose} style={S.iconBtn}><EmojiIcon e="✖" /></button>
            </div>
            <div style={{ padding:'18px 22px' }}>
              {data._previous && (
                <div style={{ marginBottom:'14px', background:'#fff7ed', border:'1px solid #fdba74', borderRadius:'8px', padding:'10px 14px', fontSize:'12.5px', color:'#9a3412' }}>
                  <div style={{ fontWeight:700, marginBottom:'4px' }}><EmojiIcon e="🔁" /> Previous Assignment (closed)</div>
                  <div>
                    <strong>{data._previous.location || '—'}</strong>{data._previous.supply ? ' · ' + data._previous.supply : ''}
                    {' — '}{data._previous.mobilization_date ? fmtDateDisplay(data._previous.mobilization_date) : '—'}
                    {' → '}{data._previous.demobilization_date ? fmtDateDisplay(data._previous.demobilization_date) : '—'}
                  </div>
                  <div style={{ marginTop:'4px', fontWeight:600 }}><EmojiIcon e="⬇" /> New Assignment — enter details below</div>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px' }}>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={S.label}>Employee <span style={{ color:'#dc2626' }}>*</span></label>
                  <select value={data.employee_id||''} onChange={e=>pick(e.target.value)}
                    style={{ ...S.input, width:'100%', background: data.employee_id ? '#f0fdf4' : '#fff', borderColor: data.employee_id ? '#86efac' : '#cbd5e1' }}>
                    <option value="">-- Select an employee --</option>
                    {[...employees].sort((a,b)=>(a.employee_id||'').localeCompare(b.employee_id||'')).map(e =>
                      <option key={e.id} value={e.employee_id}>{e.employee_id} — {e.full_name}</option>
                    )}
                  </select>
                  {data.employee_id && data.full_name && (
                    <div style={{ marginTop:'6px', padding:'7px 12px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'6px', fontSize:'12px', color:'#166534' }}><EmojiIcon e="✅" /><strong>{data.employee_id}</strong> — {data.full_name}
                    </div>
                  )}
                </div>
                <div><label style={S.label}>Position</label><input value={data.position||''} onChange={e=>set('position',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>EID No</label><input value={data.eid_no||''} onChange={e=>set('eid_no',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div>
                  <label style={S.label}>Mobilization Date</label>
                  <input type="date" value={data.mobilization_date||''} onChange={e=>set('mobilization_date',e.target.value)} style={{ ...S.input, width:'100%' }} />
                </div>
                <div>
                  <label style={S.label}>Demobilization Date</label>
                  <input type="date" value={data.demobilization_date||''} onChange={e=>set('demobilization_date',e.target.value)} style={{ ...S.input, width:'100%' }} />
                </div>
                {/* Days worked preview */}
                {daysPreview && (
                  <div style={{ gridColumn:'span 2', background: daysPreview.ongoing ? '#eff6ff' : '#f0fdf4', border:'1px solid '+(daysPreview.ongoing?'#bfdbfe':'#86efac'), borderRadius:'8px', padding:'8px 14px', fontSize:'12px', color: daysPreview.ongoing?'#1e40af':'#166534', fontWeight:600 }}>
                    <EmojiLabel text={daysPreview.ongoing ? '🟢 Currently active — ' : '✅ Completed — '} />
                    <strong>{daysPreview.days} days</strong> {daysPreview.ongoing ? 'worked so far' : 'worked'}
                  </div>
                )}
                <div><label style={S.label}>Supply Company</label><input value={data.supply||''} onChange={e=>set('supply',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div><label style={S.label}>Location</label><input value={data.location||''} onChange={e=>set('location',e.target.value)} style={{ ...S.input, width:'100%' }} /></div>
                <div style={{ gridColumn:'span 2' }}><label style={S.label}>Remarks</label><textarea value={data.remarks||''} onChange={e=>set('remarks',e.target.value)} style={{ ...S.input, width:'100%', minHeight:'60px' }} /></div>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--bd1)', display:'flex', justifyContent:'flex-end', gap:'10px' }}>
              <button className="hr-btn" style={S.btnSec} onClick={onClose} disabled={saving}>Cancel</button>
              <button className="hr-btn" style={{ ...S.btnPri, opacity: saving?0.7:1, cursor: saving?'default':'pointer' }} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      );
    }

    // ============ STAGE DOCUMENT UPLOAD MODAL ============
    // Maps each hiring stage to the document(s) that should be uploaded at that stage
    const STAGE_DOC_MAP = {
      // Common steps
      resume:        [{ key:'resume_url', label:'📄 Resume / CV', accept:'.pdf,image/*' }, { key:'passport_img_url', label:'🛂 Passport Scan', accept:'image/*,.pdf' }],
      interview:     [{ key:'interview_sheet_url', label:'📝 Filled Interview Sheet', accept:'.pdf,image/*' }],
      offer_sent:    [{ key:'offer_letter_url',  label:'📧 Offer Letter (PDF/Image)', accept:'.pdf,image/*' }],
      offer_signed:  [{ key:'offer_signed_url',  label:'✍️ Signed Offer Letter', accept:'.pdf,image/*' }],
      // S1 / S2 specific
      visa_arranged: [{ key:'visa_stamped_url',  label:'🛂 Visit Visa / Entry Permit', accept:'.pdf,image/*' }],
      entry_permit:  [{ key:'visa_stamped_url',  label:'🛂 Entry Permit Document', accept:'.pdf,image/*' }],
      work_permit:   [{ key:'visa_docs_url',     label:'📨 Work Permit Approval', accept:'.pdf,image/*' }],
      travel:        [{ key:'travel_doc_url',    label:'✈️ Travel / Ticket Booking (PDF/DOCX/Image)', accept:'.pdf,.docx,image/*' }],
      // Shared visa steps
      medical:       [{ key:'visa_medical_url',  label:'🏥 UAE Medical Fitness Report', accept:'.pdf,image/*' }],
      eid:           [{ key:'visa_docs_url',     label:'🪪 EID Application Receipt', accept:'.pdf,image/*' }],
      status_change: [{ key:'visa_docs_url',     label:'🔄 ICP Status Change Approval', accept:'.pdf,image/*' }],
      visa_stamped:  [{ key:'visa_stamped_url',  label:'✅ Visa Stamp in Passport', accept:'.pdf,image/*' }],
      // S3 specific
      visa_cancel:   [{ key:'visa_docs_url',     label:'🚫 Old Visa Cancellation Confirmation', accept:'.pdf,image/*' }],
      // End
      joined:        [{ key:'joining_doc_url',   label:'🏢 Joining Confirmation', accept:'.pdf,image/*' }],
    };

    function StageDocUploadModal({ candidate, stepId, stepLabel, stepColor, stepIcon, onSave, onClose, showToast, supaUrl, supaKey }) {
      const docTypes = STAGE_DOC_MAP[stepId] || [];
      const [uploads, setUploads] = React.useState({}); // key → { file, dataUrl, name }
      const [saving, setSaving] = React.useState(false);
      const [stagePreview, setStagePreview] = React.useState(null); // { url, isPdf, label }
      const [stagePdfBlob, setStagePdfBlob] = React.useState(null);

      React.useEffect(() => {
        if (!stagePreview || !stagePreview.isPdf || !stagePreview.url) { setStagePdfBlob(null); return; }
        // If it's a real URL (Storage), use directly; otherwise decode base64
        if (stagePreview.url.startsWith('http')) {
          setStagePdfBlob(stagePreview.url);
          return;
        }
        try {
          const b64 = stagePreview.url.split(',')[1];
          const bytes = atob(b64);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          const blob = new Blob([arr], { type: 'application/pdf' });
          const bUrl = URL.createObjectURL(blob);
          setStagePdfBlob(bUrl);
          return () => URL.revokeObjectURL(bUrl);
        } catch(e) { setStagePdfBlob(null); }
      }, [stagePreview]);

      const handleFile = (docKey, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          setUploads(prev => ({ ...prev, [docKey]: { file, dataUrl: ev.target.result, name: file.name } }));
        };
        reader.readAsDataURL(file);
      };

      // Upload a file to Supabase Storage, return public URL
      const uploadToStorage = async (file, docKey) => {
        const _supaUrl = supaUrl || 'https://oaerqjrkdpuhiproppaz.supabase.co';
        const _supaKey = supaKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI';
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `pipeline/${candidate.id}/${docKey}_${Date.now()}.${ext}`;
        const res = await fetch(`${_supaUrl}/storage/v1/object/hr-documents/${path}`, {
          method: 'POST',
          headers: { 'apikey': _supaKey, 'Authorization': `Bearer ${_supaKey}`, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
          body: file
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          if (res.status === 400) throw new Error(`Storage 400: hr-documents bucket may not be set to public. Go to Supabase → Storage → hr-documents → Make Public, then retry.`);
          throw new Error(`Storage upload failed (${res.status}): ${errText}`);
        }
        return `${_supaUrl}/storage/v1/object/public/hr-documents/${path}`;
      };

      const [aiExtracting, setAiExtracting] = React.useState(false);

      const extractTicketDataWithAI = async (base64DataUrl) => {
        // Extract base64 without the data URI prefix
        const base64 = base64DataUrl.split(',')[1] || base64DataUrl;
        const mediaType = base64DataUrl.startsWith('data:application/pdf') ? 'application/pdf'
          : base64DataUrl.startsWith('data:image/jpeg') ? 'image/jpeg'
          : base64DataUrl.startsWith('data:image/png') ? 'image/png'
          : 'application/pdf';
        try {
          const response = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 1200,
              messages: [{
                role: 'user',
                content: [
                  { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
                  { type: 'text', text: `Extract ALL flight booking details from this airline ticket/itinerary and return ONLY valid JSON (no explanation, no markdown):
{
  "passenger_name": "full passenger name",
  "pnr": "PNR or booking reference code",
  "airline": "airline name",
  "flight_no": "flight number e.g. 6E1415",
  "from_city": "departure city name",
  "from_airport": "departure airport IATA code e.g. LKO",
  "from_terminal": "departure terminal e.g. T3 or null",
  "to_city": "arrival city name",
  "to_airport": "arrival airport IATA code e.g. AUH",
  "to_terminal": "arrival terminal e.g. TA or null",
  "depart_date": "YYYY-MM-DD (local date at origin exactly as printed on ticket)",
  "depart_time": "HH:MM 24h (local time at origin exactly as printed - do NOT convert to UTC)",
  "arrive_date": "YYYY-MM-DD (local date at destination exactly as printed on ticket)",
  "arrive_time": "HH:MM 24h (local time at destination exactly as printed - do NOT convert to UTC)",
  "depart_tz_offset": "UTC offset of origin airport e.g. +05:30 for India IST, +04:00 for UAE GST",
  "arrive_tz_offset": "UTC offset of destination airport e.g. +04:00 for UAE/Abu Dhabi, +05:30 for India IST",
  "seat": "seat number or null",
  "class": "Economy or Business",
  "booking_date": "YYYY-MM-DD or null",
  "payment_status": "Confirmed or other status"
}

CRITICAL: Extract ALL times EXACTLY as printed on the ticket. Do NOT convert to UTC or any other timezone. The depart_time is the local time shown at the departure airport, arrive_time is the local time shown at the destination airport.` }
                ]
              }]
            })
          });
          const data = await response.json();
          const text = (data.content || []).find(b => b.type === 'text')?.text || '{}';
          return JSON.parse(text.replace(/```json|```/g, '').trim());
        } catch(err) {
          console.error('AI ticket extraction failed:', err);
          return {};
        }
      };

      const handleSave = async () => {
        const keys = Object.keys(uploads);
        if (keys.length === 0) { showToast('Please select at least one file', 'error'); return; }
        setSaving(true);
        try {
          const updates = {};
          // Upload each file to Supabase Storage, store public URL (not base64)
          showToast('📤 Uploading document(s)...', 'info');
          for (const k of keys) {
            const { file, dataUrl, name } = uploads[k];
            if (file) {
              const url = await uploadToStorage(file, k);
              updates[k] = url;
            } else {
              // Fallback: shouldn't normally happen, but keep dataUrl
              updates[k] = dataUrl;
            }
          }

          // === AI TICKET EXTRACTION for travel step ===
          if (stepId === 'travel' && uploads['travel_doc_url']) {
            setAiExtracting(true);
            showToast('🤖 AI is reading your ticket... extracting flight details', 'info');
            try {
              const ticket = await extractTicketDataWithAI(uploads['travel_doc_url'].dataUrl);
              if (ticket && (ticket.flight_no || ticket.pnr || ticket.depart_date)) {
                // Build departure datetime with timezone offset so Supabase stores correct UTC
                let departDt = null;
                if (ticket.depart_date && ticket.depart_time) {
                  const dTz = ticket.depart_tz_offset || '+05:30'; // default IST for India origin
                  departDt = ticket.depart_date + 'T' + ticket.depart_time + ':00' + dTz;
                }
                // Build arrival datetime with timezone offset (UAE = +04:00)
                let arriveDt = null;
                if (ticket.arrive_date && ticket.arrive_time) {
                  const aTz = ticket.arrive_tz_offset || '+04:00'; // default GST for UAE destination
                  arriveDt = ticket.arrive_date + 'T' + ticket.arrive_time + ':00' + aTz;
                }
                // Add ticket fields to updates
                if (ticket.pnr) updates['ticket_pnr'] = ticket.pnr;
                if (ticket.airline) updates['ticket_airline'] = ticket.airline;
                if (ticket.flight_no) updates['ticket_flight_no'] = ticket.flight_no;
                if (ticket.from_city) updates['ticket_from_city'] = ticket.from_city;
                if (ticket.from_airport) updates['ticket_from_airport'] = ticket.from_airport;
                if (ticket.from_terminal) updates['ticket_from_terminal'] = ticket.from_terminal;
                if (ticket.to_city) updates['ticket_to_city'] = ticket.to_city;
                if (ticket.to_airport) updates['ticket_to_airport'] = ticket.to_airport;
                if (ticket.to_terminal) updates['ticket_to_terminal'] = ticket.to_terminal;
                if (departDt) updates['ticket_depart_datetime'] = departDt;
                if (arriveDt) updates['ticket_arrive_datetime'] = arriveDt;
                if (ticket.seat) updates['ticket_seat'] = ticket.seat;
                if (ticket.class) updates['ticket_class'] = ticket.class;
                // Auto-set arrival_date from ticket arrive_date
                if (ticket.arrive_date) updates['arrival_date'] = ticket.arrive_date;
                // Store full JSON for reference
                updates['ticket_data_json'] = JSON.stringify(ticket);
                showToast('✅ Ticket data extracted: ' + (ticket.flight_no || '') + ' ' + (ticket.from_airport || '') + '→' + (ticket.to_airport || '') + ' ' + (ticket.depart_date || ''), 'success');
              } else {
                showToast('⚠️ Ticket saved but AI could not extract flight details automatically', 'error');
              }
            } catch(aiErr) {
              showToast('⚠️ Ticket saved. AI extraction failed: ' + aiErr.message, 'error');
            }
            setAiExtracting(false);
          }
          // === END AI TICKET EXTRACTION ===

          await onSave(candidate.id, updates);
          if (stepId !== 'travel') showToast('Document(s) saved ✓', 'success');
          onClose();
        } catch(e) {
          showToast('Save failed: ' + e.message, 'error');
        }
        setSaving(false);
      };

      const existingCount = docTypes.filter(d => candidate[d.key]).length;

      return (
        <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.65)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.15s' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:'14px', width:'96%', maxWidth:'480px', boxShadow:'0 25px 60px rgba(0,0,0,0.3)', overflow:'hidden' }}>

            {/* Header */}
            <div style={{ background: stepColor, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ color:'#fff', fontWeight:800, fontSize:'15px' }}>{stepIcon} Upload — {stepLabel}</div>
                <div style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px', marginTop:'2px' }}>{candidate.candidate_name} · {candidate.position||'—'}</div>
              </div>
              <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:'8px', width:'32px', height:'32px', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding:'20px' }}>
              {existingCount > 0 && (
                <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'8px 12px', marginBottom:'14px', fontSize:'12px', color:'#166534' }}>{existingCount} document(s) already saved for this stage — uploading will replace them.
                </div>
              )}

              {docTypes.length === 0 ? (
                <div style={{ textAlign:'center', color:'#94a3b8', padding:'24px 0', fontSize:'13px' }}>No document upload defined for this stage.</div>
              ) : docTypes.map(doc => {
                const uploaded = uploads[doc.key];
                const existing = candidate[doc.key];
                const isPdf = uploaded
                  ? isPdfUrl(uploaded.dataUrl)
                  : isPdfUrl(existing);
                return (
                  <div key={doc.key} style={{ marginBottom:'16px' }}>
                    <div style={{ fontSize:'12px', fontWeight:700, color:'#334155', marginBottom:'8px' }}><EmojiLabel text={doc.label} size={13} gap={5} /></div>

                    {/* Preview area */}
                    {(uploaded || existing) && (
                      <div style={{ marginBottom:'8px', background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'8px', padding:'10px', display:'flex', alignItems:'center', gap:'10px' }}>
                        {(() => {
                          const isStorageUrl = !uploaded && existing && existing.startsWith('http');
                          const previewUrl = uploaded ? uploaded.dataUrl : existing;
                          if (isStorageUrl) {
                            // Existing doc is a Storage URL — show link icon, don't load as img
                            return (
                              <a href={existing} target="_blank" style={{ width:'44px', height:'44px', background:'#eff6ff', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0, border:'2px solid #2563eb', textDecoration:'none' }} title="View document">
                                </a>
                            );
                          }
                          return isPdf ? (
                            <div
                              onClick={() => setStagePreview({ url: previewUrl, isPdf: true, label: doc.label })}
                              style={{ width:'44px', height:'44px', background:'#eff6ff', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0, cursor:'zoom-in', border:'2px solid #2563eb' }}
                              title="Click to view PDF"></div>
                          ) : (
                            <img
                              src={previewUrl} alt="preview"
                              onClick={() => setStagePreview({ url: previewUrl, isPdf: false, label: doc.label })}
                              style={{ width:'56px', height:'44px', objectFit:'cover', borderRadius:'6px', border:'1px solid var(--bd1)', flexShrink:0, cursor:'zoom-in' }} />
                          );
                        })()}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'12px', fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {uploaded ? uploaded.name : (isPdf ? 'PDF saved' : 'Image saved')}
                          </div>
                          <div style={{ fontSize:'10.5px', color: uploaded ? '#059669' : '#94a3b8', marginTop:'2px' }}>
                            <EmojiLabel text={uploaded ? '✓ Ready to save' : '(currently stored — upload new to replace)'} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Upload button */}
                    <label style={{ display:'inline-flex', alignItems:'center', gap:'7px', background:'#f1f5f9', border:'1.5px dashed #94a3b8', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontSize:'12.5px', color:'#475569', fontWeight:600, width:'100%', justifyContent:'center', transition:'background 0.15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#e2e8f0'}
                      onMouseLeave={e=>e.currentTarget.style.background='#f1f5f9'}>{uploaded || existing ? 'Replace file' : 'Choose file'}
                      <input type="file" accept={doc.accept} style={{ display:'none' }} onChange={e => { if (e.target.files[0]) handleFile(doc.key, e.target.files[0]); e.target.value=''; }} />
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--bd1)', display:'flex', justifyContent:'flex-end', gap:'10px' }}>
              <button onClick={onClose} style={{ background:'#e2e8f0', border:'1px solid #b6c2d1', color:'#334155', padding:'8px 18px', borderRadius:'8px', fontSize:'15px', fontWeight:700, cursor:'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || Object.keys(uploads).length===0}
                style={{ background: Object.keys(uploads).length===0 ? '#94a3b8' : stepColor, border:'none', color:'#fff', padding:'8px 20px', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor: Object.keys(uploads).length===0 ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                <EmojiLabel text={aiExtracting ? '🤖 AI Extracting...' : saving ? '⏳ Saving…' : stepId === 'travel' ? '🤖 Save & Extract Flight Data' : '💾 Save Document(s)'} />
              </button>
            </div>
          </div>

        {/* PDF/Image preview overlay */}
        {stagePreview && (
          <div onClick={()=>setStagePreview(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'12px', overflow:'hidden', maxWidth: stagePreview.isPdf ? '92vw' : '90vw', maxHeight:'93vh', width: stagePreview.isPdf ? '88vw' : 'auto', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--bd1)', background:'#f8fafc' }}>
                <span style={{ fontWeight:700, fontSize:'14px', color:'#0f172a' }}>{stagePreview.label}</span>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  {stagePreview.isPdf && stagePdfBlob && (
                    <button onClick={()=>window.open(stagePdfBlob,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Open in New Tab</button>
                  )}
                  <button onClick={()=>{ const a=document.createElement('a'); a.href=stagePreview.url; a.download=stagePreview.label.replace(/[^a-z0-9]/gi,'_')+(stagePreview.isPdf?'.pdf':'.jpg'); a.click(); }} style={{ background:'#0f2744', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Save to Folder</button>
                  <button onClick={()=>setStagePreview(null)} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#64748b', lineHeight:1 }}></button>
                </div>
              </div>
              <div style={{ flex:1, overflow: stagePreview.isPdf ? 'hidden' : 'auto', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {stagePreview.isPdf ? (
                  stagePdfBlob
                    ? <object data={stagePdfBlob} type="application/pdf" style={{ width:'100%', height:'85vh', border:'none' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px', padding:'40px', color:'#64748b' }}>
                          <div style={{ fontSize:'48px' }}></div>
                          <div style={{ fontWeight:600 }}>PDF cannot display inline in this browser.</div>
                          <button onClick={()=>window.open(stagePdfBlob,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'10px 22px', borderRadius:'8px', fontSize:'15px', fontWeight:700, cursor:'pointer' }}>Open PDF in New Tab</button>
                        </div>
                      </object>
                    : <div style={{ padding:'40px', textAlign:'center', color:'#64748b' }}><div style={{ fontSize:'48px' }}></div><div style={{ marginTop:'12px', fontWeight:600 }}>Building PDF preview…</div></div>
                ) : (
                  <img src={stagePreview.url} alt="Document" style={{ maxWidth:'80vw', maxHeight:'85vh', objectFit:'contain', display:'block' }} />
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      );
    }
    // Steps common to both tracks
    // ── SCENARIO DEFINITIONS (SOP-HR-002) ──
    const HIRING_SCENARIOS = [
      { id: 'S1', label: 'Scenario 1 — Visit Visa (Overseas → Status Change)', shortLabel: 'S1: Visit Visa',
        icon: '🛂', color: '#7c3aed', bg: '#f5f3ff',
        desc: 'Candidate is OUTSIDE UAE. SATCO sends a Visit Visa. Candidate arrives. ICP Status Change done in-country — no exit needed.',
        badge: 'Visit Visa', risk: 'Visit visa expiry clock — status change must be approved before visa expires.' },
      { id: 'S2', label: 'Scenario 2 — Entry Permit (Overseas → Flies on Permit)', shortLabel: 'S2: Entry Permit',
        icon: '✈️', color: '#b45309', bg: '#fffbeb',
        desc: 'Candidate is OUTSIDE UAE. SATCO issues Employment Entry Permit. Candidate flies on it. Full residence visa process in UAE.',
        badge: 'Entry Permit', risk: '60-day entry permit clock from ISSUE date — arrange travel immediately.' },
      { id: 'S3', label: 'Scenario 3 — In-UAE Transfer (Cancel + Re-sponsor)', shortLabel: 'S3: Transfer',
        icon: '🇦🇪', color: '#0f766e', bg: '#f0fdfa',
        desc: 'Candidate ALREADY IN UAE. Old employer cancels visa. SATCO applies Transfer Work Permit + ICP Status Change. No exit required.',
        badge: 'In-UAE Transfer', risk: 'Grace period: 90 days standard / 180 days Skill Level 1-2. Clock starts on visa cancellation.' },
    ];

    // Steps common to ALL 3 scenarios
    const STEPS_COMMON = [
      { id: 'resume',       label: 'Resume Received',    icon: '📄', days: 2,  color: '#6366f1' },
      { id: 'interview',    label: 'Interview',          icon: '🎙️', days: 5,  color: '#2563eb' },
      { id: 'offer_sent',   label: 'Offer Letter Sent',  icon: '📧', days: 3,  color: '#0891b2' },
      { id: 'offer_signed', label: 'Offer Signed',       icon: '✍️', days: 7,  color: '#059669' },
    ];
    // S1 — Visit Visa route
    const STEPS_S1 = [
      { id: 'visa_processing', label: 'Visa Process Started', icon: '🛫', days: 2, color: '#0d9488' },
      { id: 'visa_arranged', label: 'Visit Visa Issued',    icon: '🛂', days: 3, color: '#7c3aed' },
      { id: 'travel',        label: 'Candidate Travels',    icon: '✈️', days: 5, color: '#9333ea' },
      { id: 'work_permit',   label: 'Work Permit (MOHRE)',  icon: '📋', days: 5, color: '#c026d3' },
      { id: 'status_change', label: 'ICP Status Change',    icon: '🔄', days: 5, color: '#db2777' },
      { id: 'medical',       label: 'UAE Medical Test',     icon: '🏥', days: 2, color: '#e11d48' },
      { id: 'eid',           label: 'EID Biometrics',       icon: '🪪', days: 2, color: '#dc2626' },
      { id: 'visa_stamped',  label: 'Visa Stamped',         icon: '✅', days: 5, color: '#b91c1c' },
    ];
    // S2 — Entry Permit route
    const STEPS_S2 = [
      { id: 'visa_processing', label: 'Visa Process Started', icon: '🛫', days: 2, color: '#0d9488' },
      { id: 'work_permit',   label: 'Work Permit (MOHRE)',  icon: '📋', days: 5, color: '#b45309' },
      { id: 'entry_permit',  label: 'Entry Permit Issued',  icon: '🛂', days: 3, color: '#d97706' },
      { id: 'travel',        label: 'Candidate Travels',    icon: '✈️', days: 5, color: '#ea580c' },
      { id: 'medical',       label: 'UAE Medical Test',     icon: '🏥', days: 2, color: '#dc2626' },
      { id: 'eid',           label: 'EID Biometrics',       icon: '🪪', days: 2, color: '#b91c1c' },
      { id: 'visa_stamped',  label: 'Visa Stamped',         icon: '✅', days: 5, color: '#991b1b' },
    ];
    // S3 — In-UAE Transfer route
    const STEPS_S3 = [
      { id: 'visa_processing', label: 'Visa Process Started', icon: '🛫', days: 2, color: '#0d9488' },
      { id: 'visa_cancel',   label: 'Old Visa Cancelled',   icon: '🚫', days: 2, color: '#0f766e' },
      { id: 'work_permit',   label: 'Transfer Work Permit', icon: '📋', days: 5, color: '#0d9488' },
      { id: 'status_change', label: 'ICP Status Change',    icon: '🔄', days: 5, color: '#059669' },
      { id: 'medical',       label: 'UAE Medical Test',     icon: '🏥', days: 2, color: '#16a34a' },
      { id: 'eid',           label: 'EID Biometrics',       icon: '🪪', days: 2, color: '#15803d' },
      { id: 'visa_stamped',  label: 'Visa Stamped',         icon: '✅', days: 5, color: '#166534' },
    ];
    const STEP_END = { id: 'joined', label: 'Joined', icon: '🏢', days: 0, color: '#059669' };

    // Shared list of "in visa processing" step ids — used by every KPI count, filter dropdown,
    // and grouping view so they all agree on what counts as "Visa Processing". Single source of
    // truth: add a new visa-route step here once and every view picks it up automatically.
    const VISA_PROCESSING_STEP_IDS = ['visa_processing','visa_arranged','work_permit','entry_permit','status_change','medical','eid','visa_stamped','visa_cancel','travel'];

    // ── SOP WORKFLOW REFERENCE CHARTS ──
    // Static images shipped alongside index.html in the repo (NOT embedded as base64 — keeps
    // the app file light and avoids the same egress problem base64 blobs caused in Supabase).
    // If a chart is missing from the deployed folder the thumbnail/button still renders, it
    // just shows a broken-image icon until the file is added.
    // ── SOP STEPS BY SCENARIO (SOP-HR-002) — module scope so both HiringModal's
    // Visa Steps tab and the Hiring Pipeline board's status badges can use it. ──
    const SOP_BY_SCENARIO = {
  S1: [
    { ref:'1', label:'Candidate Arrives in UAE (Visit Visa)', who:'Candidate', tat:'—', dateField:'arrival_date', hint:'Record the date the candidate physically arrives in the UAE on the visit visa. This starts the visit-visa clock.', warning:'⚠ Visit visa clock starts on arrival — status change must be completed before the visit visa expires.', track:'ARR' },
    { ref:'2', label:'Documents Handed to Typing Center', who:'SATCO PRO', tat:'—', dateField:'typing_center_date', hint:'Passport and candidate documents handed to the typing center / PRO to start government processing.', track:'V' },
    { ref:'3', label:'Contract Received for Signature (Employee & SATCO)', who:'HR + Candidate', tat:'—', dateField:'contract_draft_date', hint:'Employment contract signed by both the employee and SATCO.', track:'V' },
    { ref:'4', label:'Received E-Visa', who:'SATCO PRO', tat:'—', dateField:'evisa_received_date', hint:'Electronic residence visa (e-visa) received from ICP/GDRFA, ahead of the physical stamp in the passport.', track:'V' },
    { ref:'5', label:'Medical Test', who:'Candidate', tat:'—', dateField:'medical_fitness_date', resultField:'medical_fitness_result', resultOpts:['Pending','FIT','UNFIT'], hint:'UAE medical fitness test at an approved centre.', track:'V' },
    { ref:'6', label:'Health Insurance', who:'SATCO HR', tat:'—', dateField:'insurance_arranged_date', refField:'insurance_policy_no', refLabel:'Policy Number', hint:'Health insurance policy arranged and active.', track:'V' },
    { ref:'7', label:'Emirates ID Biometric', who:'Candidate', tat:'—', dateField:'eid_biometric_date', refField:'eid_application_ref', refLabel:'EID Application Ref', hint:'Biometrics captured at an ICP service centre.', track:'V' },
    { ref:'8', label:'Joined SATCO', who:'—', tat:'—', dateField:'available_from', hint:'Date the candidate officially joined and started work at SATCO.', track:'V' },
    { ref:'9', label:'Received Original Emirates ID', who:'PRO', tat:'—', dateField:'eid_issued_date', hint:'Physical Emirates ID card collected and handed to the employee.', track:'V' },
    { ref:'10', label:'Bank Account Opened', who:'Finance / HR', tat:'—', dateField:'wps_enrolled_date', hint:'Bank account opened for salary transfer (WPS).', track:'V' },
  ],

  S2: [
    { ref:'Pre', phase:'PRE', label:'MOHRE Quota & WPS Compliance Check', who:'SATCO PRO', tat:'1 WD', dateField:null, hint:'Confirm MOHRE quota, WPS compliance, Trade Licence active. MOHRE Smart Services.', track:'A' },
    { ref:'A2', phase:'A', label:'Work Permit Applied (MOHRE Tasheel)', who:'SATCO PRO', tat:'2–5 WD', dateField:'work_permit_date', refField:'work_permit_ref', refLabel:'MOHRE Ref No.', hint:'Passport copy (6m+ valid), job title, attested degree (skilled roles), photo. Note: GAMCA fit certificate may be required for Indian nationals.', track:'A' },
    { ref:'A3', phase:'A', label:'GAMCA / Wafid Pre-departure Medical (Indian nationals)', who:'Candidate (India)', tat:'5–10 days', dateField:'visa_medical_date', resultField:'gamka_result', resultOpts:['Not done','FIT','Conditional','UNFIT'], hint:'17 GAMCA-approved centres India. Wafid registration at wafid.com. Cost: INR 5,000–9,500. Validity 3 months. Screens for TB, HIV, Hepatitis B. This does NOT replace UAE medical test.', warning:'⚠ Required for Indian nationals. Entry permit may not be issued without GAMCA certificate.', track:'A' },
    { ref:'A4', phase:'A', label:'Employment Entry Permit Applied (ICP)', who:'SATCO PRO', tat:'2–3 WD', dateField:'entry_permit_date', refField:'entry_permit_ref', refLabel:'Entry Permit No.', expiryField:'entry_permit_expiry', expiryLabel:'Entry Permit Expiry (60d from issue)', hint:'Requires: MOHRE work permit approval, passport copy, GAMCA certificate, signed contract, Trade Licence, Establishment Card.', warning:'⚠ 60-day clock starts from ISSUE date — arrange candidate travel immediately after receipt.', track:'A' },
    { ref:'A5', phase:'A', label:'Health Insurance Arranged', who:'SATCO HR', tat:'1–2 WD', dateField:'insurance_arranged_date', refField:'insurance_policy_no', refLabel:'Policy Number', hint:'DAMAN or ICP-approved Abu Dhabi insurer. Must be active BEFORE visa stamping (Step B5).', track:'A' },
    { ref:'A6', phase:'A', label:'Entry Permit Sent to Candidate — Candidate Travels', who:'SATCO PRO → Candidate', tat:'—', dateField:'arrival_date', hint:'Email entry permit PDF. Candidate flies to Abu Dhabi. Must arrive before 60-day permit expiry. Original GAMCA certificate to carry.', track:'A' },
    { ref:'B1', phase:'B', label:'UAE Medical Fitness Test (SEHA/ICP-approved)', who:'Candidate + PRO', tat:'Result: 1–2 WD', dateField:'medical_fitness_date', resultField:'medical_fitness_result', resultOpts:['Pending','FIT','UNFIT'], hint:'MANDATORY even if GAMCA done in India — separate test. SEHA centre, Abu Dhabi. Fee: AED 260–360.', warning:'⚠ GAMCA does NOT replace the UAE in-country medical test. Both are required.', track:'B' },
    { ref:'B2', phase:'B', label:'Emirates ID Biometrics', who:'Candidate + PRO', tat:'1–2 WD', dateField:'eid_biometric_date', refField:'eid_application_ref', refLabel:'EID Application Ref', hint:'ICP Service Centre. Fee: AED 200. Docs: passport, entry permit, EID application form.', track:'B' },
    { ref:'B3', phase:'B', label:'Employment Contract Registered (MOHRE)', who:'SATCO PRO', tat:'Within 14 days of ARRIVAL', dateField:'contract_registered_date', hint:'Must register within 14 days of the candidate\'s UAE arrival date. Missing deadline = MOHRE penalties.', warning:'⚠ Legal deadline: 14 days from arrival date (Step A6). Count from arrival, not from entry permit date.', track:'B' },
    { ref:'B4', phase:'B', label:'WPS Enrolment (Bank Setup)', who:'Finance / HR', tat:'Same as B3', dateField:'wps_enrolled_date', hint:'Bank account setup for salary transfer. First salary via WPS.', track:'B' },
    { ref:'B5', phase:'B', label:'Residence Visa Stamp Applied (ICP)', who:'SATCO PRO', tat:'2–5 WD', dateField:'visa_stamp_applied_date', hint:'Requires: Medical clearance, EID receipt, passport original, health insurance proof, visa fee ~AED 500–700.', track:'B' },
    { ref:'B6', phase:'B', label:'Visa Stamped in Passport — Passport Returned', who:'ICP → PRO → Candidate', tat:'2–5 WD after B5', dateField:'visa_stamped_in_passport_date', hint:'2-year Employment Residence Visa stamped. PRO returns passport to candidate.', track:'B' },
    { ref:'B7', phase:'B', label:'Emirates ID Card Issued', who:'PRO / Candidate', tat:'3–5 WD after stamp', dateField:'eid_issued_date', hint:'Collected from ICP or posted. Primary residency proof.', track:'B' },
    { ref:'B8', phase:'B', label:'Labour Card Issued (MOHRE)', who:'SATCO PRO', tat:'3–5 WD', dateField:'labour_card_date', refField:'labour_card_ref', refLabel:'Labour Card Ref', hint:'Digital Labour Card. Fee: AED 250–3,450. All steps must be complete.', track:'B' },
  ],
  S3: [
    { ref:'1', label:'Visa Cancelled & Documents Handed to SATCO', who:'Old Employer / Candidate', tat:'—', dateField:'visa_cancel_date', hint:'Old employer cancels the residence visa and the candidate hands over passport and documents to SATCO. This is the start date for this candidate\'s SATCO pipeline.', warning:'⚠ Grace period starts immediately on cancellation — 90 days standard / 180 days Skill Level 1-2.', track:'ARR' },
    { ref:'2', label:'Documents Handed to Typing Center', who:'SATCO PRO', tat:'—', dateField:'typing_center_date', hint:'Passport and candidate documents handed to the typing center / PRO to start government processing.', track:'V' },
    { ref:'3', label:'Contract Received for Signature (Employee & SATCO)', who:'HR + Candidate', tat:'—', dateField:'contract_draft_date', hint:'Employment contract signed by both the employee and SATCO.', track:'V' },
    { ref:'4', label:'Received E-Visa', who:'SATCO PRO', tat:'—', dateField:'evisa_received_date', hint:'Electronic residence visa (e-visa) received from ICP/GDRFA, ahead of the physical stamp in the passport.', track:'V' },
    { ref:'5', label:'Medical Test', who:'Candidate', tat:'—', dateField:'medical_fitness_date', resultField:'medical_fitness_result', resultOpts:['Pending','FIT','UNFIT'], hint:'UAE medical fitness test at an approved centre.', track:'V' },
    { ref:'6', label:'Health Insurance', who:'SATCO HR', tat:'—', dateField:'insurance_arranged_date', refField:'insurance_policy_no', refLabel:'Policy Number', hint:'Health insurance policy arranged and active.', track:'V' },
    { ref:'7', label:'Emirates ID Biometric', who:'Candidate', tat:'—', dateField:'eid_biometric_date', refField:'eid_application_ref', refLabel:'EID Application Ref', hint:'Biometrics captured at an ICP service centre.', track:'V' },
    { ref:'8', label:'Joined SATCO', who:'—', tat:'—', dateField:'available_from', hint:'Date the candidate officially joined and started work at SATCO.', track:'V' },
    { ref:'9', label:'Received Original Emirates ID', who:'PRO', tat:'—', dateField:'eid_issued_date', hint:'Physical Emirates ID card collected and handed to the employee.', track:'V' },
    { ref:'10', label:'Bank Account Opened', who:'Finance / HR', tat:'—', dateField:'wps_enrolled_date', hint:'Bank account opened for salary transfer (WPS).', track:'V' },
  ],

    };

    // Progress summary for a candidate against their scenario's Visa Steps — {total, done, pct, currentLabel}
    // or null if no visa route has been chosen yet. Used for the compact status badge shown
    // on Hiring Pipeline rows/cards instead of separate action buttons.
    const getVisaStepsProgress = (c) => {
      const sc = c && c.hiring_scenario;
      const steps = SOP_BY_SCENARIO[sc];
      if (!steps) return null;
      const dated = steps.filter(s => s.dateField);
      const total = dated.length;
      const done = dated.filter(s => stepDone(c, s.dateField)).length;
      const pct = total > 0 ? Math.round(done / total * 100) : 0;
      const current = dated.find(s => !stepDone(c, s.dateField));
      const currentLabel = c.status === 'Joined' ? 'Joined' : (current ? current.label : (total ? 'All steps done' : '—'));
      return { total, done, pct, currentLabel };
    };

    const SOP_GUIDES = {
      S1: { title: 'S1 — Visit Visa (Overseas → Status Change)', images: [
        { src: 'sop-s1-visit-visa.webp', label: 'Visitor Visa → Residence Visa Transition (Abu Dhabi)' },
      ]},
      S2: { title: 'S2 — Entry Permit (Overseas → Flies on Permit)', images: [
        { src: 'sop-s2a-india-processing.webp', label: 'Abu Dhabi Employment Visa Processing — India Side' },
        { src: 'sop-s2b-post-arrival.webp', label: 'Employment Visa Activation After Arrival (from India Stamping)' },
      ]},
      S3: { title: 'S3 — In-UAE Transfer (Cancel + Re-sponsor)', images: [
        { src: 'sop-s3-transfer.webp', label: 'UAE Employment Visa Transfer & Status Adjustment (In-Country)' },
      ]},
    };

    // Full-screen chart viewer — shared by the Pipeline view's quick "SOP Guide" buttons and
    // the standalone Workflow Guides page. Takes guideKey (S1/S2/S3) + startIndex and looks the
    // rest up from SOP_GUIDES itself, so it can page between charts within a guide AND between
    // the different visa-route guides without ever getting stuck with no way back.
    function SopChartViewer({ guideKey, startIndex, onClose }) {
      const guideKeys = Object.keys(SOP_GUIDES);
      const [key, setKey] = useState(guideKey);
      const [idx, setIdx] = useState(startIndex || 0);
      const guide = SOP_GUIDES[key];
      const images = guide.images;
      const img = images[idx];
      const scen = HIRING_SCENARIOS.find(s => s.id === key);

      const goGuide = (dir) => {
        const gi = guideKeys.indexOf(key);
        setKey(guideKeys[(gi + dir + guideKeys.length) % guideKeys.length]);
        setIdx(0);
      };
      const goImage = (dir) => setIdx(i => (i + dir + images.length) % images.length);

      return (
        <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'12px', overflow:'hidden', maxWidth:'95vw', maxHeight:'94vh', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:'1px solid var(--bd1)', background:'#f8fafc', gap:'14px', flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <button onClick={onClose} style={{ background:'#e2e8f0', border:'1px solid #b6c2d1', borderRadius:'7px', padding:'6px 12px', fontSize:'13px', fontWeight:700, cursor:'pointer', color:'#334155', whiteSpace:'nowrap' }}>← Back to Guides</button>
                <div>
                  <div style={{ fontWeight:800, fontSize:'14px', color:'#0f172a' }}>{guide.title}</div>
                  <div style={{ fontSize:'11.5px', color:'#64748b', marginTop:'2px' }}>{img.label}{images.length > 1 && ` — chart ${idx+1} of ${images.length}`}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
                {images.length > 1 && (
                  <>
                    <button onClick={()=>goImage(-1)} style={{ background:'#e2e8f0', border:'1px solid #b6c2d1', borderRadius:'7px', padding:'5px 10px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Prev</button>
                    <button onClick={()=>goImage(1)} style={{ background:'#e2e8f0', border:'1px solid #b6c2d1', borderRadius:'7px', padding:'5px 10px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Next →</button>
                  </>
                )}
                <span style={{ width:'1px', height:'20px', background:'#cbd5e1', display:'inline-block' }} />
                <button onClick={()=>goGuide(-1)} title="Previous visa route guide" style={{ background:scen?scen.color:'#334155', border:'none', color:'#fff', borderRadius:'7px', padding:'5px 12px', fontSize:'13px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>← Prev Route</button>
                <button onClick={()=>goGuide(1)} title="Next visa route guide" style={{ background:scen?scen.color:'#334155', border:'none', color:'#fff', borderRadius:'7px', padding:'5px 12px', fontSize:'13px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>Next Route →</button>
                <button onClick={onClose} title="Close" style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#64748b', lineHeight:1 }}>×</button>
              </div>
            </div>
            <div style={{ flex:1, overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5f9', padding:'12px' }}>
              <img src={img.src} alt={img.label} style={{ maxWidth:'100%', maxHeight:'82vh', objectFit:'contain', borderRadius:'6px', boxShadow:'0 2px 10px rgba(0,0,0,0.1)' }} />
            </div>
          </div>
        </div>
      );
    }

    // All unique steps flattened (for backward compat & table view)
    const HIRING_STEPS = [...STEPS_COMMON, ...STEPS_S1, ...STEPS_S2, ...STEPS_S3, STEP_END]
      .filter((s, i, a) => a.findIndex(x => x.id === s.id) === i);

    // Get scenario object for a record
    const getScenario = (r) => HIRING_SCENARIOS.find(s => s.id === r.hiring_scenario) || null;

    // Get the ordered step array for a given scenario (used in pipeline + modal tracker)
    const getScenarioSteps = (scenarioId) => {
      const vis = scenarioId === 'S1' ? STEPS_S1 : scenarioId === 'S2' ? STEPS_S2 : scenarioId === 'S3' ? STEPS_S3 : [];
      return [...STEPS_COMMON, ...vis, STEP_END];
    };

    // Legacy helper (kept for any remaining references)
    const isUAEBased = (r) => r.hiring_scenario === 'S3';

    // ── STEP COMPLETION & CASCADE ──
    // Steps whose own date starts a compliance deadline elsewhere — these always need a real
    // date. They're never eligible for the "mark completed, date unknown" shortcut, and a
    // backward cascade will skip over them rather than silently confirming them.
    const ANCHOR_DATE_FIELDS = ['visa_arranged_date', 'entry_permit_date', 'arrival_date', 'status_change_date', 'visa_cancel_date'];

    // step_confirmations is stored as a JSON string on the record: { [dateFieldName]: true } —
    // flags a step as confirmed complete even though no exact date was recorded for it.
    const parseStepConfirmations = (r) => {
      if (!r || !r.step_confirmations) return {};
      try { const v = JSON.parse(r.step_confirmations); return (v && typeof v === 'object') ? v : {}; }
      catch (e) { return {}; }
    };
    const isStepConfirmed = (r, dateField) => !!parseStepConfirmations(r)[dateField];
    // A step counts as done if it has a real date OR was confirmed (directly or via cascade)
    // without one.
    const stepDone = (r, dateField) => !!(r && dateField && (r[dateField] || isStepConfirmed(r, dateField)));

    // When a step is confirmed (with or without a date), walk backward through the earlier
    // steps in the same scenario's SOP list and mark any still-open, non-anchor step complete
    // too — "if step 3 is confirmed, steps 1–2 must already be done". Anchor steps are left
    // untouched; their labels are returned so the caller can surface a note instead of silently
    // skipping them.
    const cascadeStepConfirmations = (r, sopSteps, confirmedField) => {
      const idx = sopSteps.findIndex(s => s.dateField === confirmedField);
      const confirmations = parseStepConfirmations(r);
      const skippedAnchors = [];
      for (let i = idx - 1; i >= 0; i--) {
        const step = sopSteps[i];
        if (!step.dateField || r[step.dateField] || confirmations[step.dateField]) continue;
        if (ANCHOR_DATE_FIELDS.includes(step.dateField)) { skippedAnchors.push(step.label); continue; }
        confirmations[step.dateField] = true;
      }
      return { confirmations, skippedAnchors };
    };

    // resolveStep — module scope so both HiringView and HiringModal can use it
    // PRIORITY: manual_stage (explicit "Move to stage" click) always wins over date-inference,
    // so the kanban column only changes when someone deliberately moves the card.
    // Granular steps use stepDone() so a "completed, date unknown" confirmation (or one
    // inherited via backward cascade) advances the board the same way a real date would.
    const resolveStep = (r) => {
      if (r.manual_stage) return r.manual_stage;
      if (r.status === 'Joined') return 'joined';
      if (r.offer_accepted_date) {
        const sc = r.hiring_scenario;
        if (sc === 'S1') {
          if (stepDone(r,'visa_stamped_in_passport_date')) return 'visa_stamped';
          if (stepDone(r,'eid_biometric_date'))             return 'eid';
          if (stepDone(r,'medical_fitness_date'))           return 'medical';
          if (stepDone(r,'status_change_date') || stepDone(r,'residence_visa_date')) return 'status_change';
          if (stepDone(r,'work_permit_date'))               return 'work_permit';
          if (r.arrival_date || r.expected_arrival_date)    return 'travel';
          if (r.entry_permit_date || r.visa_arranged_date)  return 'visa_arranged';
          return 'offer_signed';
        } else if (sc === 'S2') {
          if (stepDone(r,'visa_stamped_in_passport_date')) return 'visa_stamped';
          if (stepDone(r,'eid_biometric_date'))             return 'eid';
          if (stepDone(r,'medical_fitness_date'))           return 'medical';
          if (r.arrival_date)                               return 'travel';
          if (r.entry_permit_date)                          return 'entry_permit';
          if (stepDone(r,'work_permit_date'))               return 'work_permit';
          return 'offer_signed';
        } else if (sc === 'S3') {
          if (stepDone(r,'visa_stamped_in_passport_date')) return 'visa_stamped';
          if (stepDone(r,'eid_biometric_date'))             return 'eid';
          if (stepDone(r,'medical_fitness_date'))           return 'medical';
          if (stepDone(r,'status_change_date') || stepDone(r,'residence_visa_date')) return 'status_change';
          if (stepDone(r,'work_permit_date'))               return 'work_permit';
          if (r.visa_cancel_date)                           return 'visa_cancel';
          return 'offer_signed';
        }
        return 'offer_signed';
      }
      if (r.offer_letter_date)    return 'offer_sent';
      if (r.interview_date)       return 'interview';
      if (r.step && r.step !== 'resume') return r.step;
      return 'resume';
    };

    const HIRING_STATUS_COLORS = {
      'Active': '#059669', 'Offer Pending': '#2563eb', 'Offer Accepted': '#0891b2',
      'Visa Processing': '#ca8a04', 'Travelling': '#7c3aed', 'Joined': '#059669',
      'Withdrawn': '#dc2626', 'On Hold': '#94a3b8',
    };

    // ── Temp Employee ID panel ──────────────────────────────────────────────
    // Shown once Visa Processing has started. Display-only — it shows the Temp ID and points
    // to SATCO-Finance for actually recording any deposit/advance. Deposit amounts are NOT
    // tracked in HR at all; this avoids the same figure being entered twice in two systems.
    // Shown on a candidate once Visa Processing has started (temp_employee_id is set).
    // Deposit/advance capture is entirely OPTIONAL — sole discretion of management — so the
    // toggle defaults off and nothing else is required to save the panel as "not collected".
    function TempIdDepositPanel({ candidate, onSaveDoc, onStartVisaProcessing, showToast, onUpdated }) {
      const [assigning, setAssigning] = useState(false);

      const assignNow = async () => {
        setAssigning(true);
        try {
          const tempId = await onStartVisaProcessing(candidate);
          onUpdated({ temp_employee_id: tempId });
          showToast(`Temp ID ${tempId} assigned`);
        } catch (err) { showToast('❌ Assign failed: ' + err.message, 'error'); }
        setAssigning(false);
      };

      if (!candidate.temp_employee_id) {
        return (
          <div style={{ background:'#fffbeb', border:'1.5px solid #fcd34d', borderRadius:'10px', padding:'14px 16px' }}>
            <div style={{ fontSize:'11px', fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Visa Processing — No Temp ID Yet</div>
            <div style={{ fontSize:'11.5px', color:'#78350f', marginBottom:'10px' }}>This candidate is already in visa processing but doesn't have a Temp Employee ID — likely moved before this feature was wired up. Assign one now so Finance can log any deposit/advance against them.</div>
            <button onClick={assignNow} disabled={assigning} style={{ background:'#d97706', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer', opacity:assigning?0.6:1 }}>{assigning?'Assigning…':'🆔 Assign Temp ID now'}</button>
          </div>
        );
      }

      return (
        <div style={{ background:'#f0fdfa', border:'1.5px solid #99f6e4', borderRadius:'10px', padding:'14px 16px' }}>
          <div style={{ fontSize:'11px', fontWeight:800, color:'#0f766e', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Visa Processing</div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:'11px', color:'#475569' }}>Temp Employee ID</span>
            <span style={{ background:'#fff', border:'1px solid #5eead4', color:'#0f766e', fontWeight:800, fontFamily:'monospace', fontSize:'13px', padding:'2px 10px', borderRadius:'6px' }}>{candidate.temp_employee_id}</span>
          </div>
          <div style={{ fontSize:'10.5px', color:'#64748b', marginTop:'6px' }}>Use this ID in SATCO-Finance (Onboarding & Misc → Security Deposit) to record any deposit/advance collected from this candidate before joining.</div>
        </div>
      );
    }


// ── TransportArrangementPanel ─────────────────────────────────────────────
// Full transport workflow: Visit Visa → Ticket → D-Return → D-Hotel → Arrival
// Inserted before HiringView in index211
// ─────────────────────────────────────────────────────────────────────────

function TransportArrangementPanel({ candidate: candidateProp, onSaveDoc, showToast, onUpdated, db }) {
  const supaUrl = 'https://oaerqjrkdpuhiproppaz.supabase.co';
  const supaKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI';
  // Local candidate state so UI updates immediately after upload without waiting for parent re-fetch
  const [candidate, setCandidate] = React.useState(candidateProp);
  React.useEffect(() => { setCandidate(candidateProp); }, [candidateProp.id]);
  const [loading, setLoading] = React.useState({});
  const [editArrival, setEditArrival] = React.useState(false);
  const [arrivalInput, setArrivalInput] = React.useState(candidateProp.date_of_arrival || '');
  const [fixingTime, setFixingTime] = React.useState(false);
  const [fixDepartVal, setFixDepartVal] = React.useState('');
  const [fixArriveVal, setFixArriveVal] = React.useState('');

  const setLoad = (k, v) => setLoading(p => ({ ...p, [k]: v }));

  const fmt = d => {
    if (!d) return '—';
    // Date-only strings (YYYY-MM-DD) must be parsed as LOCAL date to avoid UTC-shift.
    // new Date("2026-07-03") is midnight UTC → shows 02 Jul in UTC+4 browser.
    const s = String(d).slice(0, 10); // take YYYY-MM-DD part
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const dt = new Date(+m[1], +m[2]-1, +m[3]); // local date, no UTC shift
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const fmtDt = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '—';

  // Upload to Supabase Storage
  const uploadFile = async (file, docType) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `transport/${candidate.id}/${docType}_${Date.now()}.${ext}`;
    const res = await fetch(`${supaUrl}/storage/v1/object/hr-documents/${path}`, {
      method: 'POST',
      headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}`, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: file
    });
    if (!res.ok) {
      if (res.status === 400) throw new Error('Storage 400: hr-documents bucket must be set to Public in Supabase → Storage → hr-documents → Make Public');
      throw new Error('Upload failed: ' + res.status);
    }
    return `${supaUrl}/storage/v1/object/public/hr-documents/${path}`;
  };

  // Read file as base64
  const fileToBase64 = file => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  // AI: extract visa data
  const extractVisa = async (base64DataUrl) => {
    try {
      const b64 = base64DataUrl.split(',')[1];
      const mt = base64DataUrl.startsWith('data:application/pdf') ? 'application/pdf' : base64DataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const r = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: mt, data: b64 } },
            { type: 'text', text: 'Extract from this UAE eVisa/Visit Visa document and return ONLY valid JSON:\n{"full_name":"","permit_no":"","issue_date":"YYYY-MM-DD","expiry_date":"YYYY-MM-DD","visa_type":"Tourism - Single - 30 Days","passport_no":"","uid_no":"","nationality":""}' }
          ]}] }) });
      const d = await r.json();
      const txt = (d.content||[]).find(b=>b.type==='text')?.text||'{}';
      return JSON.parse(txt.replace(/```json|```/g,'').trim());
    } catch(e) { return {}; }
  };

  // AI: extract ticket data
  const extractTicket = async (base64DataUrl) => {
    try {
      const b64 = base64DataUrl.split(',')[1];
      const mt = base64DataUrl.startsWith('data:application/pdf') ? 'application/pdf' : base64DataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const r = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: mt, data: b64 } },
            { type: 'text', text: 'Extract ALL flight details from this airline ticket and return ONLY valid JSON. CRITICAL: Use times EXACTLY as printed on the ticket - do NOT convert to UTC. depart_time is local time at origin, arrive_time is local time at destination.\n{"pnr":"","airline":"","flight_no":"","from_city":"","from_airport":"","from_terminal":"","to_city":"","to_airport":"","to_terminal":"","depart_date":"YYYY-MM-DD local date at origin as printed","depart_time":"HH:MM local time at origin as printed","arrive_date":"YYYY-MM-DD local date at destination as printed","arrive_time":"HH:MM local time at destination as printed","depart_tz_offset":"+05:30 for India etc","arrive_tz_offset":"+04:00 for UAE etc","seat":"","class":"Economy","passenger_name":""}' }
          ]}] }) });
      const d = await r.json();
      const txt = (d.content||[]).find(b=>b.type==='text')?.text||'{}';
      return JSON.parse(txt.replace(/```json|```/g,'').trim());
    } catch(e) { return {}; }
  };

  // Save updates to hiring_pipeline and update local state immediately
  // Schema-cache-safe update: if a column doesn't exist yet, drop it and retry
  const saveUpdates = async (updates) => {
    let payload = { ...updates };
    const isMissingCol = (err, col) => {
      const msg = (err && (err.message || err.details || '')) || '';
      return new RegExp(col, 'i').test(msg) && /(schema cache|does not exist|column)/i.test(msg);
    };
    for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
      const { error } = await window._satcoDB.from('hiring_pipeline').update(payload).eq('id', candidate.id);
      if (!error) break;
      const badCol = Object.keys(payload).find(col => isMissingCol(error, col));
      if (!badCol) throw new Error(error.message);
      delete payload[badCol]; // drop unknown column and retry
    }
    setCandidate(prev => ({ ...prev, ...updates }));
    onUpdated && onUpdated(updates);
  };

  // ── VISIT VISA UPLOAD ──
  const handleVisaUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoad('visa', true);
    try {
      showToast('Uploading visa...', 'info');
      const [url, b64] = await Promise.all([uploadFile(file, 'visit_visa'), fileToBase64(file)]);
      showToast('🤖 AI reading visa details...', 'info');
      const ex = await extractVisa(b64);
      const updates = {
        visit_visa_url: url,
        visit_visa_issue_date: ex.issue_date || null,
        visit_visa_expiry_date: ex.expiry_date || null,
        visit_visa_permit_no: ex.permit_no || null,
        visit_visa_type: ex.visa_type || 'Tourism - Single - 30 Days',
      };
      await saveUpdates(updates);
      showToast(`✅ Visa uploaded! Issue: ${ex.issue_date||'?'} | Expiry: ${ex.expiry_date||'?'}`, 'success');
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
    setLoad('visa', false); e.target.value = '';
  };

  // ── D-RETURN TICKET UPLOAD ──
  const handleReturnUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoad('return', true);
    try {
      const url = await uploadFile(file, 'd_return_ticket');
      const drDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }); // YYYY-MM-DD in UAE local time
      await saveUpdates({ d_return_ticket_url: url, d_return_ticket_sent_date: drDate });
      showToast('✅ D-Return Ticket uploaded', 'success');
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
    setLoad('return', false); e.target.value = '';
  };

  // ── D-HOTEL BOOKING UPLOAD ──
  const handleHotelUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoad('hotel', true);
    try {
      const url = await uploadFile(file, 'd_hotel_booking');
      const dhDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }); // YYYY-MM-DD in UAE local time
      await saveUpdates({ d_hotel_booking_url: url, d_hotel_booking_sent_date: dhDate });
      showToast('✅ D-Hotel Booking uploaded', 'success');
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
    setLoad('hotel', false); e.target.value = '';
  };

  // ── ONWARD TICKET UPLOAD (with AI extraction) ──
  const handleTicketUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoad('ticket', true);
    try {
      showToast('📤 Uploading ticket...', 'info');
      const [url, b64] = await Promise.all([uploadFile(file, 'onward_ticket'), fileToBase64(file)]);
      showToast('🤖 AI reading ticket details...', 'info');
      const ex = await extractTicket(b64);
      const updates = { onward_ticket_url: url };
      // Build departure datetime with timezone offset so Supabase stores correct UTC
      if (ex.depart_date && ex.depart_time) {
        const dTz = ex.depart_tz_offset || '+05:30'; // default IST for India origin
        updates.ticket_depart_datetime = ex.depart_date + 'T' + ex.depart_time + ':00' + dTz;
      }
      // Build arrival datetime with timezone offset (UAE = +04:00)
      if (ex.arrive_date && ex.arrive_time) {
        const aTz = ex.arrive_tz_offset || '+04:00'; // default GST for UAE destination
        updates.ticket_arrive_datetime = ex.arrive_date + 'T' + ex.arrive_time + ':00' + aTz;
      }
      if (ex.pnr) updates.ticket_pnr = ex.pnr;
      if (ex.airline) updates.ticket_airline = ex.airline;
      if (ex.flight_no) updates.ticket_flight_no = ex.flight_no;
      if (ex.from_city) updates.ticket_from_city = ex.from_city;
      if (ex.from_airport) updates.ticket_from_airport = ex.from_airport;
      if (ex.from_terminal) updates.ticket_from_terminal = ex.from_terminal;
      if (ex.to_city) updates.ticket_to_city = ex.to_city;
      if (ex.to_airport) updates.ticket_to_airport = ex.to_airport;
      if (ex.to_terminal) updates.ticket_to_terminal = ex.to_terminal;
      if (ex.seat) updates.ticket_seat = ex.seat;
      if (ex.class) updates.ticket_class = ex.class;
      if (ex.arrive_date) updates.arrival_date = ex.arrive_date;
      await saveUpdates(updates);
      const summary = ex.flight_no ? `${ex.flight_no} · ${ex.from_airport||'?'}→${ex.to_airport||'?'} · ${ex.depart_date||'?'}` : 'Ticket uploaded';
      showToast(`✅ ${summary}`, 'success');
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
    setLoad('ticket', false); e.target.value = '';
  };

  // ── SAVE ARRIVAL DATE ──
  // ── MANUAL TICKET TIME FIX ──
  const openFixTime = () => {
    // Pre-populate with current stored values in Asia/Dubai timezone
    if (candidate.ticket_depart_datetime) {
      const d = new Date(candidate.ticket_depart_datetime);
      const localStr = d.toLocaleString('sv-SE', { timeZone: 'Asia/Dubai' }).replace(' ', 'T').slice(0, 16);
      setFixDepartVal(localStr);
    }
    if (candidate.ticket_arrive_datetime) {
      const d = new Date(candidate.ticket_arrive_datetime);
      const localStr = d.toLocaleString('sv-SE', { timeZone: 'Asia/Dubai' }).replace(' ', 'T').slice(0, 16);
      setFixArriveVal(localStr);
    }
    setFixingTime(true);
  };
  const saveFixedTimes = async () => {
    try {
      const updates = {};
      if (fixDepartVal) updates.ticket_depart_datetime = fixDepartVal + ':00+04:00'; // treat input as UAE local
      if (fixArriveVal) {
        updates.ticket_arrive_datetime = fixArriveVal + ':00+04:00'; // UAE local
        updates.arrival_date = fixArriveVal.slice(0, 10); // YYYY-MM-DD
      }
      await saveUpdates(updates);
      setFixingTime(false);
      showToast('✅ Ticket times corrected', 'success');
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  };

  const saveArrival = async () => {
    if (!arrivalInput) return;
    try {
      await saveUpdates({ date_of_arrival: arrivalInput, arrival_manually_set: true });
      setEditArrival(false);
      showToast('✅ Arrival date saved', 'success');
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  };

  // ── CALCULATIONS ──
  const today = new Date(); today.setHours(0,0,0,0);
  const visaExpiry = candidate.visit_visa_expiry_date ? new Date(candidate.visit_visa_expiry_date) : null;
  const daysToVisaExpiry = visaExpiry ? Math.ceil((visaExpiry - today) / 86400000) : null;
  const arrivalDate = candidate.date_of_arrival ? new Date(candidate.date_of_arrival) : null;
  const mustResolveBy = arrivalDate ? new Date(arrivalDate.getTime() + 30*86400000) : null;
  const daysToResolve = mustResolveBy ? Math.ceil((mustResolveBy - today) / 86400000) : null;
  const departDt = candidate.ticket_depart_datetime ? new Date(candidate.ticket_depart_datetime) : null;
  const daysToDeparture = departDt ? Math.ceil((departDt - today) / 86400000) : null;

  // Progress steps
  const steps = [
    { label: 'Visit Visa', done: !!candidate.visit_visa_url, icon: '🛂' },
    { label: 'Ticket', done: !!(candidate.ticket_depart_datetime || candidate.onward_ticket_url), icon: '✈️' },
    { label: 'D-Return', done: !!candidate.d_return_ticket_url, icon: '🎫' },
    { label: 'D-Hotel', done: !!candidate.d_hotel_booking_url, icon: '🏨' },
    { label: 'Arrived', done: !!candidate.date_of_arrival && new Date(candidate.date_of_arrival) <= today, icon: '🏁' },
  ];
  const doneCount = steps.filter(s=>s.done).length;

  return (
    <div style={{ padding:'12px 20px', background:'#f8fafc', borderTop:'2px solid var(--bd1)' }}>
      <div style={{ fontSize:'11px', fontWeight:800, color:'#0f2744', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}><EmojiIcon e="🚀" /> Transport & Onboarding Arrangement</div>

      {/* Progress bar */}
      <div style={{ marginBottom:'14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#64748b', marginBottom:'4px' }}>
          <span>Progress</span><span>{doneCount}/{steps.length} steps</span>
        </div>
        <div style={{ display:'flex', gap:'3px', marginBottom:'6px' }}>
          {steps.map((s,i) => <div key={i} style={{ flex:1, height:'5px', borderRadius:'3px', background: s.done?'#10b981':'#e2e8f0' }} />)}
        </div>
        <div style={{ display:'flex', gap:'3px' }}>
          {steps.map((s,i) => <div key={i} style={{ flex:1, textAlign:'center', fontSize:'9px', color: s.done?'#10b981':'#94a3b8', fontWeight: s.done?700:400 }}>{s.icon} {s.label}</div>)}
        </div>
      </div>

      {/* Alert banners */}
      {daysToVisaExpiry !== null && daysToVisaExpiry <= 14 && daysToVisaExpiry > 0 && !candidate.date_of_arrival && (
        <div style={{ background:'#fef3c7', border:'1px solid #fbbf24', borderRadius:'8px', padding:'8px 12px', marginBottom:'10px', fontSize:'12px', color:'#92400e', fontWeight:700 }}><EmojiIcon e="⚠️" /> Visa expires in {daysToVisaExpiry} days ({fmt(candidate.visit_visa_expiry_date)}) — candidate must travel!
        </div>
      )}
      {daysToResolve !== null && daysToResolve <= 8 && candidate.status !== 'Joined' && (
        <div style={{ background:'#fee2e2', border:'1px solid #ef4444', borderRadius:'8px', padding:'8px 12px', marginBottom:'10px', fontSize:'12px', color:'#7f1d1d', fontWeight:700 }}><EmojiIcon e="🚨" /> Visit visa expires in {daysToResolve} days! Complete residence visa OR book exit ticket by {fmt(mustResolveBy?.toISOString())}.
        </div>
      )}
      {daysToDeparture !== null && daysToDeparture <= 2 && daysToDeparture >= 0 && (
        <div style={{ background:'#ede9fe', border:'1px solid #8b5cf6', borderRadius:'8px', padding:'8px 12px', marginBottom:'10px', fontSize:'12px', color:'#4c1d95', fontWeight:700 }}><EmojiIcon e="🚗" /> Airport pickup {daysToDeparture===0?'TODAY':'in '+daysToDeparture+' day(s)'}! Flight {candidate.ticket_flight_no} arrives {candidate.ticket_to_airport}{candidate.ticket_to_terminal?' T/'+candidate.ticket_to_terminal:''} at {fmtDt(candidate.ticket_arrive_datetime)}
        </div>
      )}

      {/* 2x2 grid: Visa | Ticket | D-Return | D-Hotel */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>

        {/* Visit Visa */}
        <div style={{ border:'1.5px solid', borderColor: candidate.visit_visa_url?'#10b981':'#e2e8f0', borderRadius:'9px', padding:'10px', background: candidate.visit_visa_url?'#f0fdf4':'#fff' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:'#1e293b', marginBottom:'6px', display:'flex', alignItems:'center', gap:'4px' }}><EmojiIcon e="🛂" /> Visit Visa {candidate.visit_visa_url && <span style={{ background:'#10b981', color:'#fff', borderRadius:'20px', padding:'1px 6px', fontSize:'9px' }}><EmojiIcon e="✓" /></span>}
          </div>
          {candidate.visit_visa_url ? (
            <div style={{ fontSize:'11px' }}>
              <div style={{ marginBottom:'2px' }}><EmojiIcon e="📅" /> Issue:<b>{fmt(candidate.visit_visa_issue_date)}</b></div>
              <div style={{ marginBottom:'2px', color: daysToVisaExpiry!==null&&daysToVisaExpiry<=14?'#ef4444':'#374151' }}><EmojiIcon e="📅" /> Expiry:<b>{fmt(candidate.visit_visa_expiry_date)}{daysToVisaExpiry!==null?' ('+daysToVisaExpiry+'d)':''}</b></div>
              <div style={{ marginBottom:'6px', fontSize:'10px', color:'#6b7280' }}>#{candidate.visit_visa_permit_no||'—'}</div>
              <a href={candidate.visit_visa_url} target="_blank" style={{ fontSize:'10px', color:'#3b82f6' }}><EmojiIcon e="📄" /> View</a>
              <span style={{ color:'#cbd5e1', margin:'0 4px' }}>|</span>
              <label style={{ fontSize:'10px', color:'#6b7280', cursor:'pointer' }}><EmojiIcon e="🔄" /> Replace<input type="file" accept=".pdf,image/*" onChange={handleVisaUpload} style={{ display:'none' }} /></label>
            </div>
          ) : (
            <label style={{ display:'flex', alignItems:'center', gap:'4px', background: loading.visa?'#e2e8f0':'#2563eb', color:'#fff', borderRadius:'6px', padding:'5px 10px', cursor: loading.visa?'default':'pointer', fontSize:'11px', fontWeight:600, justifyContent:'center' }}>
              <EmojiLabel text={loading.visa?'🤖 Extracting...':'⬆️ Upload Visa'} />
              <input type="file" accept=".pdf,image/*" onChange={handleVisaUpload} style={{ display:'none' }} disabled={loading.visa} />
            </label>
          )}
        </div>

        {/* Onward Ticket — uploadable here with AI extraction */}
        <div style={{ border:'1.5px solid', borderColor: (candidate.ticket_depart_datetime||candidate.onward_ticket_url)?'#10b981':'#e2e8f0', borderRadius:'9px', padding:'10px', background: (candidate.ticket_depart_datetime||candidate.onward_ticket_url)?'#f0fdf4':'#fff' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:'#1e293b', marginBottom:'6px', display:'flex', alignItems:'center', gap:'4px' }}><EmojiIcon e="✈️" /> Onward Ticket {(candidate.ticket_depart_datetime||candidate.onward_ticket_url) && <span style={{ background:'#10b981', color:'#fff', borderRadius:'20px', padding:'1px 6px', fontSize:'9px' }}><EmojiIcon e="✓" /></span>}
          </div>
          {candidate.ticket_depart_datetime ? (
            <div style={{ fontSize:'11px' }}>
              <div style={{ background:'#1e293b', color:'#fff', borderRadius:'6px', padding:'6px 8px', marginBottom:'4px' }}>
                <div style={{ fontWeight:700 }}>{candidate.ticket_flight_no||'—'} · {candidate.ticket_pnr||'—'}</div>
                <div style={{ fontSize:'10px', color:'#94a3b8' }}>{candidate.ticket_from_airport||'?'} → {candidate.ticket_to_airport||'?'}</div>
                <div style={{ fontSize:'10px' }}>{fmtDt(candidate.ticket_depart_datetime)}</div>
              </div>
              {daysToDeparture !== null && <div style={{ fontSize:'10px', color: daysToDeparture<=2?'#ef4444':'#059669', fontWeight:600 }}>{daysToDeparture<0?'✅ Traveled':daysToDeparture===0?'🚨 TODAY':'⏰ '+daysToDeparture+'d to departure'}</div>}
              {candidate.onward_ticket_url && <><a href={candidate.onward_ticket_url} target="_blank" style={{ fontSize:'10px', color:'#3b82f6' }}><EmojiIcon e="📄" /> View</a><span style={{ color:'#cbd5e1', margin:'0 4px' }}>|</span></>}
              <label style={{ fontSize:'10px', color:'#6b7280', cursor:'pointer' }}><EmojiIcon e="🔄" /> Replace<input type="file" accept=".pdf,image/*" onChange={handleTicketUpload} style={{ display:'none' }} disabled={loading.ticket} /></label>
              <span style={{ color:'#cbd5e1', margin:'0 4px' }}>|</span>
              <span style={{ fontSize:'10px', color:'#f59e0b', cursor:'pointer', fontWeight:600 }} onClick={openFixTime}><EmojiIcon e="✏️" /> Fix Time</span>
              {fixingTime && (
                <div style={{ marginTop:'8px', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'6px', padding:'8px', fontSize:'11px' }}>
                  <div style={{ fontWeight:700, marginBottom:'6px', color:'#92400e' }}><EmojiIcon e="✏️" /> Correct Ticket Times (UAE / Abu Dhabi time)</div>
                  <div style={{ marginBottom:'4px' }}>
                    <label style={{ fontSize:'10px', color:'#6b7280', display:'block', marginBottom:'2px' }}><EmojiIcon e="🛫" /> Departure (local time at origin)</label>
                    <input type="datetime-local" value={fixDepartVal} onChange={e=>setFixDepartVal(e.target.value)}
                      style={{ width:'100%', fontSize:'11px', padding:'3px 5px', border:'1px solid #fcd34d', borderRadius:'4px' }} />
                  </div>
                  <div style={{ marginBottom:'6px' }}>
                    <label style={{ fontSize:'10px', color:'#6b7280', display:'block', marginBottom:'2px' }}><EmojiIcon e="🛬" /> Arrival Abu Dhabi (UAE time — used for driver pickup)</label>
                    <input type="datetime-local" value={fixArriveVal} onChange={e=>setFixArriveVal(e.target.value)}
                      style={{ width:'100%', fontSize:'11px', padding:'3px 5px', border:'1px solid #fcd34d', borderRadius:'4px' }} />
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={saveFixedTimes} style={{ background:'#f59e0b', color:'#fff', border:'none', borderRadius:'4px', padding:'4px 10px', fontSize:'13px', cursor:'pointer', fontWeight:700 }}>Save Corrected Times</button>
                    <button onClick={()=>setFixingTime(false)} style={{ background:'#e2e8f0', color:'#374151', border:'none', borderRadius:'4px', padding:'4px 8px', fontSize:'13px', cursor:'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : candidate.onward_ticket_url ? (
            <div style={{ fontSize:'11px' }}>
              <div style={{ color:'#059669', marginBottom:'4px' }}>Ticket uploaded</div>
              <a href={candidate.onward_ticket_url} target="_blank" style={{ fontSize:'10px', color:'#3b82f6' }}><EmojiIcon e="📄" /> View</a>
              <span style={{ color:'#cbd5e1', margin:'0 4px' }}>|</span>
              <label style={{ fontSize:'10px', color:'#6b7280', cursor:'pointer' }}><EmojiIcon e="🔄" /> Replace<input type="file" accept=".pdf,image/*" onChange={handleTicketUpload} style={{ display:'none' }} disabled={loading.ticket} /></label>
            </div>
          ) : (
            <label style={{ display:'flex', alignItems:'center', gap:'4px', background: loading.ticket?'#e2e8f0':'#0ea5e9', color:'#fff', borderRadius:'6px', padding:'5px 10px', cursor: loading.ticket?'default':'pointer', fontSize:'11px', fontWeight:600, justifyContent:'center' }}>
              <EmojiLabel text={loading.ticket?'🤖 Extracting...':'⬆️ Upload Ticket'} />
              <input type="file" accept=".pdf,image/*" onChange={handleTicketUpload} style={{ display:'none' }} disabled={loading.ticket} />
            </label>
          )}
        </div>

        {/* D-Return Ticket */}
        <div style={{ border:'1.5px solid', borderColor: candidate.d_return_ticket_url?'#10b981':'#e2e8f0', borderRadius:'9px', padding:'10px', background: candidate.d_return_ticket_url?'#f0fdf4':'#fff' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:'#1e293b', marginBottom:'6px', display:'flex', alignItems:'center', gap:'4px' }}><EmojiIcon e="🎫" /> D-Return Ticket {candidate.d_return_ticket_url && <span style={{ background:'#10b981', color:'#fff', borderRadius:'20px', padding:'1px 6px', fontSize:'9px' }}><EmojiIcon e="✓" /> Sent</span>}
            <span style={{ fontSize:'9px', color:'#6b7280', fontWeight:400 }}>(SATCO sends)</span>
          </div>
          {candidate.d_return_ticket_url ? (
            <div style={{ fontSize:'11px' }}>
              <div style={{ color:'#059669', marginBottom:'4px' }}><EmojiIcon e="✅" /> Sent {fmt(candidate.d_return_ticket_sent_date)}</div>
              <a href={candidate.d_return_ticket_url} target="_blank" style={{ fontSize:'10px', color:'#3b82f6' }}><EmojiIcon e="📄" /> View</a>
              <span style={{ color:'#cbd5e1', margin:'0 4px' }}>|</span>
              <label style={{ fontSize:'10px', color:'#6b7280', cursor:'pointer' }}><EmojiIcon e="🔄" /> Replace<input type="file" accept=".pdf,.docx" onChange={handleReturnUpload} style={{ display:'none' }} /></label>
            </div>
          ) : (
            <label style={{ display:'flex', alignItems:'center', gap:'4px', background: loading.return?'#e2e8f0':'#7c3aed', color:'#fff', borderRadius:'6px', padding:'5px 10px', cursor: loading.return?'default':'pointer', fontSize:'11px', fontWeight:600, justifyContent:'center' }}>
              <EmojiLabel text={loading.return?'Uploading...':'⬆️ Upload D-Return'} />
              <input type="file" accept=".pdf,.docx" onChange={handleReturnUpload} style={{ display:'none' }} disabled={loading.return} />
            </label>
          )}
        </div>

        {/* D-Hotel Booking */}
        <div style={{ border:'1.5px solid', borderColor: candidate.d_hotel_booking_url?'#10b981':'#e2e8f0', borderRadius:'9px', padding:'10px', background: candidate.d_hotel_booking_url?'#f0fdf4':'#fff' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:'#1e293b', marginBottom:'6px', display:'flex', alignItems:'center', gap:'4px' }}><EmojiIcon e="🏨" /> D-Hotel Booking {candidate.d_hotel_booking_url && <span style={{ background:'#10b981', color:'#fff', borderRadius:'20px', padding:'1px 6px', fontSize:'9px' }}><EmojiIcon e="✓" /> Sent</span>}
            <span style={{ fontSize:'9px', color:'#6b7280', fontWeight:400 }}>(SATCO sends)</span>
          </div>
          {candidate.d_hotel_booking_url ? (
            <div style={{ fontSize:'11px' }}>
              <div style={{ color:'#059669', marginBottom:'4px' }}><EmojiIcon e="✅" /> Sent {fmt(candidate.d_hotel_booking_sent_date)}</div>
              <a href={candidate.d_hotel_booking_url} target="_blank" style={{ fontSize:'10px', color:'#3b82f6' }}><EmojiIcon e="📄" /> View</a>
              <span style={{ color:'#cbd5e1', margin:'0 4px' }}>|</span>
              <label style={{ fontSize:'10px', color:'#6b7280', cursor:'pointer' }}><EmojiIcon e="🔄" /> Replace<input type="file" accept=".pdf,.docx" onChange={handleHotelUpload} style={{ display:'none' }} /></label>
            </div>
          ) : (
            <label style={{ display:'flex', alignItems:'center', gap:'4px', background: loading.hotel?'#e2e8f0':'#7c3aed', color:'#fff', borderRadius:'6px', padding:'5px 10px', cursor: loading.hotel?'default':'pointer', fontSize:'11px', fontWeight:600, justifyContent:'center' }}>
              <EmojiLabel text={loading.hotel?'Uploading...':'⬆️ Upload D-Hotel'} />
              <input type="file" accept=".pdf,.docx" onChange={handleHotelUpload} style={{ display:'none' }} disabled={loading.hotel} />
            </label>
          )}
        </div>
      </div>

      {/* Arrival section */}
      <div style={{ border:'1.5px solid', borderColor: candidate.date_of_arrival?'#6366f1':'#e2e8f0', borderRadius:'9px', padding:'10px', background: candidate.date_of_arrival?'#eef2ff':'#fff' }}>
        <div style={{ fontSize:'11px', fontWeight:700, color:'#1e293b', marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span><EmojiIcon e="🏁" /> Arrival & Visa Timeline</span>
          {candidate.date_of_arrival && (
            <span style={{ fontSize:'9px', background: candidate.arrival_manually_set?'#e0e7ff':'#d1fae5', color: candidate.arrival_manually_set?'#3730a3':'#065f46', padding:'1px 6px', borderRadius:'10px' }}>
              {candidate.arrival_manually_set?'Manually set':'From ticket'}
            </span>
          )}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'11px' }}>
          <div>
            <div style={{ color:'#6b7280', marginBottom:'3px' }}>Date of Arrival (UAE)</div>
            {editArrival || !candidate.date_of_arrival ? (
              <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                <input type="date" value={arrivalInput} onChange={e=>setArrivalInput(e.target.value)}
                  style={{ border:'1px solid #d1d5db', borderRadius:'5px', padding:'3px 6px', fontSize:'11px', flex:1 }} />
                <button onClick={saveArrival} style={{ background:'#6366f1', color:'#fff', border:'none', borderRadius:'5px', padding:'3px 8px', cursor:'pointer', fontSize:'13px' }}>Save</button>
                {editArrival && <button onClick={()=>setEditArrival(false)} style={{ background:'#e2e8f0', border:'none', borderRadius:'5px', padding:'3px 6px', cursor:'pointer', fontSize:'11px' }}></button>}
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <b style={{ fontSize:'12px' }}>{fmt(candidate.date_of_arrival)}</b>
                <button onClick={()=>setEditArrival(true)} style={{ background:'none', border:'1px solid #d1d5db', borderRadius:'4px', padding:'1px 6px', cursor:'pointer', fontSize:'10px', color:'#6b7280' }}></button>
              </div>
            )}
          </div>
          {candidate.date_of_arrival && (
            <div>
              <div style={{ color:'#6b7280', marginBottom:'3px' }}>Must resolve by (day 30)</div>
              <b style={{ fontSize:'12px', color: daysToResolve!==null&&daysToResolve<=8?'#ef4444':'#374151' }}>
                {fmt(mustResolveBy?.toISOString())}
                {daysToResolve!==null && <span style={{ fontSize:'10px', fontWeight:400, color:'#6b7280' }}> ({daysToResolve>0?daysToResolve+'d left':'OVERDUE'})</span>}
              </b>
            </div>
          )}
        </div>
        {/* Timeline */}
        {candidate.date_of_arrival && (
          <div style={{ display:'flex', alignItems:'center', marginTop:'10px', gap:'0' }}>
            {[{label:'Arrived',day:0,color:'#10b981',done:true},{label:'Day 22 Alert',day:22,color:'#f59e0b',done:daysToResolve!==null&&daysToResolve<=8},{label:'Deadline',day:30,color:'#ef4444',done:daysToResolve!==null&&daysToResolve<=0}].map((item,i)=>(
              <React.Fragment key={i}>
                {i>0&&<div style={{ flex:1, height:'2px', background:'#e2e8f0' }}/>}
                <div style={{ textAlign:'center' }}>
                  <div style={{ width:'26px', height:'26px', borderRadius:'50%', background: item.done?item.color:'#e2e8f0', color: item.done?'#fff':'#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:700, margin:'0 auto 3px' }}>D{item.day}</div>
                  <div style={{ fontSize:'9px', color:'#6b7280', whiteSpace:'nowrap' }}>{item.label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// ── END TransportArrangementPanel ─────────────────────────────────────────


    const HiringView = React.memo(function HiringView({ records, crossRecords, onAdd, onEdit, onDelete, onSaveDoc, onStartVisaProcessing, onMoveLocation, showToast, onOpenSheet }) {
      // ── Updated Resume detector — finds if a candidate in crossRecords (Resume DB)
      // has the same email/phone/passport as someone in records (Hiring Pipeline)
      const findUpdatedResume = (c) => {
        if (!crossRecords || crossRecords.length === 0) return null;
        const email    = (c.email||'').toLowerCase();
        const phone    = (c.phone||'').replace(/\D/g,'');
        const passport = (c.passport_no||'').toUpperCase();
        return (crossRecords || []).find(r => {
          if (email    && r.email      && r.email.toLowerCase()    === email)    return true;
          if (phone    && r.phone      && r.phone.replace(/\D/g,'') === phone)   return true;
          if (passport && r.passport_no && r.passport_no.toUpperCase() === passport) return true;
          return false;
        }) || null;
      };
      const [search, setSearch] = useState('');
      const [statusFilter, setStatusFilter] = useState('all');
      const [stepFilter, setStepFilter] = useState('all');
      const [viewMode, setViewMode] = useState('simple'); // 'simple' | 'pipeline' | 'table'
      const [viewCandidate, setViewCandidate] = useState(null); // candidate record to show in detail popup
      const [cvViewer, setCvViewer] = useState(null); // { base64, cvPath, fileName }
      const [stageUpload, setStageUpload] = useState(null); // { candidate, step }
      const [kpiOpen, setKpiOpen] = useState(null); // which KPI card's row-list is expanded inline
      const [sopChart, setSopChart] = useState(null); // { key, startIndex } — which SOP_GUIDES entry is open
      const today = new Date(); today.setHours(0,0,0,0);

      // Alert check: step_due_date overdue
      const overdue = records.filter(r => {
        if (!r.step_due_date || r.status === 'Joined' || r.status === 'Withdrawn') return false;
        const d = new Date(r.step_due_date); d.setHours(0,0,0,0);
        return d < today;
      });

      // resolveStep is at module scope

      const filtered = useMemo(() => {
        let r = records;
        if (search) { const s = search.toLowerCase(); r = r.filter(c => ['candidate_name','position','passport_no','referred_by','current_location','status'].some(k => String(c[k]||'').toLowerCase().includes(s))); }
        if (statusFilter !== 'all') r = r.filter(c => c.status === statusFilter);
        if (stepFilter !== 'all') {
          const visaSteps = VISA_PROCESSING_STEP_IDS;
          if (stepFilter === 'interview_conducted') r = r.filter(c => { const s=resolveStep(c); return !['resume'].includes(s); });
          else if (stepFilter === 'no_interview') r = r.filter(c => resolveStep(c) === 'resume');
          else if (stepFilter === 'offer_sent') r = r.filter(c => ['offer_sent','offer_signed'].includes(resolveStep(c)));
          else if (stepFilter === 'visa_processing') r = r.filter(c => visaSteps.includes(resolveStep(c)));
          else if (stepFilter === 'S1') r = r.filter(c => c.hiring_scenario === 'S1');
          else if (stepFilter === 'S2') r = r.filter(c => c.hiring_scenario === 'S2');
          else if (stepFilter === 'S3') r = r.filter(c => c.hiring_scenario === 'S3');
          else r = r.filter(c => resolveStep(c) === stepFilter);
        }
        return r;
      }, [records, search, statusFilter, stepFilter]);

      // Group by EFFECTIVE step for pipeline view
      const byStep = useMemo(() => {
        const m = {};
        HIRING_STEPS.forEach(s => { m[s.id] = []; });
        filtered.forEach(r => {
          const eff = resolveStep(r);
          if (m[eff]) m[eff].push(r); else m['resume'].push(r);
        });
        return m;
      }, [filtered]);

      const statuses = [...new Set(records.map(r => r.status).filter(Boolean))];

      return (
        <>
        <div>
          {/* Overdue Alert Banner */}
          {overdue.length > 0 && (
            <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'12px 18px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'20px' }}></span>
              <div>
                <div style={{ fontWeight:700, color:'#991b1b', fontSize:'13.5px' }}>{overdue.length} candidate{overdue.length>1?'s':''} overdue for follow-up</div>
                <div style={{ fontSize:'12px', color:'#b91c1c', marginTop:'2px' }}>{overdue.map(r => r.candidate_name).join(', ')}</div>
              </div>
            </div>
          )}

          {/* KPI Row — click a card to expand the matching candidates as rows right below */}
          <div className="hiring-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:'10px', marginBottom:'10px' }}>
            {[
              { key:'total',   label:'Total Active',      value: records.filter(r=>r.status!=='Joined'&&r.status!=='Withdrawn').length, icon:'👥', color:'#2563eb', sub:'in pipeline',
                rows: records.filter(r=>r.status!=='Joined'&&r.status!=='Withdrawn') },
              { key:'awaiting',label:'Awaiting Interview',value: records.filter(r=>resolveStep(r)==='resume').length,                    icon:'📄', color:'#6366f1', sub:'resume received',
                rows: records.filter(r=>resolveStep(r)==='resume') },
              { key:'offer',   label:'Offer Stage',       value: records.filter(r=>['offer_sent','offer_signed'].includes(resolveStep(r))).length, icon:'📧', color:'#0891b2', sub:'sent or signed',
                rows: records.filter(r=>['offer_sent','offer_signed'].includes(resolveStep(r))) },
              { key:'visa',    label:'Visa Processing',   value: records.filter(r=>VISA_PROCESSING_STEP_IDS.includes(resolveStep(r))).length, icon:'🛂', color:'#ca8a04', sub:'in progress',
                rows: records.filter(r=>VISA_PROCESSING_STEP_IDS.includes(resolveStep(r))) },
              { key:'joined',  label:'Joined',            value: records.filter(r=>r.status==='Joined').length,                          icon:'🏢', color:'#059669', sub:'on board',
                rows: records.filter(r=>r.status==='Joined') },
              { key:'overdue', label:'Overdue Steps',     value: overdue.length,                                                          icon:'⏰', color:'#dc2626', sub: overdue.length>0 ? overdue.map(r=>r.candidate_name.split(' ')[0]).join(', ') : 'all on track',
                rows: overdue },
            ].map(k => {
              const isOpen = kpiOpen === k.key;
              return (
              <div key={k.key} className="hr-card" onClick={()=>setKpiOpen(o=>o===k.key?null:k.key)} style={{ background:'#fff', border: isOpen?`1.5px solid ${k.color}`:'1px solid #e2e8f0', borderLeft:`3px solid ${k.color}`, borderRadius:'10px', padding:'10px 8px', cursor:'pointer', position:'relative', overflow:'hidden', boxShadow: isOpen?`0 0 0 3px ${k.color}1a`:undefined }}>
                <div style={{ position:'absolute', top:'10px', right:'12px', fontSize:'22px', opacity:0.12 }}>{k.icon}</div>
                <div style={{ fontSize:'10px', color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'5px', lineHeight:1.3 }}>{k.label}</div>
                <div style={{ fontSize:'28px', fontWeight:800, color: k.value>0&&k.key==='overdue'?'#dc2626':k.color, lineHeight:1, marginBottom:'4px' }}>{k.value}</div>
                <div style={{ fontSize:'10px', color:'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{k.sub}</div>
              </div>
            );})}
          </div>

          {/* KPI expand — candidates for the clicked card, as simple rows */}
          {kpiOpen && (() => {
            const kpis = {
              total:   { label:'Total Active',       rows: records.filter(r=>r.status!=='Joined'&&r.status!=='Withdrawn') },
              awaiting:{ label:'Awaiting Interview',  rows: records.filter(r=>resolveStep(r)==='resume') },
              offer:   { label:'Offer Stage',         rows: records.filter(r=>['offer_sent','offer_signed'].includes(resolveStep(r))) },
              visa:    { label:'Visa Processing',     rows: records.filter(r=>VISA_PROCESSING_STEP_IDS.includes(resolveStep(r))) },
              joined:  { label:'Joined',              rows: records.filter(r=>r.status==='Joined') },
              overdue: { label:'Overdue Steps',       rows: overdue },
            };
            const k = kpis[kpiOpen];
            return (
              <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'10px 12px', marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'#334155' }}>{k.label} — {k.rows.length} candidate{k.rows.length!==1?'s':''}</span>
                  <button onClick={()=>setKpiOpen(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'15px' }}>Close</button>
                </div>
                {k.rows.length === 0 ? (
                  <div style={{ color:'#94a3b8', fontSize:'12px', padding:'6px 2px' }}>No candidates in this group.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    {k.rows.map(c => {
                      const st = HIRING_STEPS.find(s=>s.id===resolveStep(c));
                      return (
                        <div key={c.id} onClick={()=>onEdit(c)} className="hr-row" style={{ display:'flex', alignItems:'center', gap:'12px', background:'#fff', border:'1px solid var(--bd1)', borderRadius:'8px', padding:'8px 12px', cursor:'pointer' }}>
                          <span style={{ fontWeight:700, fontSize:'12.5px', color:'#1e40af', minWidth:'160px' }}>{c.candidate_name||'(no name)'}</span>
                          <span style={{ fontSize:'11.5px', color:'#475569', minWidth:'140px' }}>{c.position_selected||c.position||'—'}</span>
                          <span style={{ fontSize:'10.5px', color:'#64748b', background:'#f1f5f9', padding:'1px 7px', borderRadius:'6px' }}>{c.nationality||'—'}</span>
                          {st && <span style={{ fontSize:'10.5px', color: st.color, background: st.color+'18', padding:'1px 7px', borderRadius:'6px', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}>{st.label}</span>}
                          {c.step_due_date && (() => { const d = daysUntil(c.step_due_date); return d!==null && d<0
                            ? <span style={{ fontSize:'10.5px', color:'#dc2626', background:'#fee2e2', padding:'1px 7px', borderRadius:'6px', fontWeight:700 }}>{Math.abs(d)}d overdue</span>
                            : <span style={{ fontSize:'10.5px', color:'#94a3b8' }}>Due {fmtDateDisplay(c.step_due_date)}</span>; })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Toolbar — search, combined status/stage filter, view switcher, add */}
          <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name, position, passport, location…" style={{ ...S.input, flex:1, minWidth:'240px', maxWidth:'380px' }} />
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={S.input}>
              <option value="all">Status: All</option>
              {statuses.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select value={stepFilter} onChange={e=>setStepFilter(e.target.value)} style={{ ...S.input, minWidth:'190px' }}>
              <option value="all">Stage: All</option>
              <optgroup label="By progress">
                <option value="no_interview">📄 Resume Only ({records.filter(r=>resolveStep(r)==='resume').length})</option>
                <option value="interview_conducted">🎙️ Interviewed ({records.filter(r=>resolveStep(r)!=='resume').length})</option>
                <option value="offer_sent">📧 Offer Stage ({records.filter(r=>['offer_sent','offer_signed'].includes(resolveStep(r))).length})</option>
                <option value="visa_processing">🛂 Visa Processing ({records.filter(r=>VISA_PROCESSING_STEP_IDS.includes(resolveStep(r))).length})</option>
                <option value="joined">🏢 Joined ({records.filter(r=>resolveStep(r)==='joined').length})</option>
              </optgroup>
              <optgroup label="By scenario">
                <option value="S1">🛂 S1 Visit Visa ({records.filter(r=>r.hiring_scenario==='S1').length})</option>
                <option value="S2">✈️ S2 Entry Permit ({records.filter(r=>r.hiring_scenario==='S2').length})</option>
                <option value="S3">🇦🇪 S3 Transfer ({records.filter(r=>r.hiring_scenario==='S3').length})</option>
              </optgroup>
            </select>
            <div style={{ display:'flex', border:'1px solid var(--bd2)', borderRadius:'8px', overflow:'hidden' }}>
              {[['simple','📋 Simple'],['pipeline','🗂 Pipeline'],['table','📊 Table']].map(([k,l])=>(
                <button key={k} onClick={()=>setViewMode(k)} style={{ background:viewMode===k?'#2563eb':'#fff', color:viewMode===k?'#fff':'#475569', border:'none', padding:'7px 14px', fontSize:'12.5px', fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}><EmojiLabel text={l} size={13} gap={6} /></button>
              ))}
            </div>
            <button className="hr-btn" style={S.btnPri} onClick={onAdd}>+ New Candidate</button>
          </div>

          {/* Simple View — flat, ordered list grouped by stage; easiest for first-time users */}
          {viewMode === 'simple' && (() => {
            const SIMPLE_GROUPS = [
              { id:'resume',  label:'1 · New Resumes',         color:'#059669', match: c => resolveStep(c)==='resume' },
              { id:'interview', label:'2 · Interview Stage',  color:'#059669', match: c => resolveStep(c)==='interview' },
              { id:'offer',   label:'3 · Offer Stage',         color:'#059669', match: c => ['offer_sent','offer_signed'].includes(resolveStep(c)) },
              { id:'visa',    label:'4 · Visa & Onboarding',   color:'#059669', match: c => VISA_PROCESSING_STEP_IDS.includes(resolveStep(c)) },
              { id:'joined',  label:'5 · Joined',              color:'#059669', match: c => resolveStep(c)==='joined' },
            ];
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {SIMPLE_GROUPS.map(g => {
                  const rows = filtered.filter(g.match);
                  return (
                    <div key={g.id} style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', overflow:'hidden' }}>
                      <div style={{ background:g.color+'12', borderBottom:`1px solid ${g.color}30`, padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:'12.5px', fontWeight:800, color:g.color }}>{g.label}</span>
                        <span style={{ background:g.color, color:'#fff', borderRadius:'12px', padding:'1px 10px', fontSize:'11px', fontWeight:700 }}>{rows.length}</span>
                      </div>
                      {rows.length === 0 ? (
                        <div style={{ padding:'14px', color:'#cbd5e1', fontSize:'12px' }}>No candidates here.</div>
                      ) : (
                        <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:'4px' }}>
                          {rows.map(c => {
                            const due = c.step_due_date ? daysUntil(c.step_due_date) : null;
                            const isOverdue = due !== null && due < 0;
                            const scInfo = getScenario(c);
                            const updatedEntry = findUpdatedResume(c);
                            return (
                              <div key={c.id} style={{ marginBottom:'2px' }}>
                                {updatedEntry && (
                                  <div style={{ background:'linear-gradient(90deg,#fef3c7,#fde68a)', borderRadius:'6px 6px 0 0', padding:'3px 12px', display:'flex', alignItems:'center', gap:'8px', fontSize:'11px', fontWeight:700, color:'#92400e', borderBottom:'1px solid #fcd34d' }}>
                                    <span>Updated Resume Alert</span>
                                    <span style={{ fontWeight:400 }}>— This candidate also has a record in the Resume Database (added {updatedEntry.created_at ? new Date(updatedEntry.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}). Review and delete the older record.</span>
                                    <button onClick={(e)=>{ e.stopPropagation(); if(window.confirm(`Delete the older Resume Database record for ${c.candidate_name}?\nThis keeps the Hiring Pipeline record and removes the Resume DB duplicate.`)){ onDelete(updatedEntry.id); showToast(`🗑️ Old Resume DB record removed`); } }}
                                      style={{ marginLeft:'auto', background:'#dc2626', color:'#fff', border:'none', borderRadius:'4px', padding:'2px 8px', fontSize:'10px', fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                                      Delete Old
                                    </button>
                                  </div>
                                )}
                                <div onClick={()=>onEdit(c)} className="hr-row" title="Click to open"
                                  style={{ display:'flex', alignItems:'center', gap:'10px', background: isOverdue?'#fff7f7':'#fff', border:`1px solid ${updatedEntry?'#fcd34d':isOverdue?'#fca5a5':'#f1f5f9'}`, borderRadius: updatedEntry?'0 0 8px 8px':'8px', padding:'8px 12px', cursor:'pointer', margin:0 }}>
                                  <span style={{ fontWeight:700, fontSize:'12.5px', color:'#1e40af', minWidth:'170px' }}>{c.candidate_name||'(no name)'}</span>
                                  <span style={{ fontSize:'11.5px', color:'#475569', minWidth:'150px' }}>{c.position_selected||c.position||'—'}</span>
                                  <span style={{ fontSize:'10.5px', color:'#64748b', background:'#f1f5f9', padding:'1px 7px', borderRadius:'6px' }}>{c.nationality||'—'}</span>
                                  {scInfo && <span style={{ fontSize:'10.5px', color:scInfo.color, background:scInfo.color+'18', padding:'1px 7px', borderRadius:'6px', fontWeight:600 }}>{scInfo.icon} {scInfo.shortLabel}</span>}
                                  <span style={{ flex:1 }} />
                                  {/* Current status — computed from the Visa Steps tracker, replaces the old Edit/Delete buttons */}
                                  {(() => {
                                    const prog = getVisaStepsProgress(c);
                                    if (!prog) return c.step_due_date ? <span style={{ fontSize:'10.5px', color:'#94a3b8' }}>Due {fmtDateDisplay(c.step_due_date)}</span> : null;
                                    return (
                                      <span style={{ fontSize:'10.5px', color:'#166534', background:'#f0fdf4', border:'1px solid #bbf7d0', padding:'2px 9px', borderRadius:'6px', fontWeight:700, whiteSpace:'nowrap' }}>
                                        {prog.currentLabel} · {prog.done}/{prog.total} · {prog.pct}%
                                      </span>
                                    );
                                  })()}
                                  <button onClick={async (e)=>{ e.stopPropagation(); try { await onMoveLocation(c.id, 'resume_db'); showToast(`${c.candidate_name||'Candidate'} moved to Resume Database`); } catch(err) { showToast('❌ Move failed: ' + err.message, 'error'); } }}
                                    title="Move to Resume Database" style={{ background:'#fff', border:'1px solid #cbd5e1', color:'#475569', borderRadius:'6px', padding:'3px 8px', fontSize:'10.5px', fontWeight:700, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                                    🗄️ Resume DB
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Pipeline Board — Row-based: step on left, candidate cards on right ── */}

          {viewMode === 'pipeline' && (() => {
            // Date field for each step — shows the relevant event date on the card
            const STEP_DATE_MAP = {
              resume:       'created_at',
              interview:    'interview_date',
              offer_sent:   'offer_letter_date',
              offer_signed: 'offer_accepted_date',
              visa_arranged:'visa_arranged_date',
              entry_permit: 'entry_permit_date',
              travel:       'arrival_date',
              work_permit:  'work_permit_date',
              status_change:'status_change_date',
              medical:      'medical_fitness_date',
              eid:          'eid_biometric_date',
              visa_stamped: 'visa_stamped_in_passport_date',
              visa_cancel:  'visa_cancel_date',
              joined:       'available_from',
            };

            // Compact candidate card (wide, single line)
            const CandCard = ({ c, step }) => {
              const due = c.step_due_date ? daysUntil(c.step_due_date) : null;
              const isOverdue = due !== null && due < 0;
              const dateField = STEP_DATE_MAP[step.id];
              const eventDate = dateField && c[dateField] ? fmtDateDisplay(c[dateField]) : (c.step_due_date ? ('Due: ' + fmtDateDisplay(c.step_due_date)) : null);
              const scenarioSteps = getScenarioSteps(c.hiring_scenario);
              const curIdx = scenarioSteps.findIndex(s => s.id === step.id);
              const nextStep = curIdx >= 0 && curIdx < scenarioSteps.length - 1 ? scenarioSteps[curIdx + 1] : null;
              const moveNext = async (e) => {
                e.stopPropagation();
                if (!nextStep) return;
                try {
                  if (nextStep.id === 'visa_processing') {
                    const tempId = await onStartVisaProcessing(c);
                    showToast(`Moved to ${nextStep.label}` + (tempId ? ` · Temp ID ${tempId} assigned` : ''));
                  } else {
                    await onSaveDoc(c.id, { manual_stage: nextStep.id });
                    showToast(`Moved to ${nextStep.label}`);
                  }
                }
                catch (err) { showToast('❌ Move failed: ' + err.message, 'error'); }
              };
              return (
                <div onClick={() => onEdit(c)}
                  style={{ background:'#fff', border:`1.5px solid ${isOverdue?'#fca5a5':step.color+'40'}`, borderRadius:'8px',
                    padding:'7px 10px', cursor:'pointer', minWidth:'170px', maxWidth:'210px',
                    boxShadow: isOverdue ? '0 0 0 2px #fee2e2' : `0 1px 4px ${step.color}18`,
                    transition:'box-shadow 0.15s, transform 0.12s' }}>
                  <div style={{ fontWeight:700, fontSize:'12px', color:'#1e40af', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.candidate_name||'(no name)'}</div>
                  <div style={{ fontSize:'10.5px', color:'#475569', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:'1px' }}>
                    {c.position_selected||c.position||'—'}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'4px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'9.5px', color:'#64748b', background:'#f1f5f9', padding:'1px 5px', borderRadius:'5px', whiteSpace:'nowrap' }}>{c.nationality||'—'}</span>
                    {eventDate && <span style={{ fontSize:'9.5px', color: isOverdue?'#dc2626':'#0891b2', background: isOverdue?'#fee2e2':'#eff6ff', padding:'1px 5px', borderRadius:'5px', fontWeight:600, whiteSpace:'nowrap' }}>{isOverdue ? `⚠ ${Math.abs(due)}d overdue` : eventDate}</span>}
                    {c.is_supplier_hire==='yes' && <span style={{ fontSize:'9px', color:'#7c3aed', background:'#ede9fe', padding:'1px 5px', borderRadius:'5px', fontWeight:700 }}>Supplier</span>}
                    {c.hiring_scenario && (() => { const sc = HIRING_SCENARIOS.find(s=>s.id===c.hiring_scenario); return sc ? <span style={{ fontSize:'9px', color:sc.color, background:sc.color+'18', padding:'1px 5px', borderRadius:'5px', fontWeight:700, whiteSpace:'nowrap' }}>{sc.icon} {sc.shortLabel}</span> : null; })()}
                    {/* Airport pickup alert badge */}
                    {c.ticket_depart_datetime && (() => {
                      const daysUntil = Math.ceil((new Date(c.ticket_depart_datetime) - new Date()) / 86400000);
                      if (daysUntil <= 2 && daysUntil >= 0) {
                        return <span style={{ fontSize:'9px', color:'#92400e', background:'#fef3c7', padding:'1px 5px', borderRadius:'5px', fontWeight:700, whiteSpace:'nowrap' }}>{daysUntil === 0 ? 'Pickup TODAY' : `Pickup in ${daysUntil}d`}
                        </span>;
                      }
                      return null;
                    })()}
                  </div>
                  {c.temp_employee_id && (
                    <div style={{ marginTop:'4px', fontSize:'9.5px', fontFamily:'ui-monospace,monospace', fontWeight:800, color:'#0f766e', background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:'5px', padding:'2px 6px', display:'inline-block' }}>
                      🆔 {c.temp_employee_id}
                    </div>
                  )}
                  {nextStep && (
                    <button onClick={moveNext} title={`Move to ${nextStep.label}`}
                      style={{ marginTop:'5px', width:'100%', background:step.color+'14', color:step.color, border:`1px solid ${step.color}40`,
                        borderRadius:'6px', padding:'3px 6px', fontSize:'11.5px', fontWeight:700, cursor:'pointer' }}>
                      Move → {nextStep.icon} {nextStep.label}
                    </button>
                  )}
                </div>
              );
            };

            // One step row: [ Step label pill LEFT ] [ candidate cards RIGHT ]
            const StepRow = ({ step, allCandidates, sectionColor }) => {
              const cards = allCandidates.filter(c => resolveStep(c) === step.id);
              const due0 = cards.filter(c => c.step_due_date && daysUntil(c.step_due_date) < 0).length;
              return (
                <div style={{ display:'flex', alignItems:'flex-start', gap:'0', marginBottom:'4px' }}>
                  {/* Step label — fixed left column */}
                  <div style={{ width:'154px', flexShrink:0, background:step.color, color:'#fff', borderRadius:'8px', padding:'6px 10px', marginRight:'8px', alignSelf:'stretch', display:'flex', flexDirection:'column', justifyContent:'center', minHeight:'52px' }}>
                    <div style={{ fontSize:'11.5px', fontWeight:700, lineHeight:1.2 }}>{step.icon} {step.label}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', marginTop:'3px' }}>
                      <span style={{ fontSize:'9px', opacity:0.85 }}>Target: {step.days}d</span>
                      <span style={{ background:'rgba(255,255,255,0.28)', borderRadius:'8px', padding:'0 6px', fontSize:'11px', fontWeight:800 }}>{cards.length}</span>
                      {due0>0 && <span style={{ background:'#fee2e2', color:'#991b1b', borderRadius:'6px', padding:'0 5px', fontSize:'9px', fontWeight:700 }}>{due0}</span>}
                    </div>
                  </div>
                  {/* Candidate cards — horizontal wrap */}
                  <div style={{ flex:1, display:'flex', flexWrap:'wrap', gap:'6px', alignContent:'flex-start', minHeight:'52px', background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'8px', padding: cards.length ? '6px 8px' : '0' }}>
                    {cards.length === 0
                      ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', minHeight:'52px', color:'#cbd5e1', fontSize:'10.5px' }}>—</div>
                      : cards.map(c => <CandCard key={c.id} c={c} step={step} />)
                    }
                  </div>
                </div>
              );
            };

            // Visa-processing-only section for one scenario (S1/S2/S3) — common steps and
            // "Joined" live in the shared panels above/below, not duplicated per scenario.
            const ScenarioSection = ({ scen, steps, laneRecords }) => {
              return (
                <div style={{ marginBottom:'20px', background:'#fff', border:`1.5px solid ${scen.color}30`, borderRadius:'12px', overflow:'hidden' }}>
                  {/* Section header */}
                  <div style={{ background:scen.bg, borderBottom:`1.5px solid ${scen.color}30`, padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'6px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontSize:'16px' }}>{scen.icon}</span>
                      <div>
                        <span style={{ fontSize:'12.5px', fontWeight:800, color:scen.color }}>{scen.label}</span>
                        <span style={{ fontSize:'10.5px', color:'#64748b', marginLeft:'8px' }}>{scen.desc}</span>
                        {scen.risk && <span style={{ fontSize:'10px', color:'#92400e', background:'#fef3c7', padding:'1px 7px', borderRadius:'6px', marginLeft:'8px' }}>{scen.risk}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                      <button onClick={()=>setSopChart({ key: scen.id })}
                        style={{ background:'#fff', border:`1.5px solid ${scen.color}60`, color:scen.color, padding:'4px 11px', borderRadius:'7px', fontSize:'11px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>SOP Guide</button>
                      <span style={{ background:scen.color, color:'#fff', borderRadius:'20px', padding:'2px 12px', fontSize:'11.5px', fontWeight:700 }}>{laneRecords.length} candidate{laneRecords.length!==1?'s':''}</span>
                    </div>
                  </div>
                  {/* Step rows — visa processing only, picks up right after Offer Signed */}
                  <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:'0' }}>
                    {steps.map(step => <StepRow key={step.id+'-'+scen.id} step={step} allCandidates={laneRecords} />)}
                  </div>
                </div>
              );
            };

            // ── Group candidates ──
            // Common-step ids: a candidate sits in the shared funnel below until they've
            // actually progressed PAST Offer Signed into scenario-specific work — regardless
            // of whether a visa route was already tagged on them earlier (e.g. via the Visa
            // Steps tab). This is what makes Resume → Interview → Offer Sent → Offer Signed
            // one single list for everyone, bifurcating only once real visa processing starts.
            const s1 = filtered.filter(r => r.hiring_scenario === 'S1' && STEPS_S1.some(s => s.id === resolveStep(r)));
            const s2 = filtered.filter(r => r.hiring_scenario === 'S2' && STEPS_S2.some(s => s.id === resolveStep(r)));
            const s3 = filtered.filter(r => r.hiring_scenario === 'S3' && STEPS_S3.some(s => s.id === resolveStep(r)));
            // Stuck candidates: offer signed, but no visa route chosen yet in the Decision tab —
            // these are the only ones that genuinely need action before they can move further.
            const awaitingScenario = filtered.filter(r => resolveStep(r) === 'offer_signed' && !r.hiring_scenario);

            return (
              <div>
                {/* ── Common Hiring Pipeline — identical for every candidate, whatever visa route applies ── */}
                <div style={{ marginBottom:'18px', background:'#fff', border:'1.5px solid #c7d2fe', borderRadius:'12px', overflow:'hidden' }}>
                  <div style={{ background:'#eef2ff', borderBottom:'1.5px solid #c7d2fe', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'6px' }}>
                    <div>
                      <span style={{ fontSize:'12.5px', fontWeight:800, color:'#4338ca' }}><EmojiIcon e="📋" /> Common Hiring Pipeline</span>
                      <span style={{ fontSize:'10.5px', color:'#64748b', marginLeft:'8px' }}>Resume → Interview → Offer Letter → Offer Signed — same for every candidate. Visa route is picked in the 📋 Decision tab once the offer is signed.</span>
                    </div>
                    <span style={{ background:'#4338ca', color:'#fff', borderRadius:'20px', padding:'2px 12px', fontSize:'11.5px', fontWeight:700 }}>{filtered.length} candidate{filtered.length!==1?'s':''}</span>
                  </div>
                  <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:'0' }}>
                    {STEPS_COMMON.map(step => <StepRow key={step.id} step={step} allCandidates={filtered} />)}
                  </div>
                </div>

                {/* ── Awaiting visa-route banner — only those genuinely blocked: offer signed, no scenario yet ── */}
                {awaitingScenario.length > 0 && (
                  <div style={{ background:'#fefce8', border:'2px dashed #fbbf24', borderRadius:'12px', padding:'10px 14px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'12.5px', fontWeight:800, color:'#92400e', marginBottom:'4px' }}><EmojiIcon e="❓" /> Offer Signed, Visa Route Not Chosen Yet — {awaitingScenario.length} candidate{awaitingScenario.length!==1?'s':''} — Action Needed</div>
                        {/* Names listed prominently */}
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'6px' }}>
                          {awaitingScenario.map(c => (
                            <span key={c.id} onClick={() => onEdit(c)}
                              style={{ background:'#fff', border:'1.5px solid #fbbf24', borderRadius:'7px', padding:'3px 10px', fontSize:'11.5px', fontWeight:700, color:'#92400e', cursor:'pointer' }}>
                              {c.candidate_name||'(no name)'} · {c.position_selected||c.position||'—'}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize:'10.5px', color:'#78350f' }}>
                          Click a name above → <strong><EmojiIcon e="📋" /> Decision tab</strong><EmojiIcon e="→" /><strong>Visa Route</strong><EmojiIcon e="→" /> select<strong>S1</strong> / <strong>S2</strong> / <strong>S3</strong>.
                          &nbsp; <strong>S1</strong> = overseas, SATCO sends visit visa &nbsp;·&nbsp; <strong>S2</strong> = overseas, SATCO issues entry permit &nbsp;·&nbsp; <strong>S3</strong> = candidate already in UAE
                        </div>
                      </div>
                      <span style={{ background:'#f59e0b', color:'#fff', borderRadius:'8px', padding:'3px 10px', fontSize:'11px', fontWeight:700, flexShrink:0 }}><EmojiIcon e="⚠" /> Action needed</span>
                    </div>
                  </div>
                )}

                {/* ── Visa-processing lanes — candidate only appears here once past Offer Signed ── */}
                <ScenarioSection scen={HIRING_SCENARIOS[0]} steps={STEPS_S1} laneRecords={s1} />
                <ScenarioSection scen={HIRING_SCENARIOS[1]} steps={STEPS_S2} laneRecords={s2} />
                <ScenarioSection scen={HIRING_SCENARIOS[2]} steps={STEPS_S3} laneRecords={s3} />

                {/* ── Joined — the funnels recombine here, whatever visa route got them there ── */}
                <div style={{ marginBottom:'8px', background:'#fff', border:'1.5px solid #86efac', borderRadius:'12px', overflow:'hidden' }}>
                  <div style={{ background:'#f0fdf4', borderBottom:'1.5px solid #86efac', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'6px' }}>
                    <span style={{ fontSize:'12.5px', fontWeight:800, color:'#166534' }}><EmojiIcon e="🏢" /> Onboarded</span>
                    <span style={{ background:'#059669', color:'#fff', borderRadius:'20px', padding:'2px 12px', fontSize:'11.5px', fontWeight:700 }}>{filtered.filter(c=>resolveStep(c)==='joined').length} candidate{filtered.filter(c=>resolveStep(c)==='joined').length!==1?'s':''}</span>
                  </div>
                  <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:'0' }}>
                    <StepRow step={STEP_END} allCandidates={filtered} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Table View */}
          {viewMode === 'table' && (
            <HiringTable filtered={filtered} resolveStep={resolveStep} getScenario={getScenario}
              onEdit={onEdit} onDelete={onDelete} onOpenSheet={onOpenSheet} setViewCandidate={setViewCandidate} onMoveLocation={onMoveLocation} showToast={showToast} />
          )}
          <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b', display:'flex', gap:'20px', flexWrap:'wrap', alignItems:'center' }}>
            <span>{filtered.length} candidate{filtered.length!==1?'s':''} shown</span>
            {viewMode === 'table' && (
              <span style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                <span style={{ display:'flex', alignItems:'center', gap:'5px' }}><span style={{ width:'12px', height:'12px', background:'#f0fdf4', border:'2px solid #86efac', borderRadius:'2px', display:'inline-block' }}></span> Interview conducted</span>
                <span style={{ display:'flex', alignItems:'center', gap:'5px' }}><span style={{ width:'12px', height:'12px', background:'#fffbeb', border:'2px solid #fcd34d', borderRadius:'2px', display:'inline-block' }}></span> Resume only</span>
                <span style={{ display:'flex', alignItems:'center', gap:'5px' }}><span style={{ width:'12px', height:'12px', background:'#fff7f7', border:'2px solid #fca5a5', borderRadius:'2px', display:'inline-block' }}></span> Overdue</span>
                <span style={{ color:'#94a3b8' }}>· Double-click any row to edit</span>
              </span>
            )}
            {viewMode === 'simple' && <span style={{ color:'#94a3b8' }}>Click any candidate to view full details</span>}
          </div>
        </div>


        {/* ── Candidate Detail Popup ── */}
        {viewCandidate && (() => {
          const c = viewCandidate;
          let wh = [];
          try { wh = JSON.parse(c.work_history || '[]'); } catch {}
          const effStep = resolveStep(c);
          const step = HIRING_STEPS.find(s=>s.id===effStep) || HIRING_STEPS.find(s=>s.id===c.step);
          const scInfo = getScenario(c);
          const statusColor = HIRING_STATUS_COLORS[c.status] || '#64748b';
          const scenarioSteps = getScenarioSteps(c.hiring_scenario);
          const curIdx = scenarioSteps.findIndex(s => s.id === effStep);
          const prevStep = curIdx > 0 ? scenarioSteps[curIdx - 1] : null;
          const nextStep = curIdx >= 0 && curIdx < scenarioSteps.length - 1 ? scenarioSteps[curIdx + 1] : null;
          const moveStage = async (target) => {
            try {
              if (target.id === 'visa_processing') {
                const tempId = await onStartVisaProcessing(c);
                showToast(`Moved to ${target.label}` + (tempId ? ` · Temp ID ${tempId} assigned` : ''));
                setViewCandidate({ ...c, manual_stage: target.id, temp_employee_id: tempId || c.temp_employee_id });
              } else {
                await onSaveDoc(c.id, { manual_stage: target.id });
                showToast(`Moved to ${target.label}`);
                setViewCandidate({ ...c, manual_stage: target.id });
              }
            }
            catch (err) { showToast('❌ Move failed: ' + err.message, 'error'); }
          };
          const Row = ({ label, value }) => value ? (
            <div style={{ display:'flex', gap:'8px', padding:'6px 0', borderBottom:'1px solid var(--bd3)' }}>
              <span style={{ minWidth:'160px', fontSize:'12px', color:'#64748b', fontWeight:600, flexShrink:0 }}>{label}</span>
              <span style={{ fontSize:'12px', color:'#0f172a' }}>{value}</span>
            </div>
          ) : null;
          return (
            <ResizablePanel
              title={c.candidate_name || '(no name)'}
              subtitle={`${c.position_selected||c.position||'—'} · ${c.status||''}`}
              headerColor="#1f2937"
              onClose={()=>setViewCandidate(null)}
              defaultSize="normal"
              zIndex={9999}>
              <div style={{ overflowY:'auto', flex:1, padding:'0' }} className="hr-scroll">
                {/* Header content (actions, stage nav) */}
                <div style={{ background:'linear-gradient(135deg,#1e3a5f,#2563eb)', color:'#fff', padding:'14px 20px', flexShrink:0 }}>
                  <div style={{ fontSize:'12px', opacity:0.85 }}>{c.position_selected || c.position||''} {c.nationality ? `· ${c.nationality}` : ''}{c.position_selected && <span style={{fontSize:'11px',background:'rgba(255,255,255,0.2)',padding:'1px 8px',borderRadius:'8px',marginLeft:'6px'}}>Selected ✓</span>}</div>
                  <div style={{ marginTop:'6px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {scInfo && <span style={{ background:'rgba(255,255,255,0.25)', padding:'2px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>{scInfo.icon} {scInfo.shortLabel}</span>}
                    <span style={{ background:'rgba(255,255,255,0.2)', padding:'2px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>{step?.icon} {step?.label||c.step}</span>
                    <span style={{ background:statusColor, padding:'2px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>{c.status}</span>
                    {c.experience && <span style={{ background:'rgba(255,255,255,0.15)', padding:'2px 10px', borderRadius:'10px', fontSize:'11px' }}><EmojiIcon e="⏱" /> {c.experience} yrs exp</span>}
                  </div>
                  <div style={{ marginTop:'8px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {prevStep && <button onClick={()=>moveStage(prevStep)} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'4px 10px', borderRadius:'7px', fontSize:'11px', fontWeight:700, cursor:'pointer' }}><EmojiIcon e="←" /> {prevStep.label}</button>}
                    {nextStep && <button onClick={()=>moveStage(nextStep)} style={{ background:'#059669', border:'none', color:'#fff', padding:'4px 10px', borderRadius:'7px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Move to {nextStep.label} →</button>}
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'8px' }}>
                    <button onClick={()=>{ setViewCandidate(null); onEdit(c); }} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'5px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Edit</button>
                    {(c.resume_url || c.cv_path) && (
                      <button onClick={()=>setCvViewer(resolveCvViewerProps(c))}
                        style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'5px 12px', borderRadius:'8px', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>View CV</button>
                    )}
                    <button onClick={async () => { try { await onMoveLocation(c.id, 'resume_db'); showToast(`${c.candidate_name||'Candidate'} moved to Resume Database`); setViewCandidate(null); } catch(err) { showToast('❌ Move failed: ' + err.message, 'error'); } }} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'5px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Move to Resume DB</button>
                    <button onClick={() => { setViewCandidate(null); onOpenSheet(c); }} style={{ background:'#1d4ed8', border:'none', color:'#fff', padding:'5px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Interview Sheet</button>
                    <button onClick={() => { if (window.confirm(`Delete ${c.candidate_name || 'this candidate'} permanently? This cannot be undone.`)) { setViewCandidate(null); onDelete(c.id); } }}
                      style={{ background:'rgba(220,38,38,0.25)', border:'1px solid rgba(254,202,202,0.5)', color:'#fff', padding:'5px 12px', borderRadius:'8px', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>Delete</button>
                  </div>
                </div>

                  {/* Temp Employee ID — visible once visa processing has started.
                      Also shown (with an "Assign now" recovery action) for candidates who reached
                      this stage before temp_employee_id existed/was wired up, so nobody gets stuck. */}
                  {(c.temp_employee_id || ['visa_processing','visa_arranged','entry_permit','travel','work_permit','status_change','medical','eid','visa_stamped','visa_cancel','joined'].includes(effStep)) && (
                    <TempIdDepositPanel candidate={c} onSaveDoc={onSaveDoc} onStartVisaProcessing={onStartVisaProcessing} showToast={showToast}
                      onUpdated={(patch)=>setViewCandidate(v=>({ ...v, ...patch }))} />
                  )}

                  {/* Transport Arrangement Panel - for S1/S2 visa candidates at travel+ stages */}
                  {(['visa_arranged','entry_permit','travel','work_permit','status_change','medical','eid','visa_stamped','visa_cancel','joined'].includes(effStep)) && (
                    <TransportArrangementPanel candidate={c} onSaveDoc={onSaveDoc} showToast={showToast}
                      onUpdated={(patch)=>setViewCandidate(v=>({ ...v, ...patch }))} />
                  )}

                  {/* Contact */}
                  <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--bd3)' }}>
                    <div style={{ fontSize:'11px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Contact</div>
                    <Row label="Phone" value={c.phone} />
                    <Row label="WhatsApp" value={c.whatsapp} />
                    <Row label="Email" value={c.email} />
                    <Row label="Current Location" value={c.current_location} />
                    <Row label="Home Address" value={c.home_address} />
                  </div>

                  {/* Personal */}
                  <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--bd3)' }}>
                    <div style={{ fontSize:'11px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Personal</div>
                    <Row label="Date of Birth" value={c.dob_candidate} />
                    <Row label="Nationality" value={c.nationality} />
                    <Row label="Marital Status" value={c.marital_status} />
                    <Row label="Religion" value={c.religion} />
                    <Row label="Languages" value={c.languages} />
                    <Row label="Education" value={c.education} />
                  </div>

                  {/* Passport */}
                  <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--bd3)' }}>
                    <div style={{ fontSize:'11px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}><EmojiIcon e="🛂" /> Passport</div>
                    <Row label="Passport No" value={c.passport_no} />
                    <Row label="Passport Expiry" value={c.passport_expiry_candidate} />
                  </div>

                  {/* Experience & Skills */}
                  <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--bd3)' }}>
                    <div style={{ fontSize:'11px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Experience & Skills</div>
                    {c.position_selected && <Row label="Position Selected" value={`${c.position_selected} (applied: ${c.position||'—'})`} />}
                    <Row label="Total Experience" value={c.experience ? `${c.experience} years` : null} />
                    <Row label="Current Employer" value={c.current_employer} />
                    <Row label="Current Designation" value={c.current_designation} />
                    {c.skills && (
                      <div style={{ padding:'6px 0' }}>
                        <div style={{ fontSize:'12px', color:'#64748b', fontWeight:600, marginBottom:'6px' }}>Key Skills</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                          {c.skills.split(',').map((s,i) => <span key={i} style={{ background:'#eff6ff', color:'#1d4ed8', padding:'3px 10px', borderRadius:'12px', fontSize:'11.5px', fontWeight:600 }}>{s.trim()}</span>)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Work History */}
                  {wh.length > 0 && (
                    <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--bd3)' }}>
                      <div style={{ fontSize:'11px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Work History</div>
                      <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11.5px' }}>
                          <thead><tr style={{ background:'#f8fafc' }}>
                            {['Company','Designation','Location','Period'].map(h=><th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:700, color:'#475569', fontSize:'11px', borderBottom:'1px solid var(--bd1)' }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {wh.map((row,i)=>(
                              <tr key={i} style={{ borderTop:i>0?'1px solid #f1f5f9':'none', background:i%2===0?'#fff':'#fafbfc' }}>
                                <td style={{ padding:'7px 10px', fontWeight:600 }}>{row.company||'—'}</td>
                                <td style={{ padding:'7px 10px', color:'#475569' }}>{row.designation||'—'}</td>
                                <td style={{ padding:'7px 10px', color:'#64748b' }}>{row.location||'—'}</td>
                                <td style={{ padding:'7px 10px', color:'#64748b', fontSize:'11px' }}>{row.from||''}{row.from&&row.to?' → ':''}{row.to||''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Referral & Pipeline */}
                  <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--bd3)' }}>
                    <div style={{ fontSize:'11px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>Pipeline & Referral</div>
                    {c.position_selected && (
                      <div style={{ display:'flex', gap:'8px', background:'#f0fdf4', borderRadius:'8px', padding:'10px 12px', marginBottom:'8px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'11px', color:'#059669', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}><EmojiIcon e="✅" /> Position Selected After Interview</div>
                          <div style={{ fontSize:'14px', fontWeight:700, color:'#166534' }}>{c.position_selected}</div>
                          <div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px' }}>Applied for: {c.position}</div>
                        </div>
                      </div>
                    )}
                    <Row label="Referred By" value={c.referred_by} />
                    <Row label="Referrer Contact" value={c.referred_contact} />
                    <Row label="Available From" value={c.available_from} />
                    <Row label="Interview Date" value={c.interview_date} />
                    <Row label="Interview Score" value={c.interview_score ? `${c.interview_score}/30` : null} />
                    {c.interview_verdict && <Row label="Verdict" value={<EmojiLabel text={c.interview_verdict==="selected"?"✅ Selected":c.interview_verdict==="onhold"?"⏸ On Hold":c.interview_verdict==="rejected"?"❌ Not Suitable":c.interview_verdict} />} />}
                    {c.gamka_result && <Row label="Medical Result" value={c.gamka_result} />}
                    {c.deployment_site && <Row label="Deployment Site" value={c.deployment_site} />}
                    <Row label="Salary (Basic)" value={c.basic_salary ? `AED ${Number(c.basic_salary).toLocaleString()}` : null} />
                    <Row label="Allowance" value={c.allowance ? `AED ${Number(c.allowance).toLocaleString()}` : null} />
                    {c.remarks && <Row label="Remarks" value={c.remarks} />}
                  </div>

                  {/* ===== TICKET / TRANSPORT INFO ===== */}
                  {(c.ticket_flight_no || c.ticket_pnr || c.ticket_depart_datetime) && (
                    <div style={{ padding:'12px 20px', background:'#f0f9ff', borderTop:'1px solid #bae6fd' }}>
                      <div style={{ fontSize:'11px', fontWeight:800, color:'#0369a1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}><EmojiIcon e="✈️" /> Flight / Ticket Details</div>
                      <div style={{ background:'#0f172a', color:'#fff', borderRadius:'10px', padding:'12px 16px', marginBottom:'10px' }}>
                        <div style={{ fontWeight:700, fontSize:'13px', marginBottom:'8px', display:'flex', justifyContent:'space-between' }}>
                          <span>{c.ticket_flight_no || '—'}</span>
                          <span style={{ color:'#94a3b8', fontSize:'11px' }}>PNR: {c.ticket_pnr || '—'}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:'18px', fontWeight:700 }}>{c.ticket_from_airport || '—'}</div>
                            <div style={{ fontSize:'10px', color:'#94a3b8' }}>{c.ticket_from_terminal || ''}</div>
                            <div style={{ fontSize:'11px' }}>{c.ticket_depart_datetime ? new Date(c.ticket_depart_datetime).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'}) : ''}</div>
                          </div>
                          <div style={{ flex:1, borderTop:'1px dashed #475569', textAlign:'center' }}><span><EmojiIcon e="✈" /></span></div>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:'18px', fontWeight:700, color:'#34d399' }}>{c.ticket_to_airport || '—'}</div>
                            <div style={{ fontSize:'10px', color:'#94a3b8' }}>{c.ticket_to_terminal || ''}</div>
                            <div style={{ fontSize:'11px', color:'#34d399' }}>{c.ticket_arrive_datetime ? new Date(c.ticket_arrive_datetime).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'}) : ''}</div>
                          </div>
                        </div>
                        <div style={{ marginTop:'8px', fontSize:'11px', color:'#94a3b8', display:'flex', justifyContent:'space-between' }}>
                          <span>{c.ticket_depart_datetime ? new Date(c.ticket_depart_datetime).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Dubai'}) : ''}</span>
                          <span>{c.ticket_airline || ''}</span>
                        </div>
                      </div>
                      {(() => {
                        if (!c.ticket_depart_datetime) return null;
                        const daysUntil = Math.ceil((new Date(c.ticket_depart_datetime) - new Date()) / 86400000);
                        if (daysUntil <= 2 && daysUntil >= 0) {
                          return (
                            <div style={{ background:'#fef3c7', border:'1px solid #fbbf24', borderRadius:'8px', padding:'8px 12px', marginBottom:'8px', fontSize:'12px', color:'#92400e', fontWeight:700 }}><EmojiIcon e="🚗" /> AIRPORT PICKUP: {daysUntil === 0 ? 'TODAY' : `in ${daysUntil} day(s)`} - {c.ticket_to_airport}{c.ticket_to_terminal ? ' T/'+c.ticket_to_terminal : ''} at {c.ticket_arrive_datetime ? new Date(c.ticket_arrive_datetime).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'}) : ''}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <Row label="From" value={[c.ticket_from_city, c.ticket_from_airport, c.ticket_from_terminal].filter(Boolean).join(' / ') || null} />
                      <Row label="To" value={[c.ticket_to_city, c.ticket_to_airport, c.ticket_to_terminal].filter(Boolean).join(' / ') || null} />
                      <Row label="Departure" value={c.ticket_depart_datetime ? new Date(c.ticket_depart_datetime).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'}) : null} />
                      <Row label="Arrival" value={c.ticket_arrive_datetime ? new Date(c.ticket_arrive_datetime).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'}) : null} />
                      {c.ticket_seat && <Row label="Seat" value={c.ticket_seat} />}
                      {c.ticket_class && <Row label="Class" value={c.ticket_class} />}
                    </div>
                  )}

                  {/* Supplier */}
                  {c.is_supplier_hire==='yes' && (
                    <div style={{ padding:'12px 20px', background:'#ede9fe', borderTop:'1px solid #c4b5fd' }}>
                      <div style={{ fontSize:'11px', fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}><EmojiIcon e="🏢" /> Supplier / Agency</div>
                      <Row label="Supplier Name" value={c.supplier_name} />
                      <Row label="Contact Person" value={c.supplier_contact_name} />
                      <Row label="Phone" value={c.supplier_phone} />
                      <Row label="WhatsApp" value={c.supplier_whatsapp} />
                      <Row label="Email" value={c.supplier_email} />
                      <Row label="Address" value={c.supplier_address} />
                      <Row label="Rate / Hour" value={c.rate_per_hour ? `AED ${c.rate_per_hour}/hr` : null} />
                      <Row label="Accommodation" value={c.accommodation_by} />
                      <Row label="Transport" value={c.transport_by} />
                      <Row label="Food" value={c.food_by} />
                      {c.supplier_notes && <Row label="Notes" value={c.supplier_notes} />}
                    </div>
                  )}
              </div>
            </ResizablePanel>
          );
        })()}

        {/* Stage Document Upload Modal */}
        {stageUpload && (
          <StageDocUploadModal
            candidate={stageUpload.candidate}
            stepId={stageUpload.step.id}
            stepLabel={stageUpload.step.label}
            stepColor={stageUpload.step.color}
            stepIcon={stageUpload.step.icon}
            onSave={onSaveDoc}
            onClose={() => setStageUpload(null)}
            showToast={showToast}
            supaUrl="https://oaerqjrkdpuhiproppaz.supabase.co"
            supaKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI"
          />
        )}

        {/* CV / Resume Inline Viewer */}
        {cvViewer && (
          <CvViewerOverlay
            cvPath={cvViewer.cvPath}
            base64={cvViewer.base64}
            url={cvViewer.url}
            fileName={cvViewer.fileName}
            supaUrl="https://oaerqjrkdpuhiproppaz.supabase.co"
            supaKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI"
            onClose={()=>setCvViewer(null)}
          />
        )}

        {/* SOP Workflow Chart Viewer */}
        {sopChart && (
          <SopChartViewer
            guideKey={sopChart.key}
            startIndex={sopChart.startIndex || 0}
            onClose={() => setSopChart(null)}
          />
        )}
        </>
      );

    }); // end React.memo HiringView


    // ──────────────────────────────────────────────────────────────────────────
    // Shared CV / Resume inline viewer overlay
    // Props:
    //   cvPath   – Supabase Storage path (for job applications, bucket: cv-uploads)
    //   base64   – base64 data URI string (for hiring_pipeline resume_url column)
    //   fileName – display name shown in header
    //   supaUrl  – Supabase project URL
    //   supaKey  – Supabase anon key
    //   onClose  – close handler
    // ──────────────────────────────────────────────────────────────────────────
    // Resolves a candidate's stored resume reference into the right shape for
    // CvViewerOverlay. Historically resume_url has taken three different forms
    // depending on which upload path wrote it:
    //   "cv-uploads::<path>"  -> Supabase Storage path (get a signed URL)
    //   "https://..."         -> already a full public URL (e.g. website uploads)
    //   "<path>" (bare)       -> legacy rows written before the "cv-uploads::"
    //                            prefix convention existed — still a storage path
    // Passing a bare https:// URL in as `base64` (the old inline logic at each
    // call site did this) makes CvViewerOverlay try to atob()-decode a URL,
    // which throws — so candidates whose CV was a direct URL couldn't be
    // opened. This resolves all three shapes correctly in one place.
    function resolveCvViewerProps(c) {
      const ru = (c.resume_url || '').trim();
      const fileName = c.candidate_name ? `${c.candidate_name} - Resume` : 'Resume';
      if (!ru && !c.cv_path) return null;
      if (ru.startsWith('cv-uploads::')) {
        return { base64: null, url: null, cvPath: ru.replace('cv-uploads::',''), fileName };
      }
      if (/^https?:\/\//i.test(ru)) {
        return { base64: null, url: ru, cvPath: null, fileName };
      }
      if (ru.startsWith('data:')) {
        return { base64: ru, url: null, cvPath: null, fileName };
      }
      // Bare storage path, or no resume_url but a legacy cv_path prop
      return { base64: null, url: null, cvPath: ru || c.cv_path || null, fileName };
    }

    function CvViewerOverlay({ cvPath, base64, url, fileName, supaUrl, supaKey, db: dbProp, onClose }) {
      const db = dbProp || window._satcoDB;
      const [viewUrl,  setViewUrl]  = React.useState(null); // signed URL → fed directly to iframe
      const [blobUrl,  setBlobUrl]  = React.useState(null); // blob URL → only for base64 case
      const [loading,  setLoading]  = React.useState(true);
      const [error,    setError]    = React.useState(null);
      const isImage = (name) => /\.(jpe?g|png|webp|gif)$/i.test(name||'');

      React.useEffect(() => {
        let revoke;
        (async () => {
          setLoading(true); setError(null); setViewUrl(null); setBlobUrl(null);
          try {
            if (url) {
              // Already a full public/https URL — use it directly, no signing or decoding.
              setViewUrl(url);
            } else if (base64) {
              // base64 path — convert to blob URL (no download triggered for images/PDFs shown in <img>/<iframe>)
              const b64data = base64.includes(',') ? base64.split(',')[1] : base64;
              const mime = base64.startsWith('data:') ? base64.split(';')[0].slice(5) : 'application/pdf';
              const bytes = atob(b64data);
              const arr = new Uint8Array(bytes.length);
              for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
              const blob = new Blob([arr], { type: mime });
              const bu = URL.createObjectURL(blob);
              revoke = bu;
              setBlobUrl(bu);
            } else if (cvPath) {
              // Storage path — get signed URL and pass directly to <iframe>; no fetch/download
              let signedUrl = null;
              if (db) {
                const { data: signData, error: signErr } = await db.storage
                  .from('cv-uploads')
                  .createSignedUrl(cvPath, 600);
                if (!signErr && signData?.signedUrl) signedUrl = signData.signedUrl;
              }
              if (!signedUrl) {
                const signRes = await fetch(
                  `${supaUrl}/storage/v1/object/sign/cv-uploads/${cvPath}`,
                  { method:'POST', headers:{ 'Authorization':`Bearer ${supaKey}`, 'Content-Type':'application/json' }, body:JSON.stringify({ expiresIn:600 }) }
                );
                if (signRes.ok) {
                  const { signedURL } = await signRes.json();
                  if (signedURL) signedUrl = `${supaUrl}${signedURL}`;
                }
              }
              if (!signedUrl) throw new Error('Could not generate a secure link for this CV.');
              setViewUrl(signedUrl); // feed directly to <iframe> — no download
            } else {
              throw new Error('No CV data available');
            }
          } catch(e) { setError(e.message); }
          finally { setLoading(false); }
        })();
        return () => { if (revoke) URL.revokeObjectURL(revoke); };
      }, [cvPath, base64, url]);

      const name   = fileName || cvPath || 'Resume';
      const img    = isImage(name);
      const srcUrl = viewUrl || blobUrl;

      return (
        <div onClick={onClose}
          style={{ position:'fixed', inset:0, background:'rgba(10,15,30,0.88)', zIndex:10100, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start' }}>
          {/* Toolbar */}
          <div onClick={e=>e.stopPropagation()}
            style={{ width:'100%', background:'#1e3a5f', color:'#fff', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, boxShadow:'0 2px 12px rgba(0,0,0,0.3)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'18px' }}><EmojiIcon e="📄" /></span>
              <div>
                <div style={{ fontWeight:700, fontSize:'14px' }}>{name}</div>
                <div style={{ fontSize:'11px', opacity:0.7 }}>Click outside or ✕ to close</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              {srcUrl && (
                <button onClick={()=>window.open(srcUrl,'_blank')}
                  style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', fontSize:'12px', fontWeight:600, padding:'5px 12px', borderRadius:'6px', cursor:'pointer' }}><EmojiIcon e="↗" /> New Tab</button>
              )}
              <button onClick={onClose}
                style={{ background:'none', border:'none', color:'#fff', fontSize:'24px', cursor:'pointer', lineHeight:1, opacity:0.8 }}>×</button>
            </div>
          </div>

          {/* Content area */}
          <div onClick={e=>e.stopPropagation()}
            style={{ flex:1, width:'100%', maxWidth:'960px', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', padding:'12px' }}>
            {loading && (
              <div style={{ textAlign:'center', color:'#fff' }}>
                <div style={{ fontSize:'48px', marginBottom:'12px' }}></div>
                <div style={{ fontWeight:600 }}>Loading resume…</div>
              </div>
            )}
            {error && (
              <div style={{ textAlign:'center', color:'#fca5a5' }}>
                <div style={{ fontSize:'48px', marginBottom:'12px' }}></div>
                <div style={{ fontWeight:600 }}>{error}</div>
                <div style={{ fontSize:'12px', opacity:0.7, marginTop:'6px' }}>The file may not be available or the CV was not uploaded.</div>
              </div>
            )}
            {srcUrl && !loading && (
              img
                ? <img src={srcUrl} alt="Resume" style={{ maxWidth:'100%', maxHeight:'calc(100vh - 80px)', objectFit:'contain', borderRadius:'8px', boxShadow:'0 4px 32px rgba(0,0,0,0.5)' }} />
                : <iframe
                    key={srcUrl}
                    src={blobUrl
                      ? blobUrl                                    /* blob URL from base64 — renders inline always */
                      : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(srcUrl)}`  /* signed URL via Google Docs viewer — no download prompt */
                    }
                    title={name}
                    allow="fullscreen"
                    style={{ width:'100%', height:'calc(100vh - 80px)', border:'none', borderRadius:'8px', background:'#fff' }}>
                    <div style={{ textAlign:'center', color:'#fff', paddingTop:'60px' }}>
                      <div style={{ fontSize:'36px', marginBottom:'12px' }}></div>
                      <div style={{ fontWeight:600, marginBottom:'8px' }}>PDF cannot display inline.</div>
                      <button onClick={()=>window.open(srcUrl,'_blank')}
                        style={{ background:'#2563eb', color:'#fff', border:'none', padding:'10px 24px', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Open in New Tab</button>
                    </div>
                  </iframe>
            )}
          </div>
        </div>
      );
    }


    // ──────────────────────────────────────────────────────────────────────────
    // Email CV Upload Modal
    // HR uploads a CV received by email → AI extracts fields → save to
    // job_applications (source='email') → move to Hiring Pipeline or Resume DB
    // ──────────────────────────────────────────────────────────────────────────
    function EmailCvUploadModal({ supaUrl, supaKey, hdrs, vacancies, db, onClose, onSaved, showToast, onAutoAssess }) {
      const PROXY = '/api/claude';
      const [step, setStep]           = React.useState('upload'); // upload | review | saving
      const [file, setFile]           = React.useState(null);
      const [extracting, setExtracting] = React.useState(false);
      const [extracted, setExtracted] = React.useState(null); // raw AI result
      const [aiScore, setAiScore] = React.useState(null); // AI resume-strength score (0-100) — used to auto-rank this candidate in Resume Database
      const [form, setForm]           = React.useState({
        full_name:'', email:'', phone:'', nationality:'', current_location:'',
        years_experience:'', actual_experience_years:'', current_role:'', current_employer:'', skills:'',
        passport_number:'', passport_expiry:'', middle_east_exp:'', work_history:''
      });
      const [selectedVacancy, setSelectedVacancy] = React.useState('unsolicited');
      const [destination, setDestination] = React.useState('resume_db'); // resume_db | pipeline

      const openVacancies = vacancies.filter(v => v.status === 'open');

      const F = (k, v) => setForm(f => ({ ...f, [k]: v }));

      const extractFromCv = async (f) => {
        setExtracting(true);
        try {
          const base64 = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload  = () => res(reader.result.split(',')[1]);
            reader.onerror = () => rej(new Error('Could not read file'));
            reader.readAsDataURL(f);
          });
          const isPdf = f.name.toLowerCase().endsWith('.pdf');
          const body = {
            model: 'claude-sonnet-4-6', max_tokens: 1400,
            messages: [{ role: 'user', content: [
              {
                type: isPdf ? 'document' : 'text',
                ...(isPdf
                  ? { source: { type:'base64', media_type:'application/pdf', data: base64 } }
                  : { text: 'Word document CV — extract information.' }
                )
              },
              { type:'text', text:`Extract candidate info from this CV. Respond ONLY with valid JSON, no markdown:
{
  "name": "full name or null",
  "email": "email or null",
  "phone": "phone or null",
  "nationality": "nationality or null",
  "current_location": "city, country or null",
  "experience_years": "range like '5-10 years' or null",
  "actual_experience_years": "number like 7.5 or null",
  "current_role": "current/recent job title or null",
  "current_employer": "name of current or most recent employer/company or null",
  "skills": "comma-separated key technical skills, tools, certifications and trade skills, max 18 or null",
  "passport_number": "passport number or null",
  "passport_expiry": "YYYY-MM-DD or null",
  "middle_east_experience": "yes/no/null",
  "work_history": "top 8 employers as: Company | Role/Designation | Work Location/Country/Site | Period, separated by semicolons. Include UAE/GCC project/site locations when visible.",
  "resume_strength_score": "integer 0-100 rating overall resume strength — weigh total relevant experience, career progression/seniority, GCC or Middle East project experience, breadth of relevant technical skills, and completeness of the information on the CV"
}` }
            ]}]
          };
          const res = await fetch(PROXY, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
          if (!res.ok) throw new Error('AI extraction failed');
          const data = await res.json();
          const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
          const clean = text.replace(/```json|```/g,'').trim();
          const parsed = JSON.parse(clean);
          setExtracted(parsed);
          const scoreNum = Number(parsed.resume_strength_score);
          setAiScore(Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : null);
          setForm({
            full_name:              parsed.name || '',
            email:                  parsed.email || '',
            phone:                  parsed.phone || '',
            nationality:            parsed.nationality || '',
            current_location:       parsed.current_location || '',
            years_experience:       parsed.experience_years || '',
            actual_experience_years: parsed.actual_experience_years ? String(parsed.actual_experience_years) : '',
            current_role:           parsed.current_role || '',
            current_employer:       parsed.current_employer || '',
            skills:                 parsed.skills || '',
            passport_number:        parsed.passport_number || '',
            passport_expiry:        parsed.passport_expiry || '',
            middle_east_exp:        parsed.middle_east_experience || '',
            work_history:           parsed.work_history || '',
          });
          setStep('review');
        } catch(e) {
          showToast('❌ AI extraction failed: ' + e.message, 'error');
        } finally { setExtracting(false); }
      };

      const handleFileChange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { showToast('⚠️ File must be under 5 MB', 'error'); return; }
        setFile(f);
        await extractFromCv(f);
      };

      const save = async () => {
        if (!form.full_name.trim()) { showToast('⚠️ Candidate name is required', 'error'); return; }
        setStep('saving');
        try {
          // 1. Upload CV to Supabase Storage
          let cvFilePath = null;
          if (file) {
            const ext      = file.name.split('.').pop();
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            cvFilePath     = `applications/${safeName}`;
            const upRes = await fetch(`${supaUrl}/storage/v1/object/cv-uploads/${cvFilePath}`, {
              method:'POST',
              headers:{ 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}`, 'Content-Type': file.type },
              body: file
            });
            if (!upRes.ok) throw new Error(`CV upload failed (${upRes.status})`);
          }

          // 2. Determine vacancy — when no specific open vacancy is picked, fall back to the
          // AI-extracted job title from the CV itself so the candidate still lands in a
          // meaningful position folder in Resume Database instead of a generic 'Unsolicited' bucket.
          const vac = openVacancies.find(v => v.id === selectedVacancy);
          const vacancyId    = vac ? vac.id    : null;
          const vacancyTitle = vac ? vac.title : ((form.current_role || '').trim() || 'Unsolicited');

          // 3. Build summary
          const summaryParts = [
            form.current_role ? `Current Role: ${form.current_role}` : '',
            form.skills       ? `Key Skills: ${form.skills}`         : '',
            'Source: Email / Manual Upload'
          ].filter(Boolean).join('\n');

          // 4. Save to job_applications
          const appPayload = {
            vacancy_id:              vacancyId,
            vacancy_title:           vacancyTitle,
            full_name:               form.full_name,
            applicant_name:          form.full_name,
            email:                   form.email,
            phone:                   form.phone,
            nationality:             form.nationality,
            current_location:        form.current_location,
            years_experience:        form.years_experience,
            actual_experience_years: form.actual_experience_years ? parseFloat(form.actual_experience_years) : null,
            current_role:            form.current_role,
            current_employer:        form.current_employer || null,
            skills:                  form.skills,
            passport_number:         form.passport_number,
            passport_expiry:         form.passport_expiry || null,
            middle_east_exp:         form.middle_east_exp || null,
            work_history:            form.work_history    || null,
            cv_file_path:            cvFilePath,
            cv_file_name:            file ? file.name : null,
            summary:                 summaryParts,
            score:                   null,
            application_source:      'hr_upload',
            status:                  'new',
          };
          const { data: appRows, error: appErr } = await db
            .from('job_applications')
            .insert(appPayload)
            .select();
          if (appErr) throw new Error(appErr.message);
          const [savedApp] = appRows || [];

          // 5. Move to destination
          if (destination === 'pipeline' || destination === 'resume_db') {
            const { error: pipeErr } = await dbSaveWithRetry('hiring_pipeline', {
              candidate_name:      form.full_name,
              email:               form.email,
              phone:               form.phone,
              nationality:         form.nationality,
              current_location:    form.current_location,
              experience:          form.actual_experience_years ? `${form.actual_experience_years} years` : form.years_experience,
              skills:              form.skills,
              current_designation: form.current_role,
              current_employer:    form.current_employer || null,
              work_history:        form.work_history || null,
              me_experience:       form.middle_east_exp || null,
              me_notes:            form.work_history || null,
              passport_no:         form.passport_number,
              position:            vacancyTitle,
              status:              destination === 'pipeline' ? 'Screening' : 'Resume DB',
              step:                'Offer Pending',
              hiring_scenario:     'S3',
              pipeline_location:   destination,
              claude_score:        aiScore,
              remarks:             `Uploaded from email. CV: ${file ? file.name : '—'}. Vacancy: ${vacancyTitle}.`
            });
            if (pipeErr) throw new Error(pipeErr.message);
            if (savedApp?.id) {
              await db.from('job_applications').update({ status: 'shortlisted' }).eq('id', savedApp.id);
            }
          }

          showToast(destination === 'pipeline'
            ? `✅ ${form.full_name} saved — running Claude assessment…`
            : destination === 'resume_db'
              ? `🗄️ ${form.full_name} saved to Resume Database — running Claude assessment…`
              : `✅ ${form.full_name} saved — running Claude assessment…`
          );
          // Trigger Claude auto-assessment in background for the saved application
          if (onAutoAssess && savedApp) {
            onAutoAssess(savedApp).catch(e => console.warn('Auto-assess failed:', e.message));
          }
          onSaved();
        } catch(e) {
          showToast('❌ Save failed: ' + e.message, 'error');
          setStep('review');
        }
      };

      const inp = { width:'100%', padding:'8px 10px', border:'1px solid var(--bd2)', borderRadius:'7px', fontSize:'12.5px', boxSizing:'border-box', fontFamily:'inherit' };
      const lbl = { fontSize:'11px', fontWeight:700, color:'#64748b', marginBottom:'4px', display:'block' };
      const grp = (label, key, type='text', opts) => (
        <div style={{ marginBottom:'10px' }}>
          <label style={lbl}>{label}</label>
          {opts
            ? <select style={inp} value={form[key]} onChange={e=>F(key,e.target.value)}>
                {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            : <input type={type} style={inp} value={form[key]} onChange={e=>F(key,e.target.value)} />
          }
        </div>
      );

      return (
        <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.7)', zIndex:10050, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'14px', width:'100%', maxWidth:'680px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}
            className="hr-scroll">

            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,#ea580c,#f97316)', color:'#fff', padding:'18px 24px', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'16px', fontWeight:900 }}><EmojiIcon e="📧" /> Upload CV Received by Email</div>
                <div style={{ fontSize:'12px', opacity:0.85, marginTop:'2px' }}>AI will read the CV and fill in the candidate's details automatically</div>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', fontSize:'22px', cursor:'pointer', opacity:0.8 }}>×</button>
            </div>

            <div style={{ padding:'22px 24px' }}>

              {/* Step 1: File upload */}
              <div style={{ background: step==='upload'&&!extracting ? '#fff7ed' : '#f8fafc', border:`2px dashed ${step==='upload'&&!extracting?'#f97316':'#e2e8f0'}`, borderRadius:'10px', padding:'20px', marginBottom:'20px', textAlign:'center' }}>
                {extracting ? (
                  <div style={{ color:'#ea580c', fontWeight:700 }}>
                    <div style={{ fontSize:'32px', marginBottom:'8px' }}></div>
                    <div>Reading CV with AI… please wait</div>
                    <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>Extracting name, experience, skills, work history…</div>
                  </div>
                ) : step === 'review' ? (
                  <div style={{ color:'#16a34a', fontWeight:700 }}>
                    <div style={{ fontSize:'28px', marginBottom:'6px' }}></div>
                    <div>{file?.name}</div>
                    <div style={{ fontSize:'12px', color:'#64748b', marginTop:'4px', fontWeight:400 }}>AI extraction complete — review and edit the details below</div>
                    <label style={{ marginTop:'10px', display:'inline-block', fontSize:'12px', color:'#ea580c', cursor:'pointer', fontWeight:600, textDecoration:'underline' }}>
                      Upload a different file
                      <input type="file" accept=".pdf,.doc,.docx" style={{ display:'none' }} onChange={handleFileChange} />
                    </label>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:'36px', marginBottom:'8px' }}></div>
                    <div style={{ fontWeight:700, color:'#334155', marginBottom:'4px' }}>Select CV file from your computer / OneDrive</div>
                    <div style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'12px' }}>PDF, DOC or DOCX — max 5 MB</div>
                    <label style={{ display:'inline-block', background:'#ea580c', color:'#fff', padding:'10px 24px', borderRadius:'8px', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>Choose File<input type="file" accept=".pdf,.doc,.docx" style={{ display:'none' }} onChange={handleFileChange} />
                    </label>
                  </>
                )}
              </div>

              {/* Step 2: Review extracted fields */}
              {step === 'review' && (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                    {grp('Full Name *',      'full_name')}
                    {grp('Email',            'email', 'email')}
                    {grp('Phone / WhatsApp', 'phone', 'tel')}
                    {grp('Nationality',      'nationality')}
                    {grp('Current Location', 'current_location')}
                    {grp('Experience Range', 'years_experience', 'text')}
                    {grp('Actual Years Exp.','actual_experience_years','number')}
                    {grp('Current / Recent Role','current_role')}
                    {grp('UAE / GCC Experience','middle_east_exp','text',[
                      ['','— Not specified'],['yes','✅ Yes — worked in GCC/UAE'],['no','❌ No — no Middle East experience']
                    ])}
                    {grp('Passport Number',  'passport_number')}
                    {grp('Passport Expiry',  'passport_expiry', 'date')}
                  </div>

                  <div style={{ marginBottom:'10px' }}>
                    <label style={lbl}>Key Skills <span style={{ fontWeight:400, color:'#94a3b8' }}>(comma-separated)</span></label>
                    <input style={inp} value={form.skills} onChange={e=>F('skills',e.target.value)} placeholder="e.g. Piping, Welding, AutoCAD, QC Inspection" />
                  </div>

                  <div style={{ marginBottom:'10px' }}>
                    <label style={lbl}>Work History <span style={{ fontWeight:400, color:'#94a3b8' }}>Company | Role | Work Location | Period — one per line</span></label>
                    <textarea style={{ ...inp, minHeight:'80px', resize:'vertical' }} value={form.work_history} onChange={e=>F('work_history',e.target.value)} placeholder="ADNOC | Pipeline Engineer | Ruwais, UAE | 2019–2023&#10;Linde KEZAD | Mechanical Supervisor | Abu Dhabi, UAE | 2017–2019" />
                  </div>

                  <hr style={{ border:'none', borderTop:'1px solid var(--bd1)', margin:'16px 0' }} />

                  {/* Vacancy + Destination */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                    <div>
                      <label style={lbl}>Link to Vacancy</label>
                      <select style={inp} value={selectedVacancy} onChange={e=>setSelectedVacancy(e.target.value)}>
                        <option value="unsolicited">— Unsolicited (no vacancy)</option>
                        {openVacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Save to</label>
                      <select style={inp} value={destination} onChange={e=>setDestination(e.target.value)}>
                        <option value="resume_db"><EmojiIcon e="🗄️" /> Resume Database</option>
                        <option value="pipeline"><EmojiIcon e="🧑‍💼" /> Hiring Pipeline</option>
                        <option value="applications_only"><EmojiIcon e="📋" /> Applications only (review later)</option>
                      </select>
                    </div>
                  </div>

                  {/* Save button */}
                  <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
                    <button onClick={onClose} style={{ padding:'10px 20px', border:'1px solid #b6c2d1', background:'#e2e8f0', borderRadius:'8px', fontSize:'15px', fontWeight:700, cursor:'pointer', color:'#334155' }}>Cancel</button>
                    <button onClick={save} disabled={step==='saving'}
                      style={{ padding:'10px 24px', background:'#ea580c', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>
                      <EmojiLabel text={step==='saving' ? '⏳ Saving…' :
                        destination==='pipeline' ? '🧑‍💼 Save & Send to Hiring Pipeline' :
                        destination==='resume_db' ? '🗄️ Save to Resume Database' :
                        '💾 Save to Applications'} />
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      );
    }


    // -------- Job Vacancies — post & manage openings that appear on the public website --------
    function JobVacanciesView({ showToast, db, user }) {
      const SURL = 'https://oaerqjrkdpuhiproppaz.supabase.co';
      const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI';
      const hdrs = { 'apikey': SKEY, 'Authorization': `Bearer ${SKEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

      const [vacancies, setVacancies]     = useState([]);
      const [applications, setApplications] = useState([]);
      const [loading, setLoading]         = useState(true);
      const [activeTab, setActiveTab]     = useState('vacancies');
      const [showForm, setShowForm]       = useState(false);
      const [editingId, setEditingId]     = useState(null);
      const [expandedApp, setExpandedApp] = useState(null);
      const [viewApplication, setViewApplication] = useState(null);
      const [cvViewer, setCvViewer] = useState(null); // { cvPath, fileName }
      const [emailUpload, setEmailUpload] = useState(false); // show email CV upload modal
      const [generatingQ, setGeneratingQ] = useState(false);
      const [appliFilter, setAppliFilter] = useState('all');
      const [vacancyFilter, setVacancyFilter] = useState('all'); // filter by specific vacancy
      const [resumeDbMatches, setResumeDbMatches] = useState([]); // candidates from Resume DB matched to current vacancy
      const [matchingResumeDb, setMatchingResumeDb] = useState(false); // scanning in progress
      const [resumeDbScanned, setResumeDbScanned] = useState(null); // vacancy id last scanned
      const [previewVac, setPreviewVac] = useState(null); // vacancy to preview before publish

      const emptyForm = {
        title:'', department:'', location:'Abu Dhabi, UAE',
        employment_type:'Full-Time', salary_range:'', experience_required:'',
        description:'', requirements:'', status:'draft',
        questions: null,
        benefits: {
          salary_range:'', accommodation:'Provided by company',
          food:'Provided by company', transport:'Provided by company',
          medical:'Provided by company', air_ticket:'One return ticket per year'
        }
      };
      const [form, setForm]   = useState(emptyForm);
      const [saving, setSaving] = useState(false);

      const PROXY = '/api/claude';
      const [assessingIds, setAssessingIds] = useState({}); // id -> true while Claude is running

      // ── Core Claude assessment function — usable from anywhere ──
      const runClaudeAssessmentForApp = React.useCallback(async (app, vacsSnapshot) => {
        const SURL2 = SURL; const SKEY2 = SKEY; const hdrs2 = hdrs;
        const vac = (vacsSnapshot || []).find(v => v.id === app.vacancy_id);
        const jobContext = vac
          ? `Job Title: ${vac.title}\nRequirements: ${vac.requirements || vac.description || ''}\nExperience Required: ${vac.experience_required || ''}\nDepartment: ${vac.department || ''}`
          : `Applied for: ${app.vacancy_title || 'Unknown position'}`;

        const name = app.applicant_name || app.full_name || '';
        const role = app.current_role || '';
        const expActual = app.actual_experience_years ? `${app.actual_experience_years} years` : null;
        const expRange = app.years_experience || app.experience_years || null;

        const candidateProfile = [
          name   ? `Name: ${name}`           : '',
          role   ? `Current Role: ${role}`   : '',
          (app.current_employer || app.current_company) ? `Current Employer: ${app.current_employer || app.current_company}` : '',
          expActual ? `Total Experience: ${expActual}` : (expRange ? `Experience Range: ${expRange}` : ''),
          app.middle_east_exp ? `GCC/Middle East Experience: ${app.middle_east_exp}` : '',
          app.nationality    ? `Nationality: ${app.nationality}`  : '',
          app.skills         ? `Skills: ${app.skills}`           : '',
          app.work_history   ? `Work History: ${app.work_history}` : '',
        ].filter(Boolean).join('\n');

        // Try to load CV from storage
        let cvBase64 = null; let cvMediaType = 'application/pdf';
        const cvPath = app.cv_file_path || app.cv_path || null;
        if (cvPath && cvPath.startsWith('applications/')) {
          try {
            const signRes = await fetch(`${SURL2}/storage/v1/object/sign/cv-uploads/${cvPath}`, {
              method:'POST',
              headers:{ 'apikey':SKEY2,'Authorization':`Bearer ${SKEY2}`,'Content-Type':'application/json' },
              body: JSON.stringify({ expiresIn: 120 })
            });
            if (signRes.ok) {
              const { signedURL } = await signRes.json();
              const fullUrl = signedURL.startsWith('http') ? signedURL : `${SURL2}${signedURL}`;
              const dlRes = await fetch(fullUrl);
              if (dlRes.ok) {
                const blob = await dlRes.blob();
                cvBase64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(blob); });
                cvMediaType = blob.type || 'application/pdf';
              }
            }
          } catch(e) { /* fall through to text-only */ }
        }

        const assessPrompt = `You are a senior HR assessor for SATCO Arabia, an engineering & construction company in Abu Dhabi (oil & gas, power, desalination sectors).\n\nASSESS THIS CANDIDATE against the job requirements. Be objective and concise.\n\n=== JOB REQUIREMENTS ===\n${jobContext}\n\nReturn ONLY valid JSON (no markdown):\n{\n  "score": <integer 0-100>,\n  "verdict": "Highly Recommended" | "Recommended" | "Borderline" | "Not Recommended",\n  "strengths": ["strength1","strength2","strength3"],\n  "concerns": ["concern1","concern2"],\n  "actual_experience_years": <number or null>,\n  "relevant_experience_summary": "2-3 sentence summary",\n  "recommendation": "2-3 sentence hiring recommendation"\n}`;

        const userContent = cvBase64
          ? [ { type: cvMediaType.includes('pdf') ? 'document' : 'text',
                ...(cvMediaType.includes('pdf')
                  ? { source: { type:'base64', media_type:'application/pdf', data: cvBase64 } }
                  : { text: candidateProfile }) },
              { type:'text', text: assessPrompt } ]
          : [ { type:'text', text: `${assessPrompt}\n\n=== CANDIDATE PROFILE ===\n${candidateProfile}` } ];

        const res = await fetch(PROXY, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1000, messages:[{ role:'user', content: userContent }] })
        });
        if (!res.ok) throw new Error(`Claude API ${res.status}`);
        const data = await res.json();
        const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
        const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());

        // Patch back to Supabase
        await db.from('job_applications').update({ claude_score: parsed.score, claude_assessment: parsed }).eq('id', app.id);
        return parsed;
      }, [db]);

      // ── Auto-assess any application missing a claude_score ──
      const autoAssessPending = React.useCallback(async (apps, vacs) => {
        const pending = apps.filter(a => a.claude_score == null && a.status !== 'rejected');
        if (pending.length === 0) return;
        // Mark all as assessing
        const idMap = {};
        pending.forEach(a => { idMap[a.id] = true; });
        setAssessingIds(prev => ({...prev, ...idMap}));
        // Run sequentially to avoid rate limit hammering
        for (const app of pending) {
          try {
            const result = await runClaudeAssessmentForApp(app, vacs);
            // Update local state so card refreshes immediately
            setApplications(prev => prev.map(a =>
              a.id === app.id ? {...a, claude_score: result.score, claude_assessment: result} : a
            ));
          } catch(e) {
            // Silent fail per candidate — don't break the rest
            console.warn('Auto-assess failed for', app.id, e.message);
          } finally {
            setAssessingIds(prev => { const n = {...prev}; delete n[app.id]; return n; });
          }
        }
      }, [runClaudeAssessmentForApp]);

      const loadAll = React.useCallback(async (opts = {}) => {
        setLoading(true);
        try {
          const [vRes, aRes] = await Promise.all([
            db.from('job_vacancies').select('*').order('created_at', { ascending: false }),
            db.from('job_applications').select('*').order('created_at', { ascending: false }),
          ]);
          let vacs = [], apps = [];
          if (!vRes.error) { vacs = (vRes.data || []).filter(v => !v.deleted_at); setVacancies(vacs); }
          if (!aRes.error) { apps = (aRes.data || []).filter(a => !a.deleted_at); setApplications(apps); }
          // Auto-assess in background without blocking UI
          if (!opts.skipAutoAssess) {
            autoAssessPending(apps, vacs);
          }
        } catch(e) { showToast('❌ Failed to load: ' + e.message, 'error'); }
        finally { setLoading(false); }
      }, [autoAssessPending, db]);

      React.useEffect(() => { loadAll(); }, [loadAll]);

      // Clear viewApplication when leaving applications tab
      React.useEffect(() => {
        if (activeTab !== 'applications') setViewApplication(null);
      }, [activeTab]);

      // ── Scan Resume Database for candidates matching a specific vacancy ──
      const scanResumeDbForVacancy = React.useCallback(async (vac) => {
        if (!vac) return;
        setMatchingResumeDb(true);
        setResumeDbMatches([]);
        setResumeDbScanned(vac.id);
        try {
          // Load all Resume DB candidates
          const { data: resumeCandidates, error } = await db
            .from('hiring_pipeline')
            .select('*')
            .eq('pipeline_location', 'resume_db');
          if (error) throw new Error(error.message);
          if (!resumeCandidates || resumeCandidates.length === 0) {
            showToast('No candidates in Resume Database to match');
            return;
          }

          const jobContext = `Job Title: ${vac.title}\nDepartment: ${vac.department||''}\nExperience Required: ${vac.experience_required||''}\nRequirements: ${vac.requirements||vac.description||''}`;

          const results = [];
          for (const c of resumeCandidates) {
            try {
              const profile = [
                c.candidate_name ? `Name: ${c.candidate_name}` : '',
                c.current_designation ? `Current Role: ${c.current_designation}` : '',
                c.current_employer ? `Current Employer: ${c.current_employer}` : '',
                c.experience ? `Experience: ${c.experience}` : '',
                c.skills ? `Skills: ${c.skills}` : '',
                c.nationality ? `Nationality: ${c.nationality}` : '',
                c.work_history ? `Work History: ${c.work_history}` : '',
                c.remarks ? `Notes: ${c.remarks}` : '',
              ].filter(Boolean).join('\n');

              const res = await fetch(PROXY, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                  model:'claude-sonnet-4-6', max_tokens:600,
                  messages:[{ role:'user', content:`You are an HR assessor for SATCO Arabia (oil & gas, power, desalination, Abu Dhabi).\n\nScore this Resume Database candidate against the new job vacancy. Be concise.\n\n=== JOB VACANCY ===\n${jobContext}\n\n=== CANDIDATE PROFILE ===\n${profile}\n\nRespond ONLY with valid JSON:\n{"score":<0-100>,"verdict":"Highly Recommended"|"Recommended"|"Borderline"|"Not Recommended","match_reason":"one sentence why they match or don't","key_gap":"main gap if any or null"}` }]
                })
              });
              if (!res.ok) continue;
              const data = await res.json();
              const txt = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
              const parsed = JSON.parse(txt.replace(/\`\`\`json|\`\`\`/g,'').trim());
              if (parsed.score >= 60) { // Only show candidates with ≥60% match
                results.push({ ...c, matchScore: parsed.score, matchVerdict: parsed.verdict, matchReason: parsed.match_reason, matchGap: parsed.key_gap });
              }
            } catch(e) { /* skip individual failures */ }
          }
          // Sort by match score
          results.sort((a,b) => b.matchScore - a.matchScore);
          setResumeDbMatches(results);
          if (results.length === 0) {
            showToast('No Resume DB candidates scored ≥60% for this vacancy');
          } else {
            showToast(`✅ Found ${results.length} matching candidate${results.length>1?'s':''} in Resume Database`);
          }
        } catch(e) {
          showToast('❌ Resume DB scan failed: ' + e.message, 'error');
        } finally { setMatchingResumeDb(false); }
      }, [db]);

      // ── Export Job Vacancies / Applications to Excel ──
      const exportJobVacanciesExcel = React.useCallback(() => {
        const wb = XLSX.utils.book_new();
        const today = new Date().toISOString().slice(0,10);
        // Build appsByVacancy inline to avoid dependency ordering issues
        const appMap = {};
        applications.forEach(a => { if (!appMap[a.vacancy_id]) appMap[a.vacancy_id] = []; appMap[a.vacancy_id].push(a); });
        const vacRows = vacancies.map(v => ({
          'Title': v.title || '', 'Department': v.department || '', 'Location': v.location || '',
          'Status': v.status || '', 'Experience Required': v.experience_required || '',
          'Employment Type': v.employment_type || '', 'Created': v.created_at ? new Date(v.created_at).toLocaleDateString('en-GB') : '',
          'Applications': (appMap[v.id] || []).length,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vacRows.length ? vacRows : [{}]), 'Vacancies');
        const appRows = applications.map(a => ({
          'Name': a.applicant_name || a.full_name || '', 'Applied For': a.vacancy_title || '',
          'Self Score': a.score || '', 'Claude Score': a.claude_score || '', 'Status': a.status || '',
          'Nationality': a.nationality || '', 'Experience': a.actual_experience_years || a.years_experience || '',
          'Current Role': a.current_role || '', 'Current Employer': a.current_employer || a.current_company || '',
          'GCC Exp': a.middle_east_exp || '', 'Skills': a.skills || '',
          'Email': a.email || '', 'Phone': a.phone || '', 'Passport No': a.passport_number || '',
          'Current Location': a.current_location || '', 'Work History': a.work_history || '',
          'Applied On': a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : '',
          'Source': a.source === 'hr_upload' ? 'HR Upload' : 'Careers Website',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appRows.length ? appRows : [{}]), 'Applications');
        XLSX.writeFile(wb, `SATCO_JobVacancies_${today}.xlsx`);
        showToast('\u2705 Job Vacancies & Applications exported to Excel');
      }, [vacancies, applications]);

      React.useEffect(() => {
        const handler = () => exportJobVacanciesExcel();
        window.addEventListener('satco-export-job-vacancies', handler);
        return () => window.removeEventListener('satco-export-job-vacancies', handler);
      }, [exportJobVacanciesExcel]);

      const openNew  = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
      const openEdit = (v) => {
        const defaultBenefits = { salary_range:'', accommodation:'Provided by company', food:'Provided by company', transport:'Provided by company', medical:'Provided by company', air_ticket:'One return ticket per year' };
        setForm({
          title: v.title||'', department: v.department||'', location: v.location||'Abu Dhabi, UAE',
          employment_type: v.employment_type||'Full-Time', salary_range: v.salary_range||'',
          experience_required: v.experience_required||'', description: v.description||'',
          requirements: v.requirements||'', status: v.status||'draft',
          questions: v.questions || null,
          benefits: (typeof v.benefits === 'string' ? JSON.parse(v.benefits) : v.benefits) || defaultBenefits
        });
        setEditingId(v.id); setShowForm(true);
      };

      // --- AI: Generate questions from JD ---
      const generateQuestions = async () => {
        if (!form.title || !form.description) {
          showToast('⚠️ Please enter job title and description first', 'error'); return;
        }
        setGeneratingQ(true);
        try {
          const prompt = `You are an expert HR screener for an Oil & Gas engineering company in UAE (SATCO Arabia).
Generate exactly 10 screening questions for the following job posting. These will be Yes/No questions shown to candidates online.

Use this scoring framework:
- Questions 1-2: Years of experience & directly relevant job experience → 20% and 15% weight respectively  
- Questions 3-7: Core technical skills specific to this role → 10% each (total 50%)
- Questions 8-10: Availability, willingness, and general fit → 5% each (total 15%)

Job Title: ${form.title}
Department: ${form.department || 'Engineering'}
Description: ${form.description}
Requirements: ${form.requirements}

Return ONLY a valid JSON array, no markdown, no explanation. Format:
[
  {"q": "Question text here?", "weight": 20, "category": "experience"},
  {"q": "Question text here?", "weight": 15, "category": "experience"},
  {"q": "...", "weight": 10, "category": "technical"},
  {"q": "...", "weight": 10, "category": "technical"},
  {"q": "...", "weight": 10, "category": "technical"},
  {"q": "...", "weight": 10, "category": "technical"},
  {"q": "...", "weight": 10, "category": "technical"},
  {"q": "...", "weight": 5, "category": "fit"},
  {"q": "...", "weight": 5, "category": "fit"},
  {"q": "...", "weight": 5, "category": "fit"}
]`;

          const res = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
          });
          const data = await res.json();
          const text = data.content?.[0]?.text || '';
          const cleaned = text.replace(/```json|```/g, '').trim();
          const questions = JSON.parse(cleaned);
          if (!Array.isArray(questions) || questions.length !== 10) throw new Error('AI did not return 10 questions');
          setForm(f => ({ ...f, questions }));
          showToast('✅ 10 questions generated — review and edit before publishing');
        } catch(e) {
          showToast('❌ Question generation failed: ' + e.message, 'error');
        } finally { setGeneratingQ(false); }
      };

      const save = async (publishStatus) => {
        if (!form.title.trim()) { showToast('⚠️ Job title is required', 'error'); return; }
        if (publishStatus === 'open' && !form.questions) {
          showToast('⚠️ Generate and review questions before publishing', 'error'); return;
        }
        if (publishStatus === 'open' && form.questions) {
          const totalWeight = form.questions.reduce((s,q) => s + (+q.weight||0), 0);
          if (totalWeight !== 100) {
            showToast(`⚠️ Question weights must total 100% (currently ${totalWeight}%) — adjust weights before publishing`, 'error'); return;
          }
          if (form.questions.some(q => !q.q.trim())) {
            showToast('⚠️ All questions must have text — remove or fill empty questions', 'error'); return;
          }
        }
        setSaving(true);
        try {
          const payload = {
            title:               form.title,
            department:          form.department,
            location:            form.location,
            employment_type:     form.employment_type,
            salary_range:        form.salary_range,
            experience_required: form.experience_required,
            description:         form.description,
            requirements:        form.requirements,
            status:              publishStatus || form.status,
            questions:           form.questions || null,
            benefits:            form.benefits || null,
            updated_at:          new Date().toISOString()
          };
          const { error: saveErr } = editingId
            ? await db.from('job_vacancies').update(payload).eq('id', editingId)
            : await db.from('job_vacancies').insert(payload);
          if (saveErr) throw new Error(saveErr.message);
          showToast(publishStatus === 'open'
            ? '🚀 Vacancy published — now live on website!'
            : '💾 Saved as draft');
          setShowForm(false); setEditingId(null); loadAll();
        } catch(e) { showToast('❌ Save failed: ' + e.message, 'error'); }
        finally { setSaving(false); }
      };

      const toggleStatus = async (v) => {
        if (v.status !== 'open' && !v.questions) {
          showToast('⚠️ Cannot publish — questions not generated yet. Edit the vacancy first.', 'error'); return;
        }
        const newStatus = v.status === 'open' ? 'closed' : 'open';
        try {
          const { error: toggleErr } = await db.from('job_vacancies').update({ status: newStatus }).eq('id', v.id);
          if (toggleErr) throw new Error(toggleErr.message);
          showToast(newStatus === 'open' ? '✅ Vacancy reopened — live on website' : '🔒 Vacancy closed');
          loadAll();
        } catch(e) { showToast('❌ ' + e.message, 'error'); }
      };

      const deleteVacancy = async (v) => {
        if (!confirm(`Delete "${v.title}"? It will be moved to the Recycle Bin for 30 days before being permanently removed.`)) return;
        try {
          const mode = await softDeleteRow(user, 'job_vacancies', v.id, v.title);
          showToast(mode === 'soft' ? '🗑️ Vacancy moved to Recycle Bin' : '🗑️ Vacancy deleted'); loadAll();
        } catch(e) { showToast('❌ ' + e.message, 'error'); }
      };

      const updateAppStatus = async (id, status) => {
        try {
          await db.from('job_applications').update({ status }).eq('id', id);
          showToast(`✅ Marked as ${status}`); loadAll();
        } catch(e) { showToast('❌ ' + e.message, 'error'); }
      };

      const deleteApplication = async (a) => {
        const name = a.applicant_name || a.full_name || 'this applicant';
        if (!confirm(`Delete application from ${name}? It will be moved to the Recycle Bin for 30 days before being permanently removed.`)) return;
        try {
          const mode = await softDeleteRow(user, 'job_applications', a.id, name);
          showToast(mode === 'soft' ? `🗑️ Application from ${name} moved to Recycle Bin` : `🗑️ Application from ${name} deleted`); loadAll();
        } catch(e) { showToast('❌ Delete failed: ' + e.message, 'error'); }
      };

      const downloadCV = (path) => {
        if (!path) { showToast('No CV for this applicant', 'error'); return; }
        window.open(`${SURL}/storage/v1/object/cv-uploads/${path}?token=${SKEY}`, '_blank');
      };

      // ── Duplicate detection — checks email, phone, passport, fuzzy name ──
      const checkDuplicateCandidate = async (a) => {
        const name    = a.applicant_name || a.full_name || '';
        const email   = (a.email   || '').trim().toLowerCase();
        const phone   = (a.phone   || '').replace(/\D/g,'');
        const passport= (a.passport_number || a.passport_no || '').trim().toUpperCase();

        // 1️⃣ Check hiring_pipeline table
        const { data: pipeRows } = await db.from('hiring_pipeline')
          .select('id, candidate_name, position, pipeline_location, status, created_at, email, phone, passport_no');
        const existing = (pipeRows || []).filter(r => {
          if (email   && r.email   && r.email.toLowerCase()   === email)   return true;
          if (phone   && r.phone   && r.phone.replace(/\D/g,'') === phone) return true;
          if (passport&& r.passport_no && r.passport_no.toUpperCase() === passport) return true;
          return false;
        });

        // 2️⃣ Check job_applications table (same person applied to another vacancy)
        const { data: appRows } = await db.from('job_applications')
          .select('id, applicant_name, vacancy_title, score, created_at, email, phone, passport_number')
          .neq('id', a.id || 0);
        const dupApps = (appRows || []).filter(r => {
          if (email   && r.email            && r.email.toLowerCase()           === email)   return true;
          if (phone   && r.phone            && r.phone.replace(/\D/g,'')       === phone)   return true;
          if (passport&& r.passport_number  && r.passport_number.toUpperCase() === passport) return true;
          return false;
        });

        if (existing.length === 0 && dupApps.length === 0) return null; // no duplicate

        // Build human-readable summary
        const lines = [];
        existing.forEach(r => {
          const loc  = r.pipeline_location === 'resume_db' ? '🗄️ Resume Database' : '🧑‍💼 Hiring Pipeline';
          const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '—';
          lines.push(`• ${loc}: applied for "${r.position||'—'}" (status: ${r.status||'—'}, added: ${date})`);
        });
        dupApps.forEach(r => {
          const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '—';
          lines.push(`• 📋 Job Vacancies: applied for "${r.vacancy_title||'—'}" with score ${r.score||0}% (applied: ${date})`);
        });
        return { existing, dupApps, summary: lines.join('\n') };
      };

      // Turn a full Claude assessment object into a readable multi-paragraph note so nothing
      // (verdict, summary, strengths, concerns, recommendation) is lost when a candidate moves
      // out of Job Vacancies. hiring_pipeline has no dedicated JSON column for this, only free
      // text (interview_notes / remarks), so the full assessment is serialized as readable text
      // instead of being squashed into a one-line summary.
      const formatClaudeAssessmentNote = (ca, extra) => {
        if (!ca || typeof ca !== 'object' || Object.keys(ca).length === 0) return extra || null;
        const parts = [];
        if (ca.verdict) parts.push(`Verdict: ${ca.verdict}`);
        if (ca.score != null) parts.push(`Claude AI Score: ${ca.score}%`);
        if (ca.summary || ca.assessment) parts.push(`Summary: ${ca.summary || ca.assessment}`);
        if (Array.isArray(ca.strengths) && ca.strengths.length) parts.push(`Strengths:\n- ${ca.strengths.join('\n- ')}`);
        if (Array.isArray(ca.concerns) && ca.concerns.length) parts.push(`Concerns:\n- ${ca.concerns.join('\n- ')}`);
        if (ca.recommendation) parts.push(`Recommendation: ${ca.recommendation}`);
        if (ca.actual_experience_years != null) parts.push(`Actual Experience (AI-assessed): ${ca.actual_experience_years} years`);
        if (ca.relevant_experience_summary) parts.push(`Relevant Experience: ${ca.relevant_experience_summary}`);
        if (!parts.length) return extra || null;
        const text = parts.join('\n\n');
        return [extra, '— Claude AI Assessment (from Job Vacancies) —\n' + text].filter(Boolean).join('\n\n');
      };

      // ── Push qualified applicant → hiring_pipeline ──────────────────────
      const sendToHiringPipeline = async (a) => {
        const name = a.applicant_name || a.full_name || 'this candidate';
        try {
          const expRange  = a.years_experience || a.experience_years || '';
          const expActual = a.actual_experience_years ? `${a.actual_experience_years} years` : '';

          // ── Duplicate check (email / phone / passport) ──
          const dup = await checkDuplicateCandidate(a);
          if (dup) {
            const proceed = window.confirm(
              `⚠️ DUPLICATE DETECTED — ${name}\n\nThis candidate already exists in the system:\n\n${dup.summary}\n\n─────────────────────────────\nDo you still want to add them to the Hiring Pipeline?\n(Click OK to proceed anyway, Cancel to abort)`
            );
            if (!proceed) { showToast('ℹ️ Action cancelled — candidate already exists', 'error'); return; }
          }
          // Pull Claude assessment scores if available
          const ca = a.claude_assessment ? (typeof a.claude_assessment === 'string' ? (() => { try { return JSON.parse(a.claude_assessment); } catch { return {}; } })() : a.claude_assessment) : {};
          const baseNoteA = `From Job Vacancies portal. Self-score: ${a.score || 0}% (${(a.qualified || (a.score||0)>=75) ? 'QUALIFIED' : 'BELOW THRESHOLD'}).`
            + (a.skills ? ` Skills: ${a.skills}` : '');
          const scoreNote = formatClaudeAssessmentNote(ca, baseNoteA) || baseNoteA;
          // CV: prefer cv_file_path (Supabase Storage), fall back to cv_path
          const cvStoragePath = a.cv_file_path || a.cv_path || null;
          const payload = {
            candidate_name:            name,
            email:                     a.email || '',
            phone:                     a.phone || '',
            nationality:               a.nationality || '',
            current_location:          a.current_location || '',
            experience:                expActual || expRange || '',
            skills:                    a.skills || '',
            current_designation:       a.current_role || a.current_designation || '',
            current_employer:          a.current_employer || a.current_company || '',
            passport_no:               a.passport_number || a.passport_no || '',
            passport_expiry_candidate: a.passport_expiry ? new Date(a.passport_expiry).toISOString().split('T')[0] : null,
            work_history:              a.work_history || null,
            education:                 a.education || null,
            marital_status:            a.marital_status || null,
            religion:                  a.religion || null,
            languages:                 a.languages || null,
            home_address:              a.home_address || null,
            dob_candidate:             a.dob || a.dob_candidate ? (() => { try { return new Date(a.dob||a.dob_candidate).toISOString().split('T')[0]; } catch { return null; } })() : null,
            me_experience:             a.middle_east_exp || a.me_experience || null,
            position:                  a.vacancy_title || a.position || '',
            status:                    'Screening',
            step:                      'Offer Pending',
            hiring_scenario:           'S3',
            pipeline_location:         'pipeline',
            // CV — store Supabase Storage path so CV viewer can load the original file
            resume_url:                cvStoragePath ? `cv-uploads::${cvStoragePath}` : null,
            // Claude AI assessment data carried over
            interview_score:           a.claude_score != null ? Math.round(a.claude_score * 30 / 100) : null,
            interview_verdict:         ca.verdict || null,
            interview_notes:           scoreNote,
            // Individual Claude sub-scores mapped to interview score columns
            interview_score_technical: ca.technical_score != null ? ca.technical_score : (ca.scores?.technical ?? null),
            interview_score_exp:       ca.experience_score != null ? ca.experience_score : (ca.scores?.experience ?? null),
            interview_score_comm:      ca.communication_score != null ? ca.communication_score : (ca.scores?.communication ?? null),
            interview_score_safety:    ca.safety_score != null ? ca.safety_score : (ca.scores?.safety ?? null),
            interview_score_attitude:  ca.attitude_score != null ? ca.attitude_score : (ca.scores?.attitude ?? null),
            interview_score_docs:      ca.docs_score != null ? ca.docs_score : (ca.scores?.docs ?? null),
            remarks:                   scoreNote,
          };
          const { error: insErr } = await dbSaveWithRetry('hiring_pipeline', payload);
          if (insErr) throw new Error(insErr.message);
          // Mark application as moved so it no longer shows in active Job Vacancies list —
          // set all three flags the list filter checks (status/pipeline_location/moved_to_pipeline)
          // so it's hidden reliably even if one of these columns isn't in use on this schema.
          await db.from('job_applications').update({ status: 'shortlisted', pipeline_location: 'hiring_pipeline', moved_to_pipeline: true }).eq('id', a.id);
          showToast(`✅ ${name} sent to Hiring Pipeline — go to 🧑‍💼 Hiring tab`);
          onClose();
          loadAll();
        } catch(e) { showToast('❌ Failed: ' + e.message, 'error'); }
      };

      const catColor = { experience: '#dbeafe', technical: '#dcfce7', fit: '#fef9c3' };
      const catLabel = { experience: '⭐ Experience', technical: '🔧 Technical', fit: '✅ Fit' };

      const S = {
        card:    { background:'#fff', borderRadius:'12px', padding:'18px 22px', marginBottom:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)', border:'1px solid var(--bd5)' },
        statusBadge: (st) => ({ display:'inline-block', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700,
          background: st==='open'?'#dcfce7':st==='closed'?'#fee2e2':st==='draft'?'#f1f5f9':'#fef9c3',
          color:      st==='open'?'#166534':st==='closed'?'#991b1b':st==='draft'?'#475569':'#854d0e' }),
        scoreBadge: (score) => ({ display:'inline-block', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700,
          background: score >= 75 ? '#dcfce7' : '#fee2e2',
          color:      score >= 75 ? '#166534' : '#991b1b' }),
        label:   { fontSize:'12px', fontWeight:600, color:'#64748b', marginBottom:'4px', display:'block' },
        input:   { width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--bd2)', fontSize:'13px', boxSizing:'border-box' },
        textarea:{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--bd2)', fontSize:'13px', boxSizing:'border-box', minHeight:'90px', resize:'vertical' },
        btn:     (col) => ({ padding:'9px 20px', borderRadius:'8px', border:'none', fontWeight:700, fontSize:'15px', cursor:'pointer',
          background: col==='blue'?'#1a5fa8':col==='green'?'#16a34a':col==='red'?'#dc2626':col==='orange'?'#ea580c':col==='grey'?'#6b7280':'#e2e8f0',
          color: col&&col!=='light'?'#fff':'#334155' }),
        tabBtn:  (a) => ({ padding:'9px 22px', borderRadius:'8px', border:'none', fontWeight:700, fontSize:'15px', cursor:'pointer', background: a?'#1a5fa8':'#e2e8f0', color: a?'#fff':'#334155' }),
      };

      const appsByVacancy = React.useMemo(() => {
        const m = {};
        applications.forEach(a => { if (!m[a.vacancy_id]) m[a.vacancy_id] = []; m[a.vacancy_id].push(a); });
        return m;
      }, [applications]);

      const filteredApps = React.useMemo(() => {
        // Apply vacancy filter first
        let r = applications;
        if (vacancyFilter === '__unsolicited__') {
          r = r.filter(a => !a.vacancy_id);
        } else if (vacancyFilter !== 'all') {
          r = r.filter(a => a.vacancy_id === vacancyFilter);
        }
        // Exclude candidates already moved to Resume DB or Hiring Pipeline
        r = r.filter(a => a.status !== 'shortlisted' && !a.moved_to_pipeline && !a.moved_to_resume_db && a.pipeline_location !== 'hiring_pipeline' && a.pipeline_location !== 'resume_db');
        // Apply score/status filter
        if (appliFilter === 'all' || appliFilter === 'all_v') r = r.filter(a => a.status !== 'rejected');
        else if (appliFilter === 'pass' || appliFilter === 'pass_v') r = r.filter(a => (a.score || 0) >= 75 && a.status !== 'rejected');
        else if (appliFilter === 'hold' || appliFilter === 'hold_v') r = r.filter(a => (a.score || 0) < 75 && a.status !== 'rejected');
        else if (appliFilter === 'short_v') r = r.filter(a => a.status === 'shortlisted');
        else if (appliFilter === 'rejected') r = r.filter(a => a.status === 'rejected');
        else r = r.filter(a => a.status === appliFilter);
        return r;
      }, [applications, appliFilter, vacancyFilter]);

      // ── sortedApps / navList — component-level so overlay can access them ──
      const sortedApps = React.useMemo(() => {
        return [...filteredApps].sort((a, b) => {
          const aScore = a.claude_score != null ? a.claude_score : (a.score || 0);
          const bScore = b.claude_score != null ? b.claude_score : (b.score || 0);
          return bScore - aScore;
        });
      }, [filteredApps]);
      const navList = sortedApps;

      // ── ClaudeAssessmentPanel — right-pane detail view ──
      // Memoised: this was previously a fresh function on every JobVacanciesView render (the
      // whole app re-renders once a second from the header clock, which cascades all the way
      // down here). Since React treats <ClaudeAssessmentPanel/> as a different component type
      // whenever its reference changes, the open panel was unmounting/remounting every
      // ~second — resetting the profile/screening/claude tab selection, wiping an in-progress
      // Claude assessment run, and cancelling PDF generation before it could finish. Only
      // redefine it when the data it actually depends on changes.
      const ClaudeAssessmentPanel = React.useCallback(({ a, name, cvPath, cvName, expRange, expActual, role, skills,
        passport, passExp, meExp, workRaw, workLines, score, qualified, answers, isHrUpload,
        SectionHead, Row, onClose }) => {
            const [detailTab, setDetailTab] = React.useState('profile'); // profile | screening | claude
            const [claudeRunning, setClaudeRunning] = React.useState(false);
            const [claudeResult, setClaudeResult] = React.useState(
              a.claude_assessment ? (typeof a.claude_assessment === 'string' ? JSON.parse(a.claude_assessment) : a.claude_assessment) : null
            );
            const [claudeScore, setClaudeScore] = React.useState(a.claude_score != null ? a.claude_score : null);
            const [pdfGenerating, setPdfGenerating] = React.useState(false);

            const generateCandidatePdf = async () => {
              setPdfGenerating(true);
              try {
                const { PDFDocument, rgb, StandardFonts, PageSizes } = PDFLib;
                const pdfDoc = await PDFDocument.create();
                const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                const fontI = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

                const PW = 595.28; // A4
                const PH = 841.89;
                const ML = 45, MR = 45, MT = 50;
                const TW = PW - ML - MR;

                // Colours
                const NAVY  = rgb(0.059, 0.153, 0.267);   // #0f2744
                const TEAL  = rgb(0.024, 0.369, 0.502);   // #065e80
                const GREEN = rgb(0.086, 0.647, 0.239);   // #16a34a
                const AMBER = rgb(0.851, 0.608, 0.0);     // #d97706
                const RED   = rgb(0.863, 0.157, 0.157);   // #dc2626
                const BLUE  = rgb(0.145, 0.373, 0.659);   // #2563eb
                const LGRAY = rgb(0.949, 0.953, 0.961);   // #f1f5f9
                const MGRAY = rgb(0.396, 0.455, 0.514);   // #64748b
                const DGRAY = rgb(0.059, 0.090, 0.161);   // #0f172a
                const WHITE = rgb(1, 1, 1);
                const PURPL = rgb(0.486, 0.275, 0.933);   // #7c3aed

                let page, y;

                const addPage = () => {
                  page = pdfDoc.addPage([PW, PH]);
                  y = PH - MT;
                  // Footer rule + text every page
                  page.drawLine({ start:{x:ML,y:28}, end:{x:PW-MR,y:28}, thickness:0.5, color:MGRAY });
                  page.drawText('SATCO Arabia General Contracting LLC  \u2022  satcoarabiaengg.com  \u2022  CONFIDENTIAL', { x:ML, y:16, size:7, font:fontR, color:MGRAY });
                  page.drawText(`Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`, { x:PW-MR-80, y:16, size:7, font:fontR, color:MGRAY });
                };

                const drawText = (text, x, yy, opts={}) => {
                  const { size=10, font:f=fontR, color:c=DGRAY, maxWidth, align='left' } = opts;
                  if (!text) return;
                  const safeText = String(text).replace(/[\u2014]/g,'--').replace(/[\u2013]/g,'-').replace(/[\u2022]/g,'*').replace(/[^\x00-\xFF]/g,'?');
                  if (maxWidth) {
                    // Word-wrap
                    const words = safeText.split(' ');
                    let line = '';
                    let ly = yy;
                    for (const w of words) {
                      const test = line ? line + ' ' + w : w;
                      const tw = f.widthOfTextAtSize(test, size);
                      if (tw > maxWidth && line) {
                        page.drawText(line, {x, y:ly, size, font:f, color:c});
                        ly -= size * 1.45;
                        line = w;
                      } else { line = test; }
                    }
                    if (line) page.drawText(line, {x, y:ly, size, font:f, color:c});
                    return yy - ly + size * 1.45;
                  }
                  const textToDraw = align === 'right' ? safeText : safeText;
                  const xPos = align === 'right' ? x - f.widthOfTextAtSize(safeText, size) : x;
                  page.drawText(textToDraw, { x:xPos, y:yy, size, font:f, color:c });
                  return size * 1.45;
                };

                const drawRect = (x, yy, w, h, color, opts={}) => {
                  page.drawRectangle({ x, y:yy, width:w, height:h, color, borderColor:opts.border, borderWidth:opts.borderWidth||0, opacity:opts.opacity||1 });
                };

                const sectionHeading = (label, yy) => {
                  drawRect(ML, yy-2, TW, 18, NAVY);
                  page.drawText(label.toUpperCase(), { x:ML+8, y:yy+3, size:8.5, font:fontB, color:WHITE });
                  return yy - 22;
                };

                const labelValue = (label, value, yy, opts={}) => {
                  if (!value) return yy;
                  const lw = 130;
                  page.drawText(label + ':', { x:ML, y:yy, size:9, font:fontB, color:MGRAY });
                  const vFont = opts.italic ? fontI : fontR;
                  const wrapped = drawText(String(value), ML+lw, yy, { size:9, font:vFont, color:DGRAY, maxWidth:TW-lw });
                  const lineH = Math.max(wrapped || 13, 13);
                  page.drawLine({ start:{x:ML,y:yy-3}, end:{x:PW-MR,y:yy-3}, thickness:0.3, color:rgb(0.9,0.9,0.9) });
                  return yy - lineH - 4;
                };

                // ═══════════════════════════════════════════════════
                // PAGE 1 — HEADER + PROFILE
                // ═══════════════════════════════════════════════════
                addPage();

                // Top banner
                drawRect(0, PH-80, PW, 80, NAVY);
                // SATCO branding
                page.drawText('SATCO ARABIA', { x:ML, y:PH-38, size:20, font:fontB, color:WHITE });
                page.drawText('GENERAL CONTRACTING LLC', { x:ML, y:PH-54, size:10, font:fontR, color:rgb(0.7,0.85,1) });
                page.drawText('CANDIDATE ASSESSMENT REPORT', { x:ML, y:PH-69, size:8, font:fontI, color:rgb(0.6,0.75,0.95) });

                // Document tag top-right
                const docLabel = 'CONFIDENTIAL';
                const dlw = fontB.widthOfTextAtSize(docLabel, 8);
                drawRect(PW-MR-dlw-16, PH-50, dlw+16, 18, rgb(0.8,0,0));
                page.drawText(docLabel, { x:PW-MR-dlw-8, y:PH-45, size:8, font:fontB, color:WHITE });

                y = PH - 95;

                // Candidate name block
                drawRect(ML, y-44, TW, 50, LGRAY);
                page.drawText(name, { x:ML+12, y:y-20, size:17, font:fontB, color:NAVY });
                const subtitle = [role, (a.current_employer||a.current_company)].filter(Boolean).join('  \u2022  ');
                if (subtitle) page.drawText(subtitle.replace(/\u2022/g,'*'), { x:ML+12, y:y-36, size:10, font:fontR, color:TEAL });
                // Nationality pill
                if (a.nationality) {
                  const nw = fontR.widthOfTextAtSize(a.nationality, 9) + 16;
                  drawRect(PW-MR-nw-4, y-38, nw, 16, NAVY);
                  page.drawText(a.nationality, { x:PW-MR-nw+4, y:y-33, size:9, font:fontB, color:WHITE });
                }
                y -= 58;

                // Score badges row
                const drawBadge = (label, value, bx, by, bColor) => {
                  const bw = 110;
                  drawRect(bx, by-32, bw, 36, bColor);
                  page.drawText(label, { x:bx+8, y:by-14, size:7.5, font:fontR, color:WHITE });
                  page.drawText(String(value), { x:bx+8, y:by-27, size:11, font:fontB, color:WHITE });
                };
                drawBadge('Self-Reported Score', score + '%', ML, y, score>=75?GREEN:AMBER);
                if (claudeResult) {
                  drawBadge('Claude AI Score', claudeResult.score + '%', ML+116, y, claudeResult.score>=75?PURPL:MGRAY);
                  drawBadge('Verdict', claudeResult.verdict||'', ML+232, y, NAVY);
                }
                y -= 44;

                // ── PROFILE section
                y = sectionHeading('Candidate Profile', y);
                y -= 4;
                y = labelValue('Applied For', a.vacancy_title || '—', y);
                y = labelValue('Applied On', new Date(a.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}), y);
                y = labelValue('Application Source', isHrUpload ? 'HR Team Upload' : 'Careers Website', y);
                y = labelValue('Current Role', role, y);
                y = labelValue('Current Employer', a.current_employer || a.current_company, y);
                y = labelValue('Total Experience', expActual || expRange, y);
                y = labelValue('GCC / UAE Experience', meExp === 'yes' ? 'Yes - has worked in Middle East/GCC' : meExp === 'no' ? 'No - no Middle East experience' : null, y);
                y = labelValue('Current Location', a.current_location, y);
                y -= 10;

                // ── CONTACT
                y = sectionHeading('Contact Information', y);
                y -= 4;
                y = labelValue('Email', a.email, y);
                y = labelValue('Phone / WhatsApp', a.phone, y);
                y = labelValue('Passport No.', passport, y);
                y = labelValue('Passport Expiry', passExp, y);
                y -= 10;

                // ── SKILLS
                if (skills) {
                  y = sectionHeading('Key Skills', y);
                  y -= 4;
                  const skillList = skills.split(',').map(s => s.trim()).filter(Boolean);
                  let sx = ML; let sy = y - 2;
                  for (const sk of skillList) {
                    const sw = fontR.widthOfTextAtSize(sk, 8.5) + 14;
                    if (sx + sw > PW - MR) { sx = ML; sy -= 18; }
                    drawRect(sx, sy-12, sw, 16, rgb(0.937,0.953,1));
                    page.drawRectangle({ x:sx, y:sy-12, width:sw, height:16, borderColor:rgb(0.749,0.855,1), borderWidth:0.6, color:rgb(0.937,0.953,1) });
                    page.drawText(sk, { x:sx+7, y:sy-5, size:8.5, font:fontR, color:BLUE });
                    sx += sw + 6;
                  }
                  y = sy - 22;
                }

                // ── WORK HISTORY
                if (workLines.length > 0) {
                  if (y < 160) { addPage(); y = PH - MT - 10; }
                  y = sectionHeading('Work History', y);
                  y -= 4;
                  // Header row
                  drawRect(ML, y-16, TW, 18, rgb(0.22, 0.22, 0.22));
                  page.drawText('Company', { x:ML+6, y:y-11, size:8, font:fontB, color:WHITE });
                  page.drawText('Role', { x:ML+200, y:y-11, size:8, font:fontB, color:WHITE });
                  page.drawText('Period', { x:ML+390, y:y-11, size:8, font:fontB, color:WHITE });
                  y -= 20;
                  workLines.forEach((line, wi) => {
                    const parts = line.split('|').map(p => p.trim());
                    const bg = wi%2===0 ? WHITE : rgb(0.973,0.976,0.984);
                    drawRect(ML, y-14, TW, 17, bg);
                    page.drawText((parts[0]||line).slice(0,32).replace(/[^ -ÿ]/g,'?'), { x:ML+6, y:y-9, size:8.5, font:fontB, color:DGRAY });
                    page.drawText((parts[1]||'').slice(0,30).replace(/[^ -ÿ]/g,'?'), { x:ML+200, y:y-9, size:8.5, font:fontR, color:MGRAY });
                    page.drawText((parts[2]||'').slice(0,20).replace(/[^ -ÿ]/g,'?'), { x:ML+390, y:y-9, size:8.5, font:fontR, color:MGRAY });
                    y -= 17;
                  });
                }

                // ═══════════════════════════════════════════════════
                // PAGE 2 — CLAUDE AI ASSESSMENT
                // ═══════════════════════════════════════════════════
                if (claudeResult) {
                  addPage();
                  // Page title
                  drawRect(0, PH-60, PW, 60, PURPL);
                  page.drawText('CLAUDE AI ASSESSMENT', { x:ML, y:PH-32, size:16, font:fontB, color:WHITE });
                  page.drawText(`${name}  \u2022  ${a.vacancy_title||'Role'}`.replace(/\u2022/g,'*'), { x:ML, y:PH-50, size:9.5, font:fontR, color:rgb(0.85,0.8,1) });
                  y = PH - 76;

                  // Score + verdict banner
                  const vColor = { 'Highly Recommended':GREEN, 'Recommended':BLUE, 'Borderline':AMBER, 'Not Recommended':RED }[claudeResult.verdict] || MGRAY;
                  drawRect(ML, y-50, TW/2-6, 54, PURPL);
                  page.drawText('AI SCORE', { x:ML+12, y:y-16, size:8, font:fontR, color:rgb(0.85,0.8,1) });
                  page.drawText(claudeResult.score + '%', { x:ML+12, y:y-38, size:26, font:fontB, color:WHITE });

                  drawRect(ML+TW/2+6, y-50, TW/2-6, 54, vColor);
                  page.drawText('VERDICT', { x:ML+TW/2+18, y:y-16, size:8, font:fontR, color:WHITE });
                  const vLines = (claudeResult.verdict||'').split(' ');
                  page.drawText(vLines[0]||'', { x:ML+TW/2+18, y:y-32, size:14, font:fontB, color:WHITE });
                  if (vLines[1]) page.drawText(vLines.slice(1).join(' '), { x:ML+TW/2+18, y:y-46, size:14, font:fontB, color:WHITE });

                  // Self-reported vs Claude comparison
                  y -= 62;
                  drawRect(ML, y-24, TW, 28, LGRAY);
                  page.drawText('Self-Reported Score:', { x:ML+12, y:y-12, size:9, font:fontR, color:MGRAY });
                  page.drawText(score + '%', { x:ML+130, y:y-12, size:9, font:fontB, color:DGRAY });
                  const diff = claudeResult.score - score;
                  const diffLabel = diff > 0 ? `Claude rates +${diff}% higher than self-assessment` : diff < 0 ? `Claude rates ${Math.abs(diff)}% lower than self-assessment` : 'Claude and self-assessment scores match';
                  page.drawText(diffLabel, { x:ML+180, y:y-12, size:9, font:fontI, color: diff>0?GREEN:diff<0?RED:MGRAY });
                  y -= 36;

                  // Recommendation
                  y = sectionHeading('Hiring Recommendation', y);
                  y -= 6;
                  if (claudeResult.recommendation) {
                    const h = drawText(claudeResult.recommendation, ML, y, { size:10, font:fontI, color:DGRAY, maxWidth:TW });
                    y -= (h || 14) + 8;
                  }
                  y -= 4;

                  // Relevant experience
                  if (claudeResult.relevant_experience_summary) {
                    y = sectionHeading('Experience Assessment', y);
                    y -= 6;
                    const h = drawText(claudeResult.relevant_experience_summary, ML, y, { size:10, font:fontR, color:DGRAY, maxWidth:TW });
                    y -= (h || 14) + 4;
                    if (claudeResult.actual_experience_years) {
                      y = labelValue('Estimated Experience', claudeResult.actual_experience_years + ' years', y);
                    }
                    y -= 8;
                  }

                  // Strengths & Concerns — two columns
                  if (y < 200) { addPage(); y = PH - MT - 10; }
                  const colW = (TW - 12) / 2;

                  // Left: Strengths
                  let ly = y;
                  drawRect(ML, ly-18, colW, 20, GREEN);
                  page.drawText('STRENGTHS', { x:ML+8, y:ly-12, size:9, font:fontB, color:WHITE });
                  ly -= 24;
                  (claudeResult.strengths || []).forEach((s, si) => {
                    drawRect(ML, ly-(si===0?0:0)-14, colW, 16, si%2===0?rgb(0.94,1,0.96):WHITE);
                    const sh = drawText('* ' + s, ML+8, ly-9, { size:8.5, font:fontR, color:rgb(0.08,0.32,0.12), maxWidth:colW-16 });
                    ly -= (sh||12) + 5;
                  });

                  // Right: Concerns
                  let ry = y;
                  const rx = ML + colW + 12;
                  drawRect(rx, ry-18, colW, 20, RED);
                  page.drawText('CONCERNS', { x:rx+8, y:ry-12, size:9, font:fontB, color:WHITE });
                  ry -= 24;
                  if ((claudeResult.concerns||[]).length === 0) {
                    drawRect(rx, ry-14, colW, 16, LGRAY);
                    page.drawText('No significant concerns noted', { x:rx+8, y:ry-9, size:8.5, font:fontI, color:MGRAY });
                    ry -= 18;
                  } else {
                    (claudeResult.concerns || []).forEach((c, ci) => {
                      drawRect(rx, ry-14, colW, 16, ci%2===0?rgb(1,0.96,0.96):WHITE);
                      const ch = drawText('* ' + c, rx+8, ry-9, { size:8.5, font:fontR, color:rgb(0.5,0.08,0.08), maxWidth:colW-16 });
                      ry -= (ch||12) + 5;
                    });
                  }
                  y = Math.min(ly, ry) - 10;
                } // end claudeResult

                // ═══════════════════════════════════════════════════
                // PAGE 3 — SCREENING Q&A (if any)
                // ═══════════════════════════════════════════════════
                if (answers.length > 0) {
                  addPage();
                  drawRect(0, PH-60, PW, 60, TEAL);
                  page.drawText('SELF-REPORTED SCREENING ANSWERS', { x:ML, y:PH-32, size:15, font:fontB, color:WHITE });
                  page.drawText(`${name}  *  ${a.vacancy_title||'Role'}`, { x:ML, y:PH-50, size:9.5, font:fontR, color:rgb(0.8,0.94,1) });
                  y = PH - 76;

                  // Score summary
                  drawRect(ML, y-30, TW, 34, LGRAY);
                  page.drawText('Self-Reported Score:', { x:ML+12, y:y-14, size:9, font:fontR, color:MGRAY });
                  page.drawText(score + '%', { x:ML+130, y:y-14, size:11, font:fontB, color:score>=75?GREEN:AMBER });
                  page.drawText(score>=75 ? 'QUALIFIED' : 'BELOW THRESHOLD', { x:ML+165, y:y-14, size:9, font:fontB, color:score>=75?GREEN:AMBER });
                  page.drawText('Note: Answers are self-reported by the candidate', { x:PW-MR-250, y:y-14, size:8, font:fontI, color:MGRAY });
                  y -= 42;

                  answers.forEach((ans, ai) => {
                    if (y < 80) { addPage(); y = PH - MT - 10; }
                    const isYes = ans.answer === 'yes';
                    drawRect(ML, y-36, TW, 40, isYes ? rgb(0.94,1,0.96) : rgb(1,0.96,0.96));
                    page.drawRectangle({ x:ML, y:y-36, width:TW, height:40, borderColor:isYes?GREEN:RED, borderWidth:0.5, color:isYes?rgb(0.94,1,0.96):rgb(1,0.96,0.96) });
                    // Q number pill
                    drawRect(ML, y-36, 28, 40, isYes?GREEN:RED);
                    page.drawText('Q'+(ai+1), { x:ML+6, y:y-20, size:10, font:fontB, color:WHITE });
                    // Question
                    const qText = String(ans.question||'').replace(/[^ -ÿ]/g,'?');
                    const qLines = [];
                    const qWords = qText.split(' ');
                    let ql = '';
                    for (const w of qWords) {
                      const test = ql ? ql+' '+w : w;
                      if (fontR.widthOfTextAtSize(test, 9) > TW-80) { qLines.push(ql); ql=w; } else ql=test;
                    }
                    if (ql) qLines.push(ql);
                    page.drawText(qLines[0]||'', { x:ML+34, y:y-14, size:9, font:fontR, color:DGRAY });
                    if (qLines[1]) page.drawText(qLines[1], { x:ML+34, y:y-25, size:9, font:fontR, color:DGRAY });
                    // Answer
                    const ansLabel = isYes ? 'YES' : 'NO';
                    page.drawText(ansLabel, { x:PW-MR-38, y:y-14, size:10, font:fontB, color:isYes?GREEN:RED });
                    if (ans.weight) page.drawText('('+ans.weight+'%)', { x:PW-MR-38, y:y-26, size:8, font:fontR, color:MGRAY });
                    y -= 46;
                  });
                }

                // ═══════════════════════════════════════════════════
                // APPENDIX — Append the original resume PDF if available
                // ═══════════════════════════════════════════════════
                const cvPathForPdf = cvPath;
                if (cvPathForPdf) {
                  try {
                    const SURL2 = 'https://oaerqjrkdpuhiproppaz.supabase.co';
                    const SKEY2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI';
                    // Strip any cv-uploads:: prefix if present (from hiring_pipeline resume_url format)
                    const cleanPath = cvPathForPdf.replace(/^cv-uploads::/, '');
                    const signRes = await fetch(`${SURL2}/storage/v1/object/sign/cv-uploads/${cleanPath}`, {
                      method:'POST',
                      headers:{ 'apikey':SKEY2, 'Authorization':`Bearer ${SKEY2}`, 'Content-Type':'application/json' },
                      body: JSON.stringify({ expiresIn:120 })
                    });
                    if (signRes.ok) {
                      const { signedURL } = await signRes.json();
                      const fullUrl = signedURL.startsWith('http') ? signedURL : `${SURL2}${signedURL}`;
                      const dlRes = await fetch(fullUrl);
                      if (dlRes.ok) {
                        const blob = await dlRes.blob();
                        const arrBuf = await blob.arrayBuffer();
                        // Appendix divider page
                        addPage();
                        drawRect(0, PH/2-40, PW, 80, NAVY);
                        page.drawText('APPENDIX', { x:ML, y:PH/2+16, size:10, font:fontR, color:rgb(0.6,0.75,0.95) });
                        page.drawText('ORIGINAL RESUME / CV', { x:ML, y:PH/2-4, size:18, font:fontB, color:WHITE });
                        page.drawText(name, { x:ML, y:PH/2-24, size:10, font:fontR, color:rgb(0.7,0.85,1) });

                        // Try to embed the resume PDF
                        try {
                          const resumePdf = await PDFDocument.load(arrBuf, { ignoreEncryption: true });
                          const copiedPages = await pdfDoc.copyPages(resumePdf, resumePdf.getPageIndices());
                          copiedPages.forEach(p => pdfDoc.addPage(p));
                        } catch(pdfErr) {
                          // If PDF merge fails (e.g. image CV), note it
                          page.drawText('Resume file could not be embedded (may be an image format).', { x:ML, y:PH/2-50, size:10, font:fontI, color:RED });
                        }
                      }
                    }
                  } catch(appendErr) {
                    console.warn('Could not append resume:', appendErr.message);
                  }
                }

                // ── Save
                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type:'application/pdf' });
                const url = URL.createObjectURL(blob);
                const safeName = (name||'Candidate').replace(/[^a-z0-9]/gi,'_');
                const a2 = document.createElement('a');
                a2.href = url;
                a2.download = `SATCO_Candidate_${safeName}_${new Date().toISOString().slice(0,10)}.pdf`;
                a2.click();
                setTimeout(() => URL.revokeObjectURL(url), 3000);
                showToast('\u2705 PDF saved successfully');
              } catch(e) {
                showToast('\u274c PDF generation failed: ' + e.message, 'error');
                console.error(e);
              } finally { setPdfGenerating(false); }
            };

            const runClaudeAssessment = async () => {
              setClaudeRunning(true);
              try {
                const result = await runClaudeAssessmentForApp(a, vacancies);
                setClaudeResult(result);
                setClaudeScore(result.score);
                setApplications(prev => prev.map(x => x.id === a.id ? {...x, claude_score: result.score, claude_assessment: result} : x));
                showToast(`✅ Claude: ${result.score}% — ${result.verdict}`);
              } catch(e) {
                showToast('❌ Claude assessment failed: ' + e.message, 'error');
              } finally { setClaudeRunning(false); }
            };

            const verdictColor = v => ({ 'Highly Recommended':'#16a34a', 'Recommended':'#2563eb', 'Borderline':'#d97706', 'Not Recommended':'#dc2626' }[v] || '#64748b');

            const [headerExpanded, setHeaderExpanded] = React.useState(false);

            return (
              <div style={{ flex:1, height:'100%', background:'#f8fafc', display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}
                className="hr-scroll">

                {/* ── Sticky Header ── */}
                <div style={{ background: qualified ? 'linear-gradient(135deg,#14532d,#16a34a)' : 'linear-gradient(135deg,#1e3a5f,#1a5fa8)', color:'#fff', flexShrink:0, position:'sticky', top:0, zIndex:10 }}>

                  {/* Always-visible compact strip */}
                  <div style={{ padding:'10px 16px 0', display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'18px', fontWeight:900, lineHeight:1.25 }}>{name}</span>
                        {a.nationality && <span style={{ background:'rgba(255,255,255,0.18)', padding:'1px 8px', borderRadius:'8px', fontSize:'11px' }}>{a.nationality}</span>}
                        {(expActual || expRange) && <span style={{ background:'rgba(255,255,255,0.18)', padding:'1px 8px', borderRadius:'8px', fontSize:'11px' }}>{expActual || expRange}</span>}
                        {meExp === 'yes' && <span style={{ background:'rgba(255,255,255,0.18)', padding:'1px 8px', borderRadius:'8px', fontSize:'11px' }}>GCC Exp</span>}
                        <span style={{ background:'rgba(255,255,255,0.25)', padding:'1px 8px', borderRadius:'8px', fontSize:'11px', fontWeight:700 }}>{qualified ? '✅' : '📁'} {score}%</span>
                        {claudeScore != null && <span style={{ background:'rgba(124,58,237,0.85)', padding:'1px 8px', borderRadius:'8px', fontSize:'11px', fontWeight:700 }}><EmojiIcon e="🤖" /> {claudeScore}%</span>}
                        <span style={{ background: isHrUpload ? 'rgba(234,179,8,0.45)' : 'rgba(59,130,246,0.4)', padding:'1px 8px', borderRadius:'8px', fontSize:'11px', fontWeight:700 }}>{isHrUpload ? 'HR Upload' : 'Web'}</span>
                      </div>
                      {/* Role + employer — always visible */}
                      {(role || a.current_employer || a.current_company) && (
                        <div style={{ fontSize:'12px', opacity:0.9, marginTop:'3px', display:'flex', alignItems:'center', gap:'5px', flexWrap:'wrap' }}>
                          {role && <span>{role}</span>}
                          {role && (a.current_employer||a.current_company) && <span style={{ opacity:0.5 }}>•</span>}
                          {(a.current_employer||a.current_company) && <span style={{ opacity:0.8 }}>{a.current_employer||a.current_company}</span>}
                        </div>
                      )}
                    </div>
                    {/* Toggle expand / collapse */}
                    <button onClick={() => setHeaderExpanded(x => !x)}
                      style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:'6px', padding:'4px 10px', fontSize:'11px', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:'4px' }}>
                      {headerExpanded ? '▲ Less' : '▼ More'}
                    </button>
                    <button onClick={()=>onClose()} style={{ background:'none', border:'none', color:'#fff', fontSize:'22px', cursor:'pointer', lineHeight:1, opacity:0.8, flexShrink:0 }}><EmojiIcon e="✕" /></button>
                  </div>

                  {/* Expandable details section */}
                  {headerExpanded && (
                    <div style={{ padding:'8px 16px 0', borderTop:'1px solid rgba(255,255,255,0.15)', marginTop:'8px' }}>
                      {/* Skills */}
                      {skills && (
                        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'8px' }}>
                          {skills.split(',').slice(0,8).map((sk,i) => (
                            <span key={i} style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', padding:'2px 9px', borderRadius:'10px', fontSize:'11px' }}>{sk.trim()}</span>
                          ))}
                          {skills.split(',').length > 8 && <span style={{ fontSize:'11px', opacity:0.6, padding:'2px 4px' }}>+{skills.split(',').length-8} more</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons — always visible */}
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'6px', padding: headerExpanded ? '0' : '8px 0 0' }}>
                    {cvPath ? (
                      <button onClick={()=>setCvViewer({ cvPath: cvPath.startsWith('applications/') ? cvPath : cvPath, fileName: cvName })}
                        style={{ background:'rgba(255,255,255,0.22)', border:'1px solid rgba(255,255,255,0.4)', color:'#fff', padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}><EmojiIcon e="📄" /> View Resume</button>
                    ) : (
                      <span style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.4)', padding:'7px 14px', borderRadius:'8px', fontSize:'11px' }}><EmojiIcon e="📄" /> No CV</span>
                    )}
                    {a.status !== 'shortlisted' ? (
                      <button onClick={()=>{ sendToHiringPipeline({...a, applicant_name: name, cv_file_path: cvPath || a.cv_file_path, cv_path: cvPath, experience_years: expRange}); }}
                        style={{ background:'#059669', border:'none', color:'#fff', padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}><EmojiIcon e="🧑‍💼" /><EmojiIcon e="→" /> Hiring Pipeline</button>
                    ) : (
                      <span style={{ background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:700 }}><EmojiIcon e="✅" /> In Pipeline</span>
                    )}
                    <button onClick={async ()=>{
                        const posOverride = window.prompt(`Save to Resume Database.\n\nPosition tag (leave blank to keep):\n`, a.vacancy_title || '');
                        if (posOverride === null) return;
                        const finalPos = posOverride.trim() || a.vacancy_title || '';
                        try {
                          // ── Full duplicate check (email / phone / passport / other vacancies) ──
                          const dup = await checkDuplicateCandidate(a);
                          if (dup) {
                            const proceed = window.confirm(
                              `⚠️ DUPLICATE DETECTED — ${name}\n\nThis candidate already exists in the system:\n\n${dup.summary}\n\n─────────────────────────────\nDo you still want to save them to the Resume Database?\n(Click OK to proceed anyway, Cancel to abort)`
                            );
                            if (!proceed) { showToast('ℹ️ Action cancelled — candidate already exists', 'error'); return; }
                          }
                          // CV: prefer cv_file_path (Supabase Storage path), then cvPath prop
                          const cvStoragePath = a.cv_file_path || cvPath || a.cv_path || null;
                          // Pull Claude assessment if stored
                          const ca = a.claude_assessment ? (typeof a.claude_assessment === 'string' ? (() => { try { return JSON.parse(a.claude_assessment); } catch { return {}; } })() : a.claude_assessment) : {};
                          const baseNoteB = `From Job Vacancies. Self-score: ${score}%. Applied: ${a.vacancy_title||'—'}.`;
                          const remarkNote = formatClaudeAssessmentNote(ca, baseNoteB) || baseNoteB;
                          const { error: insErr } = await dbSaveWithRetry('hiring_pipeline', {
                            candidate_name:            name,
                            email:                     a.email||'',
                            phone:                     a.phone||'',
                            nationality:               a.nationality||'',
                            current_location:          a.current_location||'',
                            experience:                expActual || expRange || '',
                            skills:                    skills||'',
                            current_designation:       role||'',
                            current_employer:          a.current_employer || a.current_company || '',
                            passport_no:               passport||'',
                            passport_expiry_candidate: passExp ? (() => { try { return new Date(passExp).toISOString().split('T')[0]; } catch { return null; } })() : (a.passport_expiry || null),
                            work_history:              a.work_history || null,
                            education:                 a.education || null,
                            marital_status:            a.marital_status || null,
                            religion:                  a.religion || null,
                            languages:                 a.languages || null,
                            home_address:              a.home_address || null,
                            dob_candidate:             a.dob ? (() => { try { return new Date(a.dob).toISOString().split('T')[0]; } catch { return null; } })() : null,
                            me_experience:             meExp || a.middle_east_exp || null,
                            position:                  finalPos,
                            status:                    'Resume DB',
                            step:                      'Offer Pending',
                            hiring_scenario:           'S3',
                            pipeline_location:         'resume_db',
                            // CV file — stored as Supabase Storage path prefix so CV viewer loads it
                            resume_url:                cvStoragePath ? `cv-uploads::${cvStoragePath}` : null,
                            // Claude AI scores brought over
                            interview_score:           a.claude_score != null ? Math.round(a.claude_score * 30 / 100) : null,
                            interview_verdict:         ca.verdict || null,
                            interview_notes:           remarkNote,
                            interview_score_technical: ca.technical_score ?? (ca.scores?.technical ?? null),
                            interview_score_exp:       ca.experience_score ?? (ca.scores?.experience ?? null),
                            interview_score_comm:      ca.communication_score ?? (ca.scores?.communication ?? null),
                            interview_score_safety:    ca.safety_score ?? (ca.scores?.safety ?? null),
                            interview_score_attitude:  ca.attitude_score ?? (ca.scores?.attitude ?? null),
                            interview_score_docs:      ca.docs_score ?? (ca.scores?.docs ?? null),
                            remarks:                   remarkNote,
                          });
                          if (insErr) throw new Error(insErr.message);
                          // Mark application as moved in Job Vacancies — use pipeline_location flag so it's hidden without being "rejected"
                          await db.from('job_applications').update({ pipeline_location: 'resume_db', moved_to_resume_db: true, status: 'shortlisted' }).eq('id', a.id);
                          showToast(`🗄️ ${name} saved to Resume Database`);
                          onClose(); loadAll();
                        } catch(e) { showToast('❌ Failed: ' + e.message,'error'); }
                      }}
                      style={{ background:'rgba(255,255,255,0.16)', border:'1px solid rgba(255,255,255,0.35)', color:'#fff', padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}><EmojiIcon e="🗄️" /><EmojiIcon e="→" /> Resume DB</button>
                    <button onClick={()=>{ onClose(); deleteApplication({...a, applicant_name: name}); }}
                      style={{ background:'rgba(220,38,38,0.35)', border:'1px solid rgba(254,202,202,0.4)', color:'#fff', padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}><EmojiIcon e="🗑️" /> Delete</button>
                    <button onClick={generateCandidatePdf} disabled={pdfGenerating}
                      title="Save professional PDF — profile, Claude assessment, Q&A and resume — for forwarding to clients"
                      style={{ background: pdfGenerating ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.22)', border:'1px solid rgba(255,255,255,0.45)', color:'#fff', padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:700, cursor: pdfGenerating?'wait':'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                      <EmojiLabel text={pdfGenerating ? '⏳ Generating…' : '📱 Save PDF'} />
                    </button>
                  </div>

                  {/* ── Sub-tabs ── */}
                  <div style={{ display:'flex', gap:'2px', marginTop:'8px', borderBottom:'1px solid rgba(255,255,255,0.2)' }}>
                    {[['profile','👤 Profile'],['screening', answers.length>0 ? `📋 Screening (${score}%)` : null],['claude', claudeScore!=null ? `🤖 Claude AI (${claudeScore}%)` : '🤖 Claude AI']].filter(([,l])=>l).map(([k,l])=>(
                      <button key={k} onClick={()=>setDetailTab(k)}
                        style={{ padding:'7px 13px', background: detailTab===k ? 'rgba(255,255,255,0.25)' : 'transparent', border:'none', borderBottom: detailTab===k ? '2px solid #fff' : '2px solid transparent', color:'#fff', fontSize:'12px', fontWeight: detailTab===k?700:400, cursor:'pointer', borderRadius:'4px 4px 0 0', whiteSpace:'nowrap' }}>
                        <EmojiLabel text={l} size={13} gap={5} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Body — scrollable independently ── */}
                <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'0', flex:1, overflowY:'auto' }} className="hr-scroll">

                  {/* ======== PROFILE TAB ======== */}
                  {detailTab === 'profile' && (<>
                    {/* Applied for — slim strip */}
                    <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'8px', padding:'8px 14px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'11px', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>Applied For</span>
                      <span style={{ fontSize:'13px', fontWeight:700, color:'#0c2648', flex:1 }}>{a.vacancy_title || '—'}</span>
                      <span style={{ fontSize:'11px', color:'#94a3b8' }}>{new Date(a.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
                    </div>

                    {/* ── Duplicate Detection Banner ── */}
                    {(() => {
                      const email    = (a.email||'').toLowerCase();
                      const phone    = (a.phone||'').replace(/\D/g,'');
                      const passport = (a.passport_number||'').toUpperCase();
                      // Other applications for different vacancies
                      const otherApps = applications.filter(o => o.id !== a.id && (
                        (email    && o.email            && o.email.toLowerCase()           === email) ||
                        (phone    && o.phone            && o.phone.replace(/\D/g,'')       === phone) ||
                        (passport && o.passport_number  && o.passport_number.toUpperCase() === passport)
                      ));
                      if (otherApps.length === 0) return null;
                      return (
                        <div style={{ background:'#fff7ed', border:'2px solid #fb923c', borderRadius:'10px', padding:'12px 16px', marginBottom:'14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                            <span style={{ fontSize:'15px' }}></span>
                            <span style={{ fontSize:'13px', fontWeight:800, color:'#c2410c' }}>Duplicate Detected — This candidate has applied for {otherApps.length} other position{otherApps.length>1?'s':''}</span>
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                            {otherApps.map(o => (
                              <div key={o.id} style={{ display:'flex', alignItems:'center', gap:'10px', background:'#fff', border:'1px solid #fed7aa', borderRadius:'6px', padding:'6px 10px', fontSize:'12px' }}>
                                <span style={{ background: (o.score||0)>=75?'#dcfce7':'#fee2e2', color:(o.score||0)>=75?'#166534':'#991b1b', fontWeight:800, padding:'2px 7px', borderRadius:'10px', fontSize:'11px', flexShrink:0 }}>{o.score||0}%</span>
                                <span style={{ fontWeight:600, color:'#7c2d12', flex:1 }}>{o.vacancy_title || 'General Application'}</span>
                                <span style={{ color:'#94a3b8', fontSize:'11px', flexShrink:0 }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</span>
                                <span style={{ background: o.status==='shortlisted'?'#dbeafe':'#f1f5f9', color: o.status==='shortlisted'?'#1e40af':'#475569', fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'4px', flexShrink:0 }}>{o.status||'Pending'}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize:'11px', color:'#ea580c', marginTop:'8px', fontStyle:'italic' }}>
                            Moving to Hiring Pipeline or Resume DB will prompt for confirmation before proceeding.
                          </div>
                        </div>
                      );
                    })()}

                    {/* Contact */}
                    <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px', marginBottom:'14px' }}>
                      <SectionHead icon="📞" label="Contact" />
                      <Row label="Email" value={a.email} />
                      <Row label="Phone / WhatsApp" value={a.phone} />
                      <Row label="Current Location" value={a.current_location} />
                    </div>

                    {/* Experience */}
                    <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px', marginBottom:'14px' }}>
                      <SectionHead icon="💼" label="Experience & Skills" />
                      <Row label="Current / Recent Role" value={role} />
                      <Row label="Current Employer" value={a.current_employer || a.current_company} />
                      <Row label="Experience Range" value={expRange} />
                      <Row label="Actual Years" value={expActual} />
                      <Row label="UAE / GCC Experience" value={<EmojiLabel text={
                        meExp === 'yes' ? '✅ Yes — has worked in Middle East / GCC' :
                        meExp === 'no'  ? '❌ No — no Middle East experience' : null
                      } />} />
                      {skills && (
                        <div style={{ padding:'8px 0', borderBottom:'1px solid #f8fafc' }}>
                          <div style={{ fontSize:'12px', color:'#64748b', fontWeight:600, marginBottom:'8px' }}>Key Skills</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                            {skills.split(',').map((sk,i) => (
                              <span key={i} style={{ background:'#eff6ff', color:'#1e40af', fontSize:'11.5px', fontWeight:600, padding:'3px 12px', borderRadius:'14px', border:'1px solid #bfdbfe' }}>{sk.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Work History */}
                    {workLines.length > 0 && (
                      <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px', marginBottom:'14px' }}>
                        <SectionHead icon="🏢" label="Companies / Work History" />
                        <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1fr', background:'#f8fafc', padding:'7px 12px', fontSize:'11px', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid var(--bd1)' }}>
                            <span>Company</span><span>Role</span><span>Period</span>
                          </div>
                          {workLines.map((line, i) => {
                            const parts = line.split('|').map(p => p.trim());
                            return (
                              <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1fr', padding:'9px 12px', borderBottom: i < workLines.length-1 ? '1px solid #f1f5f9':'none', background: i%2===0?'#fff':'#fafbfc', fontSize:'12px', alignItems:'center' }}>
                                <span style={{ fontWeight:700, color:'#0f172a' }}>{parts[0] || line}</span>
                                <span style={{ color:'#475569' }}>{parts[1] || '—'}</span>
                                <span style={{ color:'#94a3b8', fontSize:'11px' }}>{parts[2] || '—'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Passport */}
                    <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px', marginBottom:'14px' }}>
                      <SectionHead icon="🛂" label="Passport" />
                      {passport
                        ? <><Row label="Passport Number" value={passport} mono /><Row label="Passport Expiry" value={passExp} /></>
                        : <div style={{ fontSize:'12px', color:'#dc2626', background:'#fee2e2', borderRadius:'8px', padding:'8px 12px' }}>Passport number not provided</div>
                      }
                      <Row label="Nationality" value={a.nationality} />
                    </div>
                  </>)}

                  {/* ======== SCREENING TAB ======== */}
                  {detailTab === 'screening' && (
                    <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'16px', marginBottom:'14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                        <SectionHead icon="📋" label={`Self-Reported Screening · Score: ${score}%`} />
                        <span style={{ background: score>=75?'#16a34a':'#94a3b8', color:'#fff', borderRadius:'20px', padding:'4px 14px', fontSize:'13px', fontWeight:800 }}>{score}%</span>
                      </div>
                      <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'10px 14px', marginBottom:'14px', fontSize:'12px', color:'#92400e' }}>
                        ⚠️ These answers were self-reported by the candidate on the careers website. Compare with the Claude AI tab for an independent resume-based assessment.
                      </div>
                      {answers.length === 0 && (
                        <div style={{ textAlign:'center', padding:'30px', color:'#94a3b8', fontSize:'12px' }}>No screening answers recorded for this applicant.</div>
                      )}
                      {answers.map((ans, i) => (
                        <div key={i} style={{
                          background: ans.answer==='yes' ? '#f0fdf4' : '#fff7f7',
                          border: `1px solid ${ans.answer==='yes' ? '#bbf7d0' : '#fecaca'}`,
                          borderRadius:'8px', padding:'10px 14px', marginBottom:'8px'
                        }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                            <span style={{ color:'#334155', fontSize:'12.5px', flex:1, lineHeight:1.5 }}>
                              <b style={{ color:'#64748b' }}>Q{i+1}.</b> {ans.question}
                            </span>
                            <span style={{ fontWeight:800, fontSize:'13px', color: ans.answer==='yes'?'#16a34a':'#dc2626', whiteSpace:'nowrap', flexShrink:0 }}>
                              <EmojiLabel text={ans.answer==='yes' ? '✅ Yes' : '❌ No'} />
                              <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:400, marginLeft:'4px' }}>({ans.weight}%)</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ======== CLAUDE AI TAB ======== */}
                  {detailTab === 'claude' && (
                    <div style={{ marginBottom:'14px' }}>
                      {!claudeResult && !claudeRunning && (
                        <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'24px', textAlign:'center' }}>
                          <div style={{ fontSize:'36px', marginBottom:'12px' }}><EmojiIcon e="🤖" /></div>
                          <div style={{ fontSize:'15px', fontWeight:800, color:'#0f2744', marginBottom:'8px' }}>Claude AI Resume Assessment</div>
                          <div style={{ fontSize:'12.5px', color:'#64748b', marginBottom:'16px', lineHeight:1.6, maxWidth:'380px', margin:'0 auto 16px' }}>
                            Claude will independently read the candidate’s resume and rate them against the job requirements — giving you an unbiased second opinion beyond the candidate’s self-reported answers.
                            {cvPath && cvPath.startsWith('applications/') ? (
                              <span style={{ display:'block', marginTop:'8px', color:'#16a34a', fontWeight:600 }}><EmojiIcon e="✅" /> Resume available — will be analysed directly</span>
                            ) : (
                              <span style={{ display:'block', marginTop:'8px', color:'#d97706', fontWeight:600 }}><EmojiIcon e="⚠️" /> No resume in storage — will use profile fields only</span>
                            )}
                          </div>
                          <button onClick={runClaudeAssessment}
                            style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', padding:'12px 28px', borderRadius:'10px', fontSize:'14px', fontWeight:800, cursor:'pointer' }}>Run Claude Assessment</button>
                        </div>
                      )}

                      {claudeRunning && (
                        <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'40px', textAlign:'center' }}>
                          <div style={{ fontSize:'28px', marginBottom:'12px', animation:'spin 1s linear infinite', display:'inline-block' }}><EmojiIcon e="⏳" /></div>
                          <div style={{ fontSize:'14px', fontWeight:700, color:'#4f46e5' }}>Claude is analysing the resume…</div>
                          <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'6px' }}>This takes about 5-10 seconds</div>
                        </div>
                      )}

                      {claudeResult && !claudeRunning && (
                        <div>
                          {/* Score header */}
                          <div style={{ background:`linear-gradient(135deg, ${claudeResult.score>=75?'#4f46e5':'#64748b'}, ${claudeResult.score>=75?'#7c3aed':'#94a3b8'})`, borderRadius:'12px', padding:'20px 22px', marginBottom:'14px', color:'#fff' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div>
                                <div style={{ fontSize:'12px', opacity:0.8, marginBottom:'4px' }}>CLAUDE AI ASSESSMENT</div>
                                <div style={{ fontSize:'28px', fontWeight:900 }}>{claudeResult.score}%</div>
                                <div style={{ fontSize:'14px', fontWeight:700, marginTop:'4px', background:'rgba(255,255,255,0.2)', padding:'3px 12px', borderRadius:'10px', display:'inline-block' }}>
                                  {claudeResult.verdict}
                                </div>
                              </div>
                              <div style={{ textAlign:'right' }}>
                                <div style={{ fontSize:'11px', opacity:0.7, marginBottom:'4px' }}>Self-Reported Score</div>
                                <div style={{ fontSize:'20px', fontWeight:700 }}>{score}%</div>
                                <div style={{ fontSize:'10px', opacity:0.6 }}>
                                  {claudeResult.score > score ? `▲ Claude rates +${claudeResult.score-score}% higher` :
                                   claudeResult.score < score ? `▼ Claude rates ${score-claudeResult.score}% lower` :
                                   'Scores match'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Recommendation */}
                          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px', marginBottom:'12px' }}>
                            <SectionHead icon="📝" label="Recommendation" />
                            <p style={{ fontSize:'13px', color:'#1e293b', lineHeight:1.6, margin:0 }}>{claudeResult.recommendation}</p>
                          </div>

                          {/* Experience summary */}
                          {claudeResult.relevant_experience_summary && (
                            <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px', marginBottom:'12px' }}>
                              <SectionHead icon="💼" label="Relevant Experience" />
                              <p style={{ fontSize:'13px', color:'#1e293b', lineHeight:1.6, margin:0 }}>{claudeResult.relevant_experience_summary}</p>
                              {claudeResult.actual_experience_years && (
                                <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b' }}>
                                  Estimated experience: <strong>{claudeResult.actual_experience_years} years</strong>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Strengths & Concerns */}
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'14px 16px' }}>
                              <SectionHead icon="✅" label="Strengths" />
                              {(claudeResult.strengths||[]).map((s,i) => (
                                <div key={i} style={{ fontSize:'12px', color:'#14532d', padding:'4px 0', borderBottom: i<claudeResult.strengths.length-1?'1px solid #dcfce7':'none' }}>
                                  • {s}
                                </div>
                              ))}
                            </div>
                            <div style={{ background:'#fff7f7', border:'1px solid #fecaca', borderRadius:'10px', padding:'14px 16px' }}>
                              <SectionHead icon="⚠️" label="Concerns" />
                              {(claudeResult.concerns||[]).length === 0
                                ? <div style={{ fontSize:'12px', color:'#94a3b8' }}>No major concerns</div>
                                : (claudeResult.concerns||[]).map((c,i) => (
                                    <div key={i} style={{ fontSize:'12px', color:'#7f1d1d', padding:'4px 0', borderBottom: i<claudeResult.concerns.length-1?'1px solid #fee2e2':'none' }}>
                                      • {c}
                                    </div>
                                  ))
                              }
                            </div>
                          </div>

                          {/* Re-run */}
                          <button onClick={runClaudeAssessment}
                            style={{ background:'transparent', border:'1px solid var(--bd2)', color:'#64748b', padding:'8px 16px', borderRadius:'8px', fontSize:'12px', cursor:'pointer' }}>Re-run Assessment</button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            );
      }, [vacancies, applications, hdrs, SURL, runClaudeAssessmentForApp]);

      if (loading) return <div style={{ padding:'40px', textAlign:'center', color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', gap:'12px' }}><div className="spinner"></div> Loading vacancies…</div>;

      return (
        <>
        <div style={{ maxWidth:'1100px' }}>

          {/* ── MS Outlook-style Command Bar ── */}
          <div className="ms-cmd-bar">
            <button onClick={openNew} className="ms-cmd-btn primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Vacancy
            </button>
            <div className="ms-cmd-sep"/>
            <span className="ms-stat-pill" style={{ background:'#dff6dd', color:'#107c10' }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#107c10', display:'inline-block' }}></span>
              <b>{vacancies.filter(v=>v.status==='open').length}</b> Live
            </span>
            <span className="ms-stat-pill" style={{ background:'#fff4ce', color:'#835700' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              <b>{vacancies.filter(v=>v.status==='draft').length}</b> Draft
            </span>
            <span className="ms-stat-pill" style={{ background:'#f3f2f1', color:'#605e5c' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <b>{vacancies.filter(v=>v.status==='closed').length}</b> Closed
            </span>
          </div>

          {/* ── MS Outlook-style Pivot Tabs ── */}
          <div className="ms-pivot">
            <button onClick={()=>setActiveTab('vacancies')} className={`ms-pivot-btn${activeTab==='vacancies' ? ' active' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Vacancies
              <span style={{ background: activeTab==='vacancies'?'#0078d4':'#e1dfdd', color: activeTab==='vacancies'?'#fff':'#605e5c', borderRadius:'10px', padding:'1px 7px', fontSize:'11px', fontWeight:700 }}>{vacancies.length}</span>
            </button>
            <button onClick={()=>setActiveTab('applications')} className={`ms-pivot-btn${activeTab==='applications' ? ' active' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Applications
              <span style={{ background: activeTab==='applications'?'#0078d4':'#e1dfdd', color: activeTab==='applications'?'#fff':'#605e5c', borderRadius:'10px', padding:'1px 7px', fontSize:'11px', fontWeight:700 }}>{applications.length}</span>
            </button>
          </div>

          {/* First-time SQL banner */}
          {vacancies.length === 0 && !showForm && (
            <div style={{ background:'#fffbeb', border:'1px solid #f59e0b', borderRadius:'10px', padding:'14px 18px', marginBottom:'16px', fontSize:'12px' }}>
              <b><EmojiIcon e="⚠️" /> First-time setup:</b> Run this SQL in Supabase (project: oaerqjrkdpuhiproppaz) SQL Editor:
              <code style={{ display:'block', background:'#f1f5f9', padding:'8px', borderRadius:'6px', marginTop:'8px', whiteSpace:'pre-wrap', fontSize:'11px' }}>{
`-- ══════════════════════════════════════════════════════════
-- SATCO HR — Job Vacancies setup SQL
-- Run this ONCE in Supabase SQL Editor (project: oaerqjrkdpuhiproppaz)
-- ══════════════════════════════════════════════════════════

-- 1. Create table
CREATE TABLE IF NOT EXISTS job_vacancies (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title               text        NOT NULL,
  department          text,
  location            text        DEFAULT 'Abu Dhabi, UAE',
  employment_type     text        DEFAULT 'Full-Time',
  salary_range        text,
  experience_required text,
  description         text,
  requirements        text,
  status              text        DEFAULT 'draft',
  questions           jsonb,
  benefits            jsonb,
  updated_at          timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE job_vacancies ADD COLUMN IF NOT EXISTS benefits    jsonb;
ALTER TABLE job_vacancies ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();
ALTER TABLE job_vacancies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read"   ON job_vacancies;
DROP POLICY IF EXISTS "anon_insert" ON job_vacancies;
DROP POLICY IF EXISTS "anon_update" ON job_vacancies;
DROP POLICY IF EXISTS "anon_delete" ON job_vacancies;
DROP POLICY IF EXISTS "auth_all"    ON job_vacancies;
DROP POLICY IF EXISTS "anon_all"    ON job_vacancies;
CREATE POLICY "anon_read"   ON job_vacancies FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON job_vacancies FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON job_vacancies FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON job_vacancies FOR DELETE TO anon USING (true);

CREATE TABLE IF NOT EXISTS job_applications (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  vacancy_id              uuid        REFERENCES job_vacancies(id) ON DELETE SET NULL,
  vacancy_title           text,
  applicant_name          text,
  full_name               text,
  email                   text,
  phone                   text,
  nationality             text,
  current_location        text,
  experience_years        text,
  years_experience        text,
  actual_experience_years numeric,
  current_role            text,
  current_employer        text,
  skills                  text,
  passport_number         text,
  passport_expiry         text,
  middle_east_exp         text,
  work_history            text,
  cv_path                 text,
  cv_file_path            text,
  cv_file_name            text,
  answers                 jsonb,
  score                   numeric,
  qualified               boolean     DEFAULT false,
  claude_score            numeric,
  claude_assessment       jsonb,
  application_source      text        DEFAULT 'website',
  summary                 text,
  status                  text        DEFAULT 'new',
  created_at              timestamptz DEFAULT now()
);
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS full_name               text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS years_experience         text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS actual_experience_years  numeric;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS current_role             text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS current_employer         text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS middle_east_exp          text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS work_history             text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS cv_file_path             text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS cv_file_name             text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS summary                  text;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS application_source       text DEFAULT 'website';
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS claude_score             numeric;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS claude_assessment        jsonb;
UPDATE job_applications SET application_source='website'  WHERE application_source IS NULL AND answers IS NOT NULL;
UPDATE job_applications SET application_source='hr_upload' WHERE application_source IS NULL AND summary ILIKE '%source: email%';
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert" ON job_applications;
DROP POLICY IF EXISTS "auth_all"    ON job_applications;
DROP POLICY IF EXISTS "anon_all"    ON job_applications;
CREATE POLICY "anon_all" ON job_applications FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_pipeline" ON hiring_pipeline;
CREATE POLICY "anon_insert_pipeline" ON hiring_pipeline FOR INSERT TO anon WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('cv-uploads', 'cv-uploads', false) ON CONFLICT DO NOTHING;
-- hr-documents bucket: public read so uploaded visa/ticket/hotel URLs load directly
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-documents', 'hr-documents', true) ON CONFLICT (id) DO UPDATE SET public = true;
DROP POLICY IF EXISTS "anon_upload"  ON storage.objects;
DROP POLICY IF EXISTS "auth_read_cv" ON storage.objects;
DROP POLICY IF EXISTS "anon_read_cv" ON storage.objects;
DROP POLICY IF EXISTS "anon_upload_hr_docs"  ON storage.objects;
DROP POLICY IF EXISTS "anon_read_hr_docs"    ON storage.objects;
CREATE POLICY "anon_upload"         ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'cv-uploads');
CREATE POLICY "anon_read_cv"        ON storage.objects FOR SELECT TO anon USING (bucket_id = 'cv-uploads');
CREATE POLICY "anon_upload_hr_docs" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'hr-documents');
CREATE POLICY "anon_read_hr_docs"   ON storage.objects FOR SELECT TO anon USING (bucket_id = 'hr-documents');
CREATE POLICY "anon_update_hr_docs" ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'hr-documents');`
              }</code>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
            <button onClick={()=>setActiveTab('vacancies')} style={{ ...S.tabBtn(activeTab==='vacancies'), display:'inline-flex', alignItems:'center', gap:'6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Vacancies ({vacancies.length})
            </button>
            <button onClick={()=>setActiveTab('applications')} style={{ ...S.tabBtn(activeTab==='applications'), display:'inline-flex', alignItems:'center', gap:'6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Applications ({applications.length})
            </button>
          </div>

          {/* ===================== POST / EDIT FORM ===================== */}
          {showForm && (
            <div style={{ ...S.card, border:'2px solid #1a5fa8', marginBottom:'24px' }}>
              <div style={{ fontWeight:700, fontSize:'15px', color:'#1a5fa8', marginBottom:'16px' }}>
                {editingId ? 'Edit Vacancy' : 'New Vacancy'}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>Job Title *</label>
                  <input style={S.input} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Pipeline Construction Engineer" />
                </div>
                <div>
                  <label style={S.label}>Department</label>
                  <input style={S.input} value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} placeholder="Projects / Engineering" />
                </div>
                <div>
                  <label style={S.label}>Location</label>
                  <input style={S.input} value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} />
                </div>
                <div>
                  <label style={S.label}>Employment Type</label>
                  <select style={S.input} value={form.employment_type} onChange={e=>setForm(f=>({...f,employment_type:e.target.value}))}>
                    <option>Full-Time</option><option>Contract</option><option>Part-Time</option><option>Temporary</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Salary Range (AED/month)</label>
                  <input style={S.input} value={form.salary_range} onChange={e=>setForm(f=>({...f,salary_range:e.target.value}))} placeholder="e.g. 6,000 – 8,000" />
                </div>
                <div>
                  <label style={S.label}>Experience Required</label>
                  <input style={S.input} value={form.experience_required} onChange={e=>setForm(f=>({...f,experience_required:e.target.value}))} placeholder="e.g. 5+ years" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>Job Description *</label>
                  <textarea style={{...S.textarea, minHeight:'110px'}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the role, responsibilities…" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>Requirements / Qualifications</label>
                  <textarea style={S.textarea} value={form.requirements} onChange={e=>setForm(f=>({...f,requirements:e.target.value}))} placeholder="Qualifications, certifications, skills required…" />
                </div>
              </div>

              {/* ── Compensation & Benefits ── */}
              <div style={{ marginTop:'20px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'16px' }}>
                <div style={{ fontWeight:700, fontSize:'13px', color:'#15803d', marginBottom:'12px' }}>Compensation &amp; Benefits <span style={{ fontWeight:400, fontSize:'11px', color:'#64748b' }}>(shown to candidates on website)</span></div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12.5px' }}>
                    <thead>
                      <tr style={{ background:'#dcfce7' }}>
                        <th style={{ textAlign:'left', padding:'7px 10px', color:'#166534', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.05em', width:'38%' }}>Benefit</th>
                        <th style={{ textAlign:'left', padding:'7px 10px', color:'#166534', fontWeight:700, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Arrangement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key:'salary_range',  label:'Basic Salary',       type:'text',   placeholder:'e.g. 6,000 – 8,000',  prefix:'AED ', suffix:' /month' },
                        { key:'accommodation', label:'Accommodation',       type:'select', opts:['Provided by company','By employee','Other (specify)'] },
                        { key:'food',          label:'Food',               type:'select', opts:['Provided by company','By employee','Other (specify)'] },
                        { key:'transport',     label:'Transportation',      type:'select', opts:['Provided by company','By employee','Other (specify)'] },
                        { key:'medical',       label:'Medical Insurance',   type:'select', opts:['Provided by company','By employee','Other (specify)'] },
                        { key:'air_ticket',    label:'Annual Air Ticket',   type:'select', opts:['One return ticket per year','One return ticket every 2 years','By employee','Other (specify)'] },
                      ].map(row => (
                        <tr key={row.key} style={{ borderTop:'1px solid #dcfce7' }}>
                          <td style={{ padding:'7px 10px', color:'#334155' }}>{row.label}</td>
                          <td style={{ padding:'6px 10px' }}>
                            {row.type === 'text' ? (
                              <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                                {row.prefix && <span style={{ color:'#64748b' }}>{row.prefix}</span>}
                                <input
                                  style={{ width:'140px', background:'#fff', border:'1px solid #bbf7d0', borderRadius:'4px', padding:'4px 7px', fontSize:'12.5px', color:'#0c2648' }}
                                  value={form.benefits?.[row.key]||''}
                                  placeholder={row.placeholder}
                                  onChange={e=>setForm(f=>({ ...f, benefits:{ ...f.benefits, [row.key]:e.target.value } }))}
                                />
                                {row.suffix && <span style={{ color:'#64748b' }}>{row.suffix}</span>}
                              </span>
                            ) : (
                              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                                <select
                                  style={{ background:'#fff', border:'1px solid #bbf7d0', borderRadius:'4px', padding:'4px 8px', fontSize:'12.5px', color:'#0c2648' }}
                                  value={(form.benefits?.[row.key]||'').startsWith('Other:') ? 'Other (specify)' : (form.benefits?.[row.key]||row.opts[0])}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setForm(f=>({ ...f, benefits:{ ...f.benefits, [row.key]: val === 'Other (specify)' ? 'Other: ' : val } }));
                                  }}
                                >
                                  {row.opts.map(o=><option key={o}>{o}</option>)}
                                </select>
                                {((form.benefits?.[row.key]||'').startsWith('Other:') || form.benefits?.[row.key] === 'Other (specify)') && (
                                  <input
                                    style={{ background:'#fff', border:'1px solid #bbf7d0', borderRadius:'4px', padding:'4px 7px', fontSize:'12px', color:'#0c2648' }}
                                    placeholder="Specify arrangement…"
                                    value={(form.benefits?.[row.key]||'').replace(/^Other:\s*/, '')}
                                    onChange={e => setForm(f=>({ ...f, benefits:{ ...f.benefits, [row.key]: 'Other: ' + e.target.value } }))}
                                  />
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Question Generator */}
              <div style={{ marginTop:'20px', background:'#f8faff', border:'1px solid #c7d9f5', borderRadius:'10px', padding:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px', flexWrap:'wrap', gap:'8px' }}>
                  <div style={{ fontWeight:700, fontSize:'13px', color:'#1a5fa8' }}><EmojiIcon e="🤖" /> AI Screening Questions</div>
                  {form.questions && (
                    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                      <span style={{ fontSize:'11px', color:'#64748b' }}>
                        Total weight: <b style={{ color: form.questions.reduce((s,q)=>s+(+q.weight||0),0)===100?'#16a34a':'#dc2626' }}>
                          {form.questions.reduce((s,q)=>s+(+q.weight||0),0)}%
                        </b> {form.questions.reduce((s,q)=>s+(+q.weight||0),0)!==100&&<span style={{color:'#dc2626'}}>(must total 100%)</span>}
                      </span>
                      <button onClick={generateQuestions} disabled={generatingQ}
                        style={{ ...S.btn('grey'), fontSize:'11px', padding:'4px 10px' }}>
                        <EmojiLabel text={generatingQ ? '🤖 Regenerating…' : '🔄 Regenerate'} />
                      </button>
                    </div>
                  )}
                </div>

                {!form.questions ? (
                  <div>
                    <div style={{ fontSize:'12px', color:'#64748b', marginBottom:'10px' }}>
                      AI will generate 10 Yes/No screening questions from your JD — weighted by experience, technical fit, and availability. You can edit, delete or add questions after generation.
                    </div>
                    <button onClick={generateQuestions} disabled={generatingQ} style={S.btn('orange')}>
                      <EmojiLabel text={generatingQ ? '🤖 Generating questions…' : '🤖 Generate Questions from JD'} />
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Question rows */}
                    {form.questions.map((q, i) => (
                      <div key={i} style={{ background:'#fff', borderRadius:'8px', border:'1px solid var(--bd1)', padding:'10px 12px', marginBottom:'8px' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:'8px' }}>
                          {/* Number */}
                          <span style={{ fontSize:'11px', fontWeight:700, color:'#94a3b8', minWidth:'22px', paddingTop:'2px' }}>Q{i+1}</span>

                          {/* Question text */}
                          <textarea
                            style={{ flex:1, padding:'6px 9px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'12.5px', resize:'vertical', minHeight:'44px', fontFamily:'inherit', lineHeight:'1.5' }}
                            value={q.q}
                            onChange={e => setForm(f => {
                              const qs = [...f.questions];
                              qs[i] = { ...qs[i], q: e.target.value };
                              return { ...f, questions: qs };
                            })}
                          />

                          {/* Controls column */}
                          <div style={{ display:'flex', flexDirection:'column', gap:'5px', minWidth:'120px' }}>
                            {/* Category */}
                            <select
                              style={{ fontSize:'11px', padding:'3px 6px', border:'1px solid var(--bd2)', borderRadius:'5px', background: catColor[q.category]||'#f1f5f9', fontWeight:600 }}
                              value={q.category}
                              onChange={e => setForm(f => {
                                const qs = [...f.questions];
                                qs[i] = { ...qs[i], category: e.target.value };
                                return { ...f, questions: qs };
                              })}
                            >
                              <option value="experience">Experience</option>
                              <option value="technical">Technical</option>
                              <option value="fit">Fit</option>
                            </select>
                            {/* Weight */}
                            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                              <span style={{ fontSize:'11px', color:'#64748b' }}>Wt:</span>
                              <input
                                type="number" min="0" max="100"
                                style={{ width:'52px', padding:'3px 5px', border:'1px solid var(--bd2)', borderRadius:'5px', fontSize:'11px', textAlign:'center' }}
                                value={q.weight}
                                onChange={e => setForm(f => {
                                  const qs = [...f.questions];
                                  qs[i] = { ...qs[i], weight: +e.target.value };
                                  return { ...f, questions: qs };
                                })}
                              />
                              <span style={{ fontSize:'11px', color:'#64748b' }}>%</span>
                            </div>
                            {/* Move up/down */}
                            <div style={{ display:'flex', gap:'3px' }}>
                              <button title="Move up" disabled={i===0}
                                onClick={() => setForm(f => {
                                  const qs = [...f.questions];
                                  [qs[i-1], qs[i]] = [qs[i], qs[i-1]];
                                  return { ...f, questions: qs };
                                })}
                                style={{ flex:1, background:i===0?'#f1f5f9':'#e2e8f0', border:'none', borderRadius:'4px', cursor:i===0?'default':'pointer', fontSize:'12px', padding:'2px' }}>▲</button>
                              <button title="Move down" disabled={i===form.questions.length-1}
                                onClick={() => setForm(f => {
                                  const qs = [...f.questions];
                                  [qs[i], qs[i+1]] = [qs[i+1], qs[i]];
                                  return { ...f, questions: qs };
                                })}
                                style={{ flex:1, background:i===form.questions.length-1?'#f1f5f9':'#e2e8f0', border:'none', borderRadius:'4px', cursor:i===form.questions.length-1?'default':'pointer', fontSize:'12px', padding:'2px' }}>▼</button>
                              {/* Delete */}
                              <button title="Delete this question"
                                onClick={() => {
                                  if (form.questions.length <= 1) { showToast('⚠️ Must have at least 1 question', 'error'); return; }
                                  setForm(f => {
                                    const removedWeight = f.questions[i]?.weight || 0;
                                    const remaining = f.questions.filter((_,j) => j !== i);
                                    if (remaining.length > 0 && removedWeight > 0) {
                                      const share = removedWeight / remaining.length;
                                      const adjusted = remaining.map((q, idx) => {
                                        const raw = (q.weight || 0) + share;
                                        return { ...q, weight: idx === remaining.length - 1
                                          ? Math.round((remaining.reduce((s,x,ii) => ii < remaining.length - 1 ? s + (x.weight||0) + share : s, 0)) > 0
                                            ? removedWeight - remaining.slice(0,-1).reduce((s,x) => s + Math.round((x.weight||0)+share), 0)
                                            : Math.round(raw), 2)
                                          : Math.round(raw) };
                                      });
                                      // Simpler: distribute evenly with rounding fix on last
                                      const perQ = share;
                                      let totalAdded = 0;
                                      const fixed = remaining.map((q, idx) => {
                                        if (idx === remaining.length - 1) {
                                          return { ...q, weight: Math.round((q.weight||0) + (removedWeight - totalAdded)) };
                                        }
                                        const add = Math.round(perQ);
                                        totalAdded += add;
                                        return { ...q, weight: Math.round((q.weight||0) + add) };
                                      });
                                      return { ...f, questions: fixed };
                                    }
                                    return { ...f, questions: remaining };
                                  });
                                }}
                                style={{ flex:1, background:'#fee2e2', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', padding:'2px', color:'#dc2626', fontWeight:700 }}>✕</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add new question */}
                    <button
                      onClick={() => setForm(f => ({
                        ...f,
                        questions: [...f.questions, { q: '', weight: 5, category: 'technical' }]
                      }))}
                      style={{ ...S.btn('light'), fontSize:'12px', marginTop:'4px', border:'1.5px dashed #94a3b8' }}>
                      + Add Question
                    </button>
                  </div>
                )}
              </div>

              {/* Form actions */}
              <div style={{ display:'flex', gap:'10px', marginTop:'16px', justifyContent:'flex-end', flexWrap:'wrap' }}>
                <button onClick={()=>{setShowForm(false);setEditingId(null);}} style={S.btn('grey')}>Cancel</button>
                <button onClick={()=>save('draft')} disabled={saving} style={S.btn('light')}>Save Draft</button>
                <button onClick={()=>setPreviewVac(form)} style={{ ...S.btn('light'), background:'#f0fdf4', color:'#166534', border:'1px solid #86efac' }}>Preview Posting</button>
                <button onClick={()=>save('open')} disabled={saving||!form.questions} style={S.btn('blue')}
                  title={!form.questions ? 'Generate questions first' : ''}>
                  <EmojiLabel text={saving ? 'Publishing…' : '🚀 Approve & Publish to Website'} />
                </button>
              </div>
            </div>
          )}

          {/* ===================== VACANCIES TAB ===================== */}
          {activeTab === 'vacancies' && (
            <div style={{ padding:'16px', background:'#faf9f8', minHeight:'400px' }}>
              {vacancies.length === 0 && !showForm && (
                <div style={{ textAlign:'center', padding:'60px', color:'#a19f9d', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c8c6c4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  <div style={{ fontSize:'15px', fontWeight:600, color:'#605e5c' }}>No vacancies yet</div>
                  <div style={{ fontSize:'13px' }}>Click <strong>New Vacancy</strong> above to post your first job opening.</div>
                </div>
              )}
              {vacancies.map(v => {
                const appCount = (appsByVacancy[v.id]||[]).length;
                const qualCount = (appsByVacancy[v.id]||[]).filter(a=>(a.score||0)>=75).length;
                return (
                <div key={v.id} className="ms-vacancy-card">
                  <div className={`status-dot ${v.status==='open'?'live':v.status==='draft'?'draft':'closed'}`} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:'14px', color:'#323130', lineHeight:1.3 }}>{v.title}</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'14px', marginTop:'5px', fontSize:'12px', color:'#605e5c' }}>
                          {v.department && <span style={{ display:'inline-flex', alignItems:'center', gap:'4px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>{v.department}</span>}
                          <span style={{ display:'inline-flex', alignItems:'center', gap:'4px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>{v.location||'Abu Dhabi, UAE'}</span>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:'4px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>{v.employment_type||'Full-Time'}</span>
                          {v.salary_range && <span>AED {v.salary_range}/mo</span>}
                          {v.experience_required && <span>{v.experience_required} exp</span>}
                        </div>
                        <div style={{ display:'flex', gap:'8px', marginTop:'7px', flexWrap:'wrap', alignItems:'center' }}>
                          <span className={`ms-badge ${v.status==='open'?'green':v.status==='draft'?'orange':'gray'}`}>
                            {v.status==='open'?'Live':v.status==='draft'?'Draft':'Closed'}
                          </span>
                          {appCount > 0 && <span className="ms-badge blue">{appCount} application{appCount!==1?'s':''}</span>}
                          {qualCount > 0 && <span className="ms-badge green">{qualCount} qualified</span>}
                          {v.questions
                            ? <span className="ms-badge green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{v.questions.length} questions</span>
                            : <span className="ms-badge gray" style={{ color:'#c50f1f' }}>No questions</span>}
                          <span style={{ fontSize:'11px', color:'#a19f9d' }}>Posted {v.created_at ? new Date(v.created_at).toLocaleDateString('en-GB') : '—'}</span>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                        <button onClick={()=>openEdit(v)} className="ms-cmd-btn" title="Edit">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                          Edit
                        </button>
                        <button onClick={()=>toggleStatus(v)} className="ms-cmd-btn" style={{ color: v.status==='open'?'#605e5c':'#107c10' }}>
                          {v.status==='open'
                            ? <span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Close</span>
                            : <span style={{display:'inline-flex',alignItems:'center',gap:'4px'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Publish</span>}
                        </button>
                        <button onClick={()=>deleteVacancy(v)} className="ms-cmd-btn" style={{ color:'#c50f1f' }} title="Delete">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                    {v.description && (
                      <div style={{ marginTop:'8px', fontSize:'12px', color:'#605e5c', borderTop:'1px solid #edebe9', paddingTop:'8px', lineHeight:1.5 }}>
                        {v.description.slice(0,200)}{v.description.length>200?'…':''}
                      </div>
                    )}
                  </div>
                </div>
              );})}
            </div>
          )}

          {/* ===================== APPLICATIONS TAB — SPLIT PANE ===================== */}
          {activeTab === 'applications' && (() => {
            // sortedApps / navList are defined at component level above

            const rankColor = (c) => {
              const s = c.claude_score != null ? c.claude_score : (c.score || 0);
              if (s >= 80) return '#16a34a';
              if (s >= 65) return '#2563eb';
              if (s >= 50) return '#d97706';
              return '#94a3b8';
            };

            return (
            <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 160px)', gap:'0', overflow:'hidden', margin:'0 -8px' }}>

              {/* ══════════════ FULL-WIDTH candidate list ══════════════ */}
              <div style={{ width:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>

                {/* Toolbar */}
                <div className="ms-filter-bar" style={{ flexDirection:'column', alignItems:'stretch', gap:'4px', padding:'6px 10px' }}>
                  {/* Filter pills */}
                  <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center' }}>
                    <button onClick={()=>setAppliFilter('all')} className={`ms-filter-pill${appliFilter==='all'||appliFilter==='all_v'?' active':''}`}>
                      Show All <span style={{ marginLeft:'4px', opacity:0.7 }}>({filteredApps.length + applications.filter(a=>a.status==='shortlisted').length})</span>
                    </button>
                    <div style={{ marginLeft:'auto', display:'flex', gap:'6px', alignItems:'center' }}>
                      {(() => {
                        const unassessed = applications.filter(a => a.claude_score == null && a.status !== 'rejected').length;
                        const isRunning  = Object.keys(assessingIds).length > 0;
                        return unassessed > 0 || isRunning ? (
                          <button onClick={()=>autoAssessPending(applications, vacancies)} disabled={isRunning}
                            className="ms-cmd-btn" style={{ background: isRunning?'#f3f2f1':'#5c2d91', color: isRunning?'#605e5c':'#fff', border: isRunning?'1px solid #e1dfdd':'none', fontSize:'11px', fontWeight:600 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                            {isRunning ? `${Object.keys(assessingIds).length} Scoring…` : `Score ${unassessed} pending`}
                          </button>
                        ) : <span style={{ fontSize:'11px', color:'#107c10', fontWeight:600, display:'inline-flex', alignItems:'center', gap:'3px' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> All scored</span>;
                      })()}
                      <button onClick={()=>setEmailUpload(true)} className="ms-cmd-btn" style={{ background:'#ea580c', color:'#fff', border:'none', fontSize:'13px', fontWeight:700 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        Upload CV from Email
                      </button>
                    </div>
                  </div>
                  {/* Vacancy tabs — one row per vacancy */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'2px', marginTop:'2px' }}>
                    {/* "All" row */}
                    <div style={{ display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap' }}>
                      <button onClick={()=>{ setVacancyFilter('all'); setAppliFilter('all'); setResumeDbMatches([]); setResumeDbScanned(null); }}
                        style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'12px', border:'none', cursor:'pointer',
                          background: vacancyFilter==='all' ? '#0078d4' : '#f3f2f1', color: vacancyFilter==='all' ? '#fff' : '#323130' }}>
                        All Vacancies
                      </button>
                      <span style={{ fontSize:'10px', color:'#a19f9d' }}>{applications.filter(a=>a.status!=='rejected').length} total · {applications.filter(a=>(a.score||0)>=75&&a.status!=='rejected').length} qualified</span>
                    </div>
                    {/* Per-vacancy rows */}
                    {vacancies.map(v => {
                      const vApps     = applications.filter(a => a.vacancy_id === v.id && a.status !== 'rejected');
                      const qualified = vApps.filter(a => (a.score||0) >= 75).length;
                      const isActive  = vacancyFilter === v.id;
                      if (vApps.length === 0) return null;
                      return (
                        <div key={v.id} style={{ background: isActive ? '#f0f6fc' : '#faf9f8', border:`1px solid ${isActive?'#0078d4':'#edebe9'}`, borderRadius:'6px', padding:'3px 8px' }}>
                          {/* Vacancy title row */}
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'11.5px', fontWeight:700, color: isActive?'#0078d4':'#323130', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={v.title}>
                              {v.title}
                            </span>
                            <span style={{ fontSize:'10px', background: v.status==='open'?'#dcfce7':'#fee2e2', color: v.status==='open'?'#166534':'#991b1b', padding:'1px 6px', borderRadius:'8px', fontWeight:600, flexShrink:0 }}>
                              {v.status==='open'?'Live':'Closed'}
                            </span>
                          </div>
                          {/* Filter pill row */}
                          <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
                            {[
                              ['all_v',   `All (${vApps.length})`],
                              ['pass_v',  `≥75% (${qualified})`],
                              ['hold_v',  `<75% (${vApps.filter(a=>(a.score||0)<75).length})`],
                              ['short_v', `Shortlisted (${vApps.filter(a=>a.status==='shortlisted').length})`],
                            ].map(([k, label]) => {
                              const pillActive = isActive && appliFilter === k;
                              return (
                                <button key={k} onClick={()=>{ setVacancyFilter(v.id); setAppliFilter(k); setResumeDbMatches([]); setResumeDbScanned(null); }}
                                  style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'10px', border:'none', cursor:'pointer',
                                    background: pillActive ? '#0078d4' : '#edebe9', color: pillActive ? '#fff' : '#605e5c', fontWeight: pillActive?700:400 }}>
                                  {label}
                                </button>
                              );
                            })}
                            {vacancyFilter !== v.id && (
                              <button onClick={()=>{ setVacancyFilter(v.id); setAppliFilter('all_v'); setResumeDbMatches([]); setResumeDbScanned(null); }}
                                style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'10px', border:'1px solid #0078d4', cursor:'pointer', background:'transparent', color:'#0078d4', fontWeight:600, marginLeft:'auto' }}>
                                View →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Unsolicited row */}
                    {applications.filter(a=>!a.vacancy_id&&a.status!=='rejected').length > 0 && (
                      <button onClick={()=>{ setVacancyFilter('__unsolicited__'); setAppliFilter('all'); setResumeDbMatches([]); setResumeDbScanned(null); }}
                        style={{ fontSize:'10.5px', padding:'4px 8px', borderRadius:'6px', border:'1px dashed #c8c6c4', cursor:'pointer', background:'transparent', color:'#605e5c', textAlign:'left' }}>
                        Unsolicited / No Vacancy ({applications.filter(a=>!a.vacancy_id&&a.status!=='rejected').length})
                      </button>
                    )}
                  </div>
                  {/* Resume DB scan button */}
                  {vacancyFilter !== 'all' && vacancyFilter !== '__unsolicited__' && (() => {
                    const selVac = vacancies.find(v => v.id === vacancyFilter);
                    const alreadyScanned = resumeDbScanned === vacancyFilter;
                    return selVac ? (
                      <button onClick={()=>scanResumeDbForVacancy(selVac)} disabled={matchingResumeDb}
                        style={{ marginTop:'3px', width:'100%', fontSize:'11px', padding:'4px', borderRadius:'6px', border:'none', background: alreadyScanned?'#7c3aed':'#4f46e5', color:'#fff', fontWeight:700, cursor: matchingResumeDb?'wait':'pointer' }}>
                        <EmojiLabel text={matchingResumeDb ? '⏳ Scanning Resume DB…' : alreadyScanned ? '🔄 Re-scan Resume DB' : '🤖 Match from Resume DB'} />
                      </button>
                    ) : null;
                  })()}
                  <div style={{ marginTop:'3px', fontSize:'10px', color:'#94a3b8', display:'flex', justifyContent:'space-between' }}>
                    <span>{sortedApps.length} candidate{sortedApps.length!==1?'s':''} · sorted by AI score ↓</span>
                    {resumeDbMatches.length > 0 && <span style={{ color:'#7c3aed', fontWeight:700 }}>+{resumeDbMatches.length} Resume DB match{resumeDbMatches.length!==1?'es':''}</span>}
                  </div>
                </div>

                {/* Scrollable candidate list */}
                <div style={{ overflowY:'auto', flex:1 }} className="hr-scroll">

                  {/* Resume DB matches — pinned at top */}
                  {resumeDbMatches.length > 0 && (
                    <div style={{ background:'#f5f3ff', borderBottom:'2px solid #7c3aed', padding:'8px' }}>
                      <div style={{ fontSize:'10px', fontWeight:800, color:'#6d28d9', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px', padding:'0 4px' }}>Resume DB Matches ( {resumeDbMatches.length})
                      </div>
                      {resumeDbMatches.map(c => (
                        <div key={c.id}
                          style={{ background:'#fff', border:'1px solid #ddd6fe', borderRadius:'8px', padding:'8px 10px', marginBottom:'4px', cursor:'default' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ background:'#7c3aed', color:'#fff', borderRadius:'6px', padding:'3px 7px', fontSize:'12px', fontWeight:900, flexShrink:0 }}>{c.matchScore}%</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:800, fontSize:'12.5px', color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.candidate_name||'—'}</div>
                              <div style={{ fontSize:'11px', color:'#6d28d9', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {c.current_designation||''}{c.current_employer ? ` · ${c.current_employer}` : ''}
                              </div>
                            </div>
                            <span style={{ fontSize:'9px', fontWeight:700, color:'#7c3aed', background:'#ede9fe', padding:'2px 6px', borderRadius:'4px', flexShrink:0 }}>RESUME DB</span>
                          </div>
                          <div style={{ fontSize:'10.5px', color:'#64748b', marginTop:'4px', fontStyle:'italic', lineHeight:1.4 }}>{c.matchReason}</div>
                          {c.matchGap && <div style={{ fontSize:'10px', color:'#dc2626', marginTop:'2px' }}><EmojiIcon e="⚠️" /> {c.matchGap}</div>}
                          <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'3px', display:'flex', gap:'8px' }}>
                            {c.experience && <span><EmojiIcon e="⏱" /> {c.experience}</span>}
                            {c.created_at && <span><EmojiIcon e="📅" /> {new Date(c.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>}
                            {c.phone && <span>{c.phone}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {sortedApps.length === 0 && (
                    <div style={{ padding:'32px 16px', textAlign:'center', color:'#94a3b8', fontSize:'12px' }}>
                      No applications in this category.
                    </div>
                  )}

                  {/* Ranked application rows */}
                  {sortedApps.map((a, rank) => {
                    const aiScore   = a.claude_score != null ? a.claude_score : null;
                    const selfScore = a.score || 0;
                    const isAssessing = !!assessingIds[a.id];
                    const qualified   = a.qualified || selfScore >= 75;

                    const isHrUpload  = a.application_source === 'hr_upload' || (a.summary && a.summary.includes('Source: Email'));
                    const expDisplay  = a.actual_experience_years ? `${a.actual_experience_years}y` : (a.experience_years || a.years_experience || null);
                    const displayScore = aiScore != null ? aiScore : selfScore;

                    return (
                      <div key={a.id}
                        onClick={()=>setViewApplication(a)}
                        className="ms-list-row"
                        style={{ borderLeft:`3px solid ${rankColor(a)}`, cursor:'pointer' }}>
                        {/* Score badge — compact inline */}
                        <div style={{ flexShrink:0, width:'46px', textAlign:'center' }}>
                          <div style={{ display:'inline-flex', alignItems:'baseline', gap:'1px', background:'#f3f2f1', border:`1.5px solid ${rankColor(a)}`, borderRadius:'6px', padding:'2px 5px' }}>
                            <span style={{ fontSize:'13px', fontWeight:800, color: rankColor(a), lineHeight:1 }}>{displayScore}</span>
                            <span style={{ fontSize:'8px', color:'#a19f9d' }}>%</span>
                          </div>
                          <div style={{ fontSize:'8px', color:'#a19f9d', marginTop:'1px' }}>#{rank+1}</div>
                        </div>
                        {/* Main info — all on one line */}
                        <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:'6px', overflow:'hidden' }}>
                          <span style={{ fontWeight:600, fontSize:'13px', color:'#323130', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'180px', flexShrink:0 }}>
                            {a.applicant_name || a.full_name || '—'}
                          </span>
                          {isAssessing && <span style={{ fontSize:'9px', background:'#ede8f4', color:'#5c2d91', padding:'1px 5px', borderRadius:'8px', fontWeight:600, flexShrink:0 }}>Scoring…</span>}
                          <span style={{ fontSize:'10px', color:'#a19f9d', flexShrink:0 }}>·</span>
                          {expDisplay && <span style={{ fontSize:'11px', color:'#605e5c', whiteSpace:'nowrap', flexShrink:0 }}>{expDisplay}</span>}
                          {a.nationality && <span style={{ fontSize:'11px', color:'#605e5c', whiteSpace:'nowrap', flexShrink:0 }}>{a.nationality}</span>}
                          {a.current_location && <span style={{ fontSize:'11px', color:'#a19f9d', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.current_location.split(',')[0]}</span>}
                          {(a.current_role) && <span style={{ fontSize:'10px', color:'#a19f9d', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>· {a.current_role}</span>}
                          {selfScore > 0 && aiScore != null && <span style={{ fontSize:'9px', color:'#94a3b8', whiteSpace:'nowrap', flexShrink:0 }}>Self:{selfScore}%</span>}
                        </div>
                        {/* Right badges — single row */}
                        <div style={{ display:'flex', alignItems:'center', gap:'5px', flexShrink:0 }}>
                          <span className={`ms-badge ${qualified?'green':'orange'}`} style={{ fontSize:'10px', padding:'1px 7px' }}>
                            {qualified ? 'Qualified' : 'On Hold'}
                          </span>
                          {(a.cv_file_path||a.cv_path) && (a.cv_file_path||a.cv_path).startsWith('applications/') && (
                            <span title="CV attached" style={{ color:'#0078d4' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
                          )}
                          <span title={isHrUpload?'HR Upload':'Website'} style={{ color: isHrUpload?'#835700':'#0078d4', fontSize:'10px', fontWeight:600 }}>
                            {isHrUpload ? 'Upload' : 'Web'}
                          </span>
                          {/* Duplicate indicator — shown if same email/phone appears in another application */}
                          {(() => {
                            const email = (a.email||'').toLowerCase();
                            const phone = (a.phone||'').replace(/\D/g,'');
                            const passport = (a.passport_number||'').toUpperCase();
                            const dupCount = applications.filter(o => o.id !== a.id && (
                              (email && o.email && o.email.toLowerCase() === email) ||
                              (phone && o.phone && o.phone.replace(/\D/g,'') === phone) ||
                              (passport && o.passport_number && o.passport_number.toUpperCase() === passport)
                            )).length;
                            return dupCount > 0 ? (
                              <span title={`Applied to ${dupCount} other vacancy/ies — check for duplicates before moving`}
                                style={{ fontSize:'9px', fontWeight:800, color:'#dc2626', background:'#fee2e2', border:'1px solid #fca5a5', padding:'1px 5px', borderRadius:'4px', cursor:'help', lineHeight:1.4 }}><EmojiIcon e="⚠️" /> DUP</span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          );
          })()}

          {/* ══════════════ FULL-SCREEN OVERLAY — Candidate Detail ══════════════ */}
          {viewApplication && (() => {
            const a = viewApplication;
            const navIdx   = navList.findIndex(x => x.id === a.id);
            const hasPrev  = navIdx > 0;
            const hasNext  = navIdx < navList.length - 1;
            const goPrev   = () => setViewApplication(navList[navIdx - 1]);
            const goNext   = () => setViewApplication(navList[navIdx + 1]);

            const name      = a.applicant_name || a.full_name || '—';
            const cvPath    = a.cv_file_path   || a.cv_path   || null;
            const cvName    = a.cv_file_name   || cvPath      || 'Resume';
            const expRange  = a.years_experience || a.experience_years || null;
            const expActual = a.actual_experience_years ? `${a.actual_experience_years} years` : null;
            const role      = a.current_role   || null;
            const skills    = a.skills         || null;
            const passport  = a.passport_number || null;
            const passExp   = a.passport_expiry || null;
            const meExp     = a.middle_east_exp || null;
            const workRaw   = a.work_history    || null;
            const score     = a.score           || 0;
            const qualified = a.qualified || score >= 75;
            const answers   = (() => {
              try {
                if (!a.answers) return [];
                if (Array.isArray(a.answers)) return a.answers;
                const parsed = JSON.parse(a.answers);
                return Array.isArray(parsed) ? parsed : [];
              } catch { return []; }
            })();
            const isHrUpload = a.application_source === 'hr_upload' || (a.summary && a.summary.includes('Source: Email'));
            const workLines  = workRaw ? workRaw.split(/[\n;]/).map(l=>l.trim()).filter(Boolean) : [];

            const SectionHead = ({ icon, label }) => (
              <div style={{ fontSize:'10px', fontWeight:800, color:'#1a5fa8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px', display:'flex', alignItems:'center', gap:'5px' }}>
                <EmojiIcon e={icon} size={13} />{label}
              </div>
            );
            const Row = ({ label, value, mono }) => value ? (
              <div style={{ display:'flex', gap:'8px', padding:'6px 0', borderBottom:'1px solid #f8fafc' }}>
                <span style={{ minWidth:'140px', fontSize:'11px', color:'#64748b', fontWeight:600, flexShrink:0 }}>{label}</span>
                <span style={{ fontSize:'11px', color:'#0f172a', fontFamily: mono?'monospace':'inherit' }}>{value}</span>
              </div>
            ) : null;

            return (
              <ResizablePanel
                title={`${name} — Application Review`}
                subtitle={`${navIdx+1} / ${navList.length} candidates · ${a.vacancy_title || 'Job Vacancies'}`}
                headerColor={ qualified ? 'linear-gradient(135deg,#14532d,#16a34a)' : 'linear-gradient(135deg,#1e3a5f,#1a5fa8)' }
                onClose={()=>setViewApplication(null)}
                defaultSize="wide"
                zIndex={9999}>

                {/* Prev / Next nav inside panel chrome */}
                <div style={{ background:'rgba(0,0,0,0.06)', borderBottom:'1px solid rgba(0,0,0,0.08)', padding:'5px 14px', display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                  <button onClick={goPrev} disabled={!hasPrev}
                    style={{ background: hasPrev?'#1a5fa8':'#e2e8f0', border:'none', color: hasPrev?'#fff':'#94a3b8',
                      borderRadius:'6px', padding:'4px 12px', fontSize:'14px', fontWeight:700, cursor: hasPrev?'pointer':'default' }}>
                    ‹ Prev
                  </button>
                  <span style={{ fontSize:'11px', color:'#64748b', flex:1, textAlign:'center' }}>
                    {hasPrev ? (navList[navIdx-1]?.applicant_name||'') : '—'} &nbsp;|&nbsp; <b>{name}</b> &nbsp;|&nbsp; {hasNext ? (navList[navIdx+1]?.applicant_name||'') : '—'}
                  </span>
                  <button onClick={goNext} disabled={!hasNext}
                    style={{ background: hasNext?'#1a5fa8':'#e2e8f0', border:'none', color: hasNext?'#fff':'#94a3b8',
                      borderRadius:'6px', padding:'4px 12px', fontSize:'14px', fontWeight:700, cursor: hasNext?'pointer':'default' }}>
                    Next ›
                  </button>
                </div>

                <ClaudeAssessmentPanel
                  a={a} name={name} cvPath={cvPath} cvName={cvName}
                  expRange={expRange} expActual={expActual} role={role}
                  skills={skills} passport={passport} passExp={passExp}
                  meExp={meExp} workRaw={workRaw} workLines={workLines}
                  score={score} qualified={qualified} answers={answers}
                  isHrUpload={isHrUpload}
                  SectionHead={SectionHead} Row={Row}
                  onClose={()=>setViewApplication(null)}
                />
              </ResizablePanel>
            );
          })()}

        </div>{/* end maxWidth:1100px wrapper */}

        {cvViewer && (
          <CvViewerOverlay
            cvPath={cvViewer.cvPath}
            base64={cvViewer.base64}
            url={cvViewer.url}
            fileName={cvViewer.fileName}
            supaUrl={SURL}
            supaKey={SKEY}
            onClose={()=>setCvViewer(null)}
          />
        )}

        {/* ===================== EMAIL CV UPLOAD MODAL ===================== */}
        {emailUpload && <EmailCvUploadModal
          supaUrl={SURL} supaKey={SKEY} hdrs={hdrs}
          vacancies={vacancies} db={db}
          onClose={()=>setEmailUpload(false)}
          onSaved={()=>{ setEmailUpload(false); loadAll({ skipAutoAssess: true }); }}
          showToast={showToast}
          onAutoAssess={async (savedApp) => {
            // Mark as assessing
            setAssessingIds(prev => ({...prev, [savedApp.id]: true}));
            try {
              const result = await runClaudeAssessmentForApp(savedApp, vacancies);
              setApplications(prev => prev.map(a =>
                a.id === savedApp.id ? {...a, claude_score: result.score, claude_assessment: result} : a
              ));
              showToast(`🤖 Claude: ${savedApp.applicant_name || savedApp.full_name || 'Candidate'} — ${result.score}% · ${result.verdict}`);
            } catch(e) {
              showToast('⚠️ Claude assessment failed: ' + e.message, 'error');
            } finally {
              setAssessingIds(prev => { const n = {...prev}; delete n[savedApp.id]; return n; });
            }
          }}
        />}

        {/* Job Posting Preview Modal */}
        {previewVac && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }} onClick={()=>setPreviewVac(null)}>
            <div style={{ background:'#fff', borderRadius:'14px', maxWidth:'700px', width:'100%', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(15,23,42,0.3)' }} onClick={e=>e.stopPropagation()}>
              <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--bd1)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0c2648', borderRadius:'14px 14px 0 0' }}>
                <div style={{ color:'#fff', fontWeight:700, fontSize:'15px' }}>👁 Job Posting Preview — as candidates will see it on the website</div>
                <button onClick={()=>setPreviewVac(null)} style={{ background:'none', border:'none', color:'#fff', fontSize:'20px', cursor:'pointer' }}></button>
              </div>
              <div style={{ padding:'28px 32px' }}>
                <div style={{ fontSize:'22px', fontWeight:800, color:'#0c2648', marginBottom:'6px' }}>{previewVac.title || '(No title)'}</div>
                <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'18px', fontSize:'13px', color:'#64748b' }}>
                  {previewVac.department && <span>{previewVac.department}</span>}
                  {previewVac.location && <span>{previewVac.location}</span>}
                  {previewVac.employment_type && <span>{previewVac.employment_type}</span>}
                  {previewVac.experience_required && <span>{previewVac.experience_required} experience</span>}
                </div>
                {previewVac.description && (
                  <div style={{ marginBottom:'16px' }}>
                    <div style={{ fontWeight:700, color:'#1e293b', marginBottom:'6px', fontSize:'14px' }}>About the Role</div>
                    <div style={{ fontSize:'13.5px', color:'#475569', lineHeight:1.7, whiteSpace:'pre-line' }}>{previewVac.description}</div>
                  </div>
                )}
                {previewVac.requirements && (
                  <div style={{ marginBottom:'16px' }}>
                    <div style={{ fontWeight:700, color:'#1e293b', marginBottom:'6px', fontSize:'14px' }}>Requirements</div>
                    <div style={{ fontSize:'13.5px', color:'#475569', lineHeight:1.7, whiteSpace:'pre-line' }}>{previewVac.requirements}</div>
                  </div>
                )}
                {previewVac.benefits && Object.values(previewVac.benefits).some(v=>v) && (
                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'16px', marginBottom:'16px' }}>
                    <div style={{ fontWeight:700, color:'#15803d', marginBottom:'10px', fontSize:'14px' }}>Compensation & Benefits</div>
                    {[
                      {key:'salary_range', label:'Basic Salary', prefix:'AED ', suffix:' /month'},
                      {key:'accommodation', label:'Accommodation'},
                      {key:'food', label:'Food'},
                      {key:'transport', label:'Transportation'},
                      {key:'medical', label:'Medical Insurance'},
                      {key:'air_ticket', label:'Annual Air Ticket'},
                    ].map(({key,label,prefix,suffix}) => previewVac.benefits[key] ? (
                      <div key={key} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #dcfce7', fontSize:'13px' }}>
                        <span style={{ color:'#334155' }}>{label}</span>
                        <span style={{ color:'#166534', fontWeight:600 }}>{prefix||''}{previewVac.benefits[key].replace(/^Other:\s*/,'')}{suffix||''}</span>
                      </div>
                    ) : null)}
                  </div>
                )}
                <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'20px', paddingTop:'16px', borderTop:'1px solid var(--bd1)' }}>
                  <button onClick={()=>setPreviewVac(null)} style={{ background:'#f1f5f9', color:'#475569', border:'1px solid var(--bd1)', padding:'8px 18px', borderRadius:'8px', fontSize:'15px', cursor:'pointer', fontWeight:700 }}>Close Preview</button>
                  <button onClick={()=>{setPreviewVac(null); save('open');}} disabled={saving||!form.questions} style={{ background:saving||!form.questions?'#94a3b8':'#2563eb', color:'#fff', border:'none', padding:'8px 18px', borderRadius:'8px', fontSize:'15px', cursor:saving||!form.questions?'default':'pointer', fontWeight:700 }} title={!form.questions?'Generate questions first':''}>Publish Now</button>
                </div>
              </div>
            </div>
          </div>
        )}

        </>
      );
    }

    // -------- Workflow Guides — standalone library of the SOP reference charts --------
    function SopGuidesView() {
      const [sopChart, setSopChart] = useState(null); // { key, startIndex }
      return (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'12px 16px', fontSize:'12.5px', color:'#1e40af', lineHeight:1.6 }}>
            📊 Quick-reference SOP workflow charts for each visa route under SOP-HR-002. Click any chart below to view it full-size. These same buttons also appear inside each visa route's section on the <strong><EmojiIcon e="🗂" /> Pipeline</strong> tab of Hiring Pipeline.
          </div>
          {Object.entries(SOP_GUIDES).map(([key, g]) => {
            const scen = HIRING_SCENARIOS.find(s => s.id === key);
            return (
              <div key={key} style={{ background:'#fff', border:`1.5px solid ${scen.color}30`, borderRadius:'12px', overflow:'hidden' }}>
                <div style={{ background:scen.bg, borderBottom:`1.5px solid ${scen.color}30`, padding:'10px 16px' }}>
                  <span style={{ fontSize:'13px', fontWeight:800, color:scen.color }}>{scen.icon} {g.title}</span>
                  <span style={{ fontSize:'11px', color:'#64748b', marginLeft:'10px' }}>{scen.desc}</span>
                </div>
                <div style={{ padding:'14px 16px', display:'flex', gap:'14px', flexWrap:'wrap' }}>
                  {g.images.map((img, i) => (
                    <div key={img.src} onClick={() => setSopChart({ key, startIndex: i })}
                      style={{ cursor:'pointer', width:'260px', border:'1px solid var(--bd1)', borderRadius:'10px', overflow:'hidden', background:'#f8fafc', transition:'box-shadow 0.15s' }}>
                      <img src={img.src} alt={img.label} style={{ width:'100%', display:'block', aspectRatio:'1300/800', objectFit:'cover' }} />
                      <div style={{ padding:'8px 10px', fontSize:'11.5px', fontWeight:600, color:'#334155', lineHeight:1.4 }}>{img.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {sopChart && (
            <SopChartViewer
              guideKey={sopChart.key}
              startIndex={sopChart.startIndex || 0}
              onClose={() => setSopChart(null)}
            />
          )}
        </div>
      );
    }

    // -------- Hiring Pipeline Table View (separate component so column-filter hooks
    //          always run unconditionally — never call hooks inside a viewMode-conditional block) --------
    function HiringTable({ filtered, resolveStep, getScenario, onEdit, onDelete, onOpenSheet, setViewCandidate, onMoveLocation, showToast }) {
      const [cvViewer, setCvViewer] = React.useState(null);
      const colGetters = {
        candidate: c => c.candidate_name||'—',
        position: c => c.position_selected||c.position||'—',
        nationality: c => c.nationality||'—',
        step: c => { const es = resolveStep(c); const st = HIRING_STEPS.find(s=>s.id===es) || HIRING_STEPS.find(s=>s.id===c.step); return st?.label||'—'; },
        email: c => c.email||'—',
        phone: c => c.phone||'—',
        exp: c => c.experience ? `${c.experience}yr` : '—',
        location: c => c.current_location||'—',
        interview: c => c.interview_date ? fmtDateDisplay(c.interview_date) : '—',
        score: c => c.interview_score ? `${c.interview_score}/30` : '—',
        referred_by: c => c.referred_by||'—',
        salary: c => c.basic_salary ? `AED ${Number(c.basic_salary).toLocaleString()}` : '—',
        source: c => c.is_supplier_hire==='yes' ? (c.supplier_name||'Supplier') : 'Direct',
        status: c => c.status||'—',
        due: c => { const d = c.step_due_date ? daysUntil(c.step_due_date) : null; return d!==null && d<0 ? 'Overdue' : (c.step_due_date ? fmtDateDisplay(c.step_due_date) : '—'); },
      };
      const { filters, setColFilter, clearAll, filteredRows: tableRows, activeCount } = useColumnFilters(filtered, colGetters);
      const FROZEN_W = [170, 150, 100]; // Candidate, Position, Nationality
      const FROZEN_LEFT = [0, FROZEN_W[0], FROZEN_W[0]+FROZEN_W[1]];
      return (
        <>
        <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
          {activeCount > 0 && (
            <div style={{ padding:'7px 12px', background:'#eff6ff', borderBottom:'1px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'11.5px', color:'#1e40af' }}>
              <span><EmojiIcon e="🔎" /> {activeCount} column filter{activeCount!==1?'s':''} active — showing {tableRows.length} of {filtered.length}</span>
              <button onClick={clearAll} style={{ background:'none', border:'none', color:'#1e40af', fontWeight:700, cursor:'pointer', fontSize:'13.5px' }}>Clear all filters</button>
            </div>
          )}
          <div className="xl-wrap hr-scroll">
            <table className="xl-table" style={{ width:'100%', fontSize:'12px', minWidth:'1300px' }}>
              <thead><tr style={{ background:'#f8fafc' }}>
                <ExcelTh label="Candidate" colKey="candidate" rows={filtered} getValue={colGetters.candidate} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[0]} style={{ width:FROZEN_W[0] }} />
                <ExcelTh label="Position" colKey="position" rows={filtered} getValue={colGetters.position} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[1]} style={{ width:FROZEN_W[1] }} />
                <ExcelTh label="Nationality" colKey="nationality" rows={filtered} getValue={colGetters.nationality} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[2]} style={{ width:FROZEN_W[2] }} className="xl-frozen-edge" />
                <ExcelTh label="Step" colKey="step" rows={filtered} getValue={colGetters.step} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Email" colKey="email" rows={filtered} getValue={colGetters.email} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Phone" colKey="phone" rows={filtered} getValue={colGetters.phone} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Exp." colKey="exp" rows={filtered} getValue={colGetters.exp} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Location" colKey="location" rows={filtered} getValue={colGetters.location} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Interview" colKey="interview" rows={filtered} getValue={colGetters.interview} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Score" colKey="score" rows={filtered} getValue={colGetters.score} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Referred By" colKey="referred_by" rows={filtered} getValue={colGetters.referred_by} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Salary" colKey="salary" rows={filtered} getValue={colGetters.salary} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Source" colKey="source" rows={filtered} getValue={colGetters.source} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Status" colKey="status" rows={filtered} getValue={colGetters.status} filters={filters} setColFilter={setColFilter} />
                <ExcelTh label="Due Date" colKey="due" rows={filtered} getValue={colGetters.due} filters={filters} setColFilter={setColFilter} />
                <th style={S.th}></th>
              </tr></thead>
              <tbody>
                {tableRows.length===0 ? <tr><td colSpan={16} style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>No candidates found</td></tr> :
                  tableRows.map(c => {
                    const due = c.step_due_date ? daysUntil(c.step_due_date) : null;
                    const isOverdue = due !== null && due < 0;
                    const effStep = resolveStep(c);
                    const step = HIRING_STEPS.find(s=>s.id===effStep) || HIRING_STEPS.find(s=>s.id===c.step);
                    const scInfo = getScenario(c);
                    const statusColor = HIRING_STATUS_COLORS[c.status] || '#64748b';
                    const interviewDone = effStep !== 'resume';
                    const rowBg = isOverdue ? '#fff7f7' : interviewDone ? '#f0fdf4' : '#fffbeb';
                    const rowBorderLeft = isOverdue ? '3px solid #fca5a5' : interviewDone ? '3px solid #86efac' : '3px solid #fcd34d';
                    return (
                      <tr key={c.id} className="hr-row" onClick={(e) => { if(e.detail===2){ e.stopPropagation(); onOpenSheet(c); } }} title="Double-click to open Interview Sheet" style={{ borderTop:'1px solid var(--bd3)', background: rowBg, borderLeft: rowBorderLeft, cursor:'pointer' }}>
                        <td className="xl-frozen" style={{ ...S.td, left:FROZEN_LEFT[0], width:FROZEN_W[0], background:rowBg, fontWeight:600 }} title={c.skills ? `Skills: ${c.skills}` : ''}>
                          <span onClick={()=>onEdit(c)} onDoubleClick={(e) => { e.stopPropagation(); onOpenSheet(c); }} title="Double-click to open Interview Sheet" style={{ color:'#2563eb', cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dotted' }}>{c.candidate_name||'—'}</span>
                          <div style={{ fontSize:'10.5px', color:'#94a3b8', fontFamily:'mono' }}>{c.passport_no}</div>
                          {c.is_supplier_hire==='yes' && <div style={{ fontSize:'10px', color:'#7c3aed', marginTop:'2px', display:'flex', alignItems:'center', gap:'3px' }}><span style={{ background:'#ede9fe', padding:'1px 6px', borderRadius:'8px', fontWeight:700 }}>{c.supplier_name||'Supplier'}</span></div>}
                          {c.skills && <div style={{ fontSize:'10px', color:'#6366f1', marginTop:'2px', maxWidth:'140px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.skills}</div>}
                        </td>
                        <td className="xl-frozen" style={{ ...S.td, left:FROZEN_LEFT[1], width:FROZEN_W[1], background:rowBg }}>{c.position_selected ? <><span style={{fontWeight:700,color:'#059669'}}>{c.position_selected}</span><div style={{fontSize:'10px',color:'#94a3b8'}}>Applied: {c.position}</div></> : c.position||'—'}</td>
                        <td className="xl-frozen xl-frozen-edge" style={{ ...S.td, left:FROZEN_LEFT[2], width:FROZEN_W[2], background:rowBg }}>{c.nationality||'—'}</td>
                        <td style={S.td}>
                          {scInfo && <span style={{ display:'inline-block', fontSize:'10px', background:scInfo.color+'18', color:scInfo.color, padding:'1px 6px', borderRadius:'8px', fontWeight:700, marginBottom:'2px' }}>{scInfo.icon} {scInfo.badge}</span>}
                          {step ? <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11.5px' }}>{step.icon} {step.label}</span> : '—'}
                        </td>
                        <td style={S.td}><a href={`mailto:${c.email}`} onDoubleClick={e=>{ e.preventDefault(); e.stopPropagation(); onOpenSheet(c); }} style={{ color:'#2563eb', textDecoration:'none', fontSize:'11.5px' }}>{c.email||'—'}</a></td>
                        <td style={S.td}>{c.phone||'—'}</td>
                        <td style={{ ...S.td, textAlign:'center' }}>{c.experience ? <span style={{ background:'#eff6ff', color:'#1d4ed8', padding:'2px 8px', borderRadius:'10px', fontWeight:700, fontSize:'11px' }}>{c.experience}yr</span> : '—'}</td>
                        <td style={S.td}>{c.current_location||'—'}</td>
                        <td style={{ ...S.td, whiteSpace:'nowrap' }}>{c.interview_date?fmtDateDisplay(c.interview_date):'—'}<div style={{ fontSize:'10.5px', color:'#94a3b8' }}>{c.interview_type}</div></td>
                        <td style={{ ...S.td, textAlign:'center' }}>
                          {c.interview_score ? <span style={{ background: c.interview_score>=26?'#d1fae5':c.interview_score>=17?'#fef3c7':'#fee2e2', color: c.interview_score>=26?'#065f46':c.interview_score>=17?'#92400e':'#991b1b', padding:'2px 8px', borderRadius:'10px', fontWeight:700, fontSize:'12px' }}>{c.interview_score}/30</span> : '—'}
                        </td>
                        <td style={S.td}>{c.referred_by||'—'}</td>
                        <td style={S.td}>{c.basic_salary?`AED ${Number(c.basic_salary).toLocaleString()}`:'—'}<div style={{ fontSize:'10.5px', color:'#94a3b8' }}>{c.allowance?`+AED ${Number(c.allowance).toLocaleString()} allow.`:''}</div></td>
                        <td style={S.td}>{c.is_supplier_hire==='yes' ? <div><span style={{ background:'#ede9fe', color:'#7c3aed', padding:'2px 7px', borderRadius:'10px', fontSize:'11px', fontWeight:600 }}>Supplier</span>{c.supplier_name && <div style={{ fontSize:'10.5px', color:'#64748b', marginTop:'2px', maxWidth:'110px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.supplier_name}</div>}</div> : <span style={{ background:'#dcfce7', color:'#166534', padding:'2px 7px', borderRadius:'10px', fontSize:'11px', fontWeight:600 }}>Direct</span>}</td>
                        <td style={S.td}><span style={{ background:statusColor+'18', color:statusColor, padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:600 }}>{c.status||'—'}</span>{c.status==='Joined'&&<div style={{ fontSize:'10px', color:'#059669', fontWeight:700, marginTop:'3px' }}><EmojiIcon e="✅" /> Transferred</div>}</td>
                        <td style={{ ...S.td, whiteSpace:'nowrap' }}>{due!==null?<span style={{ color:isOverdue?'#dc2626':'#475569', fontWeight:isOverdue?700:400, fontSize:'11px', whiteSpace:'nowrap' }}>{isOverdue?`⚠ ${Math.abs(due)}d overdue`:fmtDateDisplay(c.step_due_date)}</span>:'—'}</td>
                        <td style={{ ...S.td, textAlign:'right', whiteSpace:'nowrap' }}>
                          {(c.resume_url || c.cv_path) && (
                            <button onClick={()=>setCvViewer(resolveCvViewerProps(c))} title="View CV" style={S.iconBtn}><EmojiIcon e="📄" /></button>
                          )}
                          <button onClick={()=>onEdit(c)} style={S.iconBtn}><EmojiIcon e="✏️" /></button>
                          <button onClick={async ()=>{ try { await onMoveLocation(c.id, 'resume_db'); showToast(`${c.candidate_name||'Candidate'} moved to Resume Database`); } catch(err) { showToast('❌ Move failed: ' + err.message, 'error'); } }} title="Move to Resume Database" style={S.iconBtn}><EmojiIcon e="🗄️" /></button>
                          <button onClick={()=>{ if (window.confirm(`Delete ${c.candidate_name || 'this candidate'} permanently? This cannot be undone.`)) onDelete(c.id); }} style={S.iconBtn}><EmojiIcon e="🗑️" /></button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
        {cvViewer && (
          <CvViewerOverlay
            cvPath={cvViewer.cvPath}
            base64={cvViewer.base64}
            url={cvViewer.url}
            fileName={cvViewer.fileName}
            supaUrl="https://oaerqjrkdpuhiproppaz.supabase.co"
            supaKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI"
            onClose={()=>setCvViewer(null)}
          />
        )}
        </>
      );
    }

    // -------- Resume Database --------
    // Same hiring_pipeline table as the active pipeline — these candidates just have
    // pipeline_location='resume_db' set, so they're excluded from the Hiring Pipeline's
    // Total Active count and every other Hiring Pipeline stat. Moving a candidate in either
    // direction is one click (here, or from inside the Edit Candidate → Decision tab) and
    // never re-enters any data. New resumes can also be added straight into this list for
    // future reference, without ever touching the active pipeline.
    const DISCIPLINE_TABS = [
      { key: 'all', label: 'All', keywords: [] },
      { key: 'piping',      label: 'Piping',       keywords: ['piping','pipe','pipeline'] },
      { key: 'mechanical',  label: 'Mechanical',   keywords: ['mechanical','mechanic'] },
      { key: 'electrical',  label: 'Electrical',   keywords: ['electrical','electrician','electric'] },
      { key: 'civil',       label: 'Civil',        keywords: ['civil','structural','structure'] },
      { key: 'instrumentation', label: 'Instrumentation', keywords: ['instrument','instrumentation','icu'] },
      { key: 'welding',     label: 'Welding',      keywords: ['weld','welder','welding'] },
      { key: 'scaffolding', label: 'Scaffolding',  keywords: ['scaffold'] },
      { key: 'insulation',  label: 'Insulation',   keywords: ['insulat'] },
      { key: 'qaqc',        label: 'QA/QC',        keywords: ['qa','qc','quality','inspection','inspector'] },
      { key: 'hse',         label: 'HSE',          keywords: ['hse','safety','health'] },
      { key: 'supervisory', label: 'Supervisory',  keywords: ['manager','director','supervisor','superintendent','lead','chief','coordinator'] },
    ];


    const RDB_GCC_COUNTRIES = ['UAE','United Arab Emirates','Abu Dhabi','Dubai','Sharjah','Ruwais','Jebel Ali','Saudi Arabia','KSA','Qatar','Kuwait','Bahrain','Oman','Iraq'];
    const RDB_LOCATION_WORDS = ['UAE','United Arab Emirates','Abu Dhabi','Dubai','Sharjah','Ruwais','Jebel Ali','Saudi Arabia','KSA','Qatar','Kuwait','Bahrain','Oman','Iraq','India','Pakistan','Bangladesh','Nepal','Sri Lanka','Philippines','Egypt','Sudan','Ethiopia'];

    function rdbSplitList(value, limit) {
      const max = limit || 999;
      return String(value || '')
        .split(/[,;|\n]+/)
        .map(v => v.trim())
        .filter(Boolean)
        .filter((v, i, arr) => arr.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i)
        .slice(0, max);
    }

    function rdbParseWorkHistoryRows(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(Boolean);
      const raw = String(value).trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {}
      return raw
        .split(/[;\n]+/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const parts = line.split('|').map(x => x.trim()).filter(Boolean);
          if (parts.length >= 4) return { company: parts[0], designation: parts[1], location: parts[2], period: parts.slice(3).join(' | ') };
          if (parts.length === 3) return { company: parts[0], designation: parts[1], location: '', period: parts[2] };
          if (parts.length === 2) return { company: parts[0], designation: parts[1], location: '', period: '' };
          const m = line.match(/^(.+?)\s*[—-]\s*(.+?)(?:,\s*(.+))?$/);
          if (m) return { company: m[1].replace(/\([^)]*\)/g,'').trim(), designation: m[2].trim(), location: (line.match(/\(([^)]*)\)/)||[])[1] || '', period: m[3] || '' };
          return { company: line, designation: '', location: '', period: '' };
        });
    }

    function rdbExtractLocationsFromText(text) {
      const hay = String(text || '');
      const found = [];
      RDB_LOCATION_WORDS.forEach(loc => {
        const safe = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('(^|[^A-Za-z])' + safe + '([^A-Za-z]|$)', 'i');
        if (re.test(hay)) found.push(loc);
      });
      return found;
    }

    function rdbCandidateSignals(c) {
      const workHistory = rdbParseWorkHistoryRows(c.work_history || c.me_history || c.me_notes);
      const skills = rdbSplitList(c.skills, 40);
      const rawText = [c.work_history, c.me_notes, c.remarks, c.verdict_reason, c.current_location, c.deployment_site, c.visa_category].filter(Boolean).join(' | ');
      const companies = Array.from(new Set([
        c.current_employer,
        ...workHistory.map(w => w.company || w.employer || w.organization),
      ].filter(Boolean).map(x => String(x).trim()).filter(Boolean))).slice(0, 10);
      const locations = Array.from(new Set([
        c.current_location,
        ...workHistory.map(w => w.location || w.work_location || w.country || w.site),
        ...rdbExtractLocationsFromText(rawText),
      ].filter(Boolean).map(x => String(x).trim()).filter(Boolean))).slice(0, 10);
      const hasGcc = String(c.me_experience || '').toLowerCase() === 'yes' || locations.some(loc => RDB_GCC_COUNTRIES.some(g => loc.toLowerCase().includes(g.toLowerCase())));
      const missing = [];
      if (!(c.resume_url || c.cv_path)) missing.push('CV missing');
      if (!c.phone && !c.email) missing.push('No contact');
      if (!companies.length) missing.push('Company not captured');
      if (!locations.length) missing.push('Location not captured');
      if (!skills.length) missing.push('Skills not captured');
      return { workHistory, skills, companies, locations, hasGcc, missing };
    }

    function rdbCandidateSummaryText(c) {
      const sig = rdbCandidateSignals(c);
      const lines = [
        `Candidate: ${c.candidate_name || '—'}`,
        `Position: ${c.position_selected || c.position || c.current_designation || '—'}`,
        `Current / Recent: ${[c.current_designation, c.current_employer].filter(Boolean).join(' at ') || '—'}`,
        `Experience: ${c.experience || '—'}`,
        `Nationality: ${c.nationality || '—'}`,
        `Current Location: ${c.current_location || '—'}`,
        `GCC / Middle East Experience: ${sig.hasGcc ? 'Yes' : (c.me_experience === 'no' ? 'No' : '—')}`,
        `Companies: ${sig.companies.join(', ') || '—'}`,
        `Work Locations: ${sig.locations.join(', ') || '—'}`,
        `Skills: ${sig.skills.slice(0, 18).join(', ') || '—'}`,
        `Phone: ${c.phone || '—'}`,
        `Email: ${c.email || '—'}`,
        `Availability: ${c.available_from || c.expected_arrival_date || '—'}`,
        `Current Salary: ${c.current_salary || '—'}`,
        `Notes: ${c.verdict_reason || c.remarks || c.me_notes || '—'}`,
      ];
      if (sig.workHistory.length) {
        lines.push('Work History:');
        sig.workHistory.slice(0, 8).forEach((w, i) => {
          lines.push(`${i + 1}. ${[w.company, w.designation || w.role, w.location || w.work_location || w.country, w.period || w.duration || w.years || [w.from, w.to].filter(Boolean).join(' → ')].filter(Boolean).join(' | ')}`);
        });
      }
      return lines.join('\n');
    }

    // Derives the Resume Database "folder" name straight from whatever position string is on
    // the record — no fixed list to maintain. Strips batch-requisition quantity suffixes like
    // "- 10 No's" / "(5 Nos)" so "Pipeline Construction Engineer- 10 No's" and a future
    // "Pipeline Construction Engineer- 3 No's" land in the same folder. Any position never seen
    // before (e.g. "Electrical Engineer") simply becomes a new folder the next time it appears —
    // this is what makes new folders show up automatically as new resumes come in.
    function rdbNormalizePosition(raw) {
      let s = String(raw || '').trim();
      if (!s) return 'Uncategorized';
      s = s.replace(/\(\s*\d+\s*(no'?s?|nos?|openings?|positions?|vacanc(?:y|ies))\s*\)\s*$/i, '').trim();
      s = s.replace(/[-–—]\s*\d+\s*(no'?s?|nos?|openings?|positions?|vacanc(?:y|ies))\.?\s*$/i, '').trim();
      s = s.replace(/[-–—]\s*$/, '').trim();
      s = s.replace(/\s{2,}/g, ' ');
      return s || 'Uncategorized';
    }

    // Best-effort numeric years-of-experience for sorting — averages any numbers found in
    // actual_experience_years / experience / years_experience (handles "5-10 years yrs", "15+", "7.5").
    function rdbParseExperienceYears(c) {
      const raw = c.actual_experience_years || c.experience || c.years_experience || '';
      const nums = String(raw).match(/\d+(\.\d+)?/g);
      if (!nums || !nums.length) return null;
      const vals = nums.map(Number);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    const ResumeDatabaseView = React.memo(function ResumeDatabaseView({ records, crossRecords, onAdd, onEdit, onDelete, onMoveLocation, showToast, db: dbProp }) {
      // Detect if this Resume DB candidate also exists in Hiring Pipeline (newer application)
      const findUpdatedResume = (c) => {
        if (!crossRecords || crossRecords.length === 0) return null;
        const email    = (c.email||'').toLowerCase();
        const phone    = (c.phone||'').replace(/\D/g,'');
        const passport = (c.passport_no||'').toUpperCase();
        return (crossRecords || []).find(r => {
          if (email    && r.email      && r.email.toLowerCase()    === email)    return true;
          if (phone    && r.phone      && r.phone.replace(/\D/g,'') === phone)   return true;
          if (passport && r.passport_no && r.passport_no.toUpperCase() === passport) return true;
          return false;
        }) || null;
      };
      const [search, setSearch] = useState('');
      const [verdictFilter, setVerdictFilter] = useState('all');
      const [disciplineTab, setDisciplineTab] = useState('all');
      const [intelFilter, setIntelFilter] = useState('all');
      const [selectedCandidate, setSelectedCandidate] = useState(null);
      const [sortBy, setSortBy] = useState('rank'); // rank (AI score) | date | name | experience | location
      const [collapsedFolders, setCollapsedFolders] = useState({}); // folderKey -> true when collapsed
      const [rankingIds, setRankingIds] = useState({}); // candidate id -> true while an AI ranking call is in flight
      const [scoreOverrides, setScoreOverrides] = useState({}); const [fitCheckOverrides, setFitCheckOverrides] = useState({}); const [checkingFitIds, setCheckingFitIds] = useState({}); // candidate id -> {score, reason} — optimistic local view of a fresh AI rank until the record list next refetches
      const [invitingIds, setInvitingIds] = useState({}); const [rejectingIds, setRejectingIds] = useState({}); // candidate id -> true while an invite/reject email is in flight

      const verdictCounts = useMemo(() => ({
        onhold:   records.filter(r => r.interview_verdict === 'onhold').length,
        rejected: records.filter(r => r.interview_verdict === 'rejected').length,
        none:     records.filter(r => !r.interview_verdict).length,
      }), [records]);

      const matchesDiscipline = (c, tabKey) => {
        if (tabKey === 'all') return true;
        const tab = DISCIPLINE_TABS.find(t => t.key === tabKey);
        if (!tab || !tab.keywords.length) return true;
        const haystack = [c.position, c.current_designation, c.skills, c.remarks].join(' ').toLowerCase();
        return tab.keywords.some(kw => haystack.includes(kw));
      };

      const disciplineCounts = useMemo(() => {
        const m = {};
        DISCIPLINE_TABS.forEach(t => { m[t.key] = t.key === 'all' ? records.length : records.filter(c => matchesDiscipline(c, t.key)).length; });
        return m;
      }, [records]);

      const intelCounts = useMemo(() => {
        const hasCv = records.filter(c => c.resume_url || c.cv_path).length;
        const withWork = records.filter(c => rdbCandidateSignals(c).workHistory.length > 0).length;
        const gcc = records.filter(c => rdbCandidateSignals(c).hasGcc).length;
        const needsInfo = records.filter(c => rdbCandidateSignals(c).missing.length > 0).length;
        return { all: records.length, hasCv, noCv: records.length - hasCv, withWork, gcc, needsInfo };
      }, [records]);

      const filtered = useMemo(() => {
        // V20: Resume Database filtering is intentionally search-only.
        // The old status/discipline/intelligence chips took too much vertical space and
        // caused confusion; typing in the search box now controls the visible candidate list.
        let r = records;
        if (search) {
          const needle = search.toLowerCase();
          const keys = ['candidate_name','position','passport_no','nationality','referred_by','current_location','current_designation','current_employer','skills','work_history','me_notes','remarks','verdict_reason','education','certifications_held','other_certifications','deployment_site','visa_category','email','phone'];
          r = r.filter(c => keys.some(k => String(c[k]||'').toLowerCase().includes(needle)) || rdbCandidateSummaryText(c).toLowerCase().includes(needle));
        }
        return r;
      }, [records, search]);

      const moveBack = async (c) => {
        try { await onMoveLocation(c.id, 'pipeline'); showToast(`${c.candidate_name||'Candidate'} moved back to Hiring Pipeline — now in 1 · New Resumes`); }
        catch (err) { showToast('❌ Move failed: ' + err.message, 'error'); }
      };

      // ── AI rank helper — prefers a just-computed local override over the persisted column,
      // so the UI reflects a fresh "Rank with AI" result immediately without waiting on a refetch.
      const getScore = (c) => {
        const ov = scoreOverrides[c.id];
        if (ov && ov.score != null) return ov.score;
        const n = Number(c.claude_score);
        return c.claude_score != null && !Number.isNaN(n) ? n : null;
      };

      const sortCandidates = (list) => {
        const arr = [...list];
        if (sortBy === 'name') {
          arr.sort((a, b) => (a.candidate_name || '').localeCompare(b.candidate_name || ''));
        } else if (sortBy === 'experience') {
          arr.sort((a, b) => (rdbParseExperienceYears(b) ?? -1) - (rdbParseExperienceYears(a) ?? -1));
        } else if (sortBy === 'location') {
          arr.sort((a, b) => (a.current_location || '').localeCompare(b.current_location || ''));
        } else if (sortBy === 'date') {
          arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        } else {
          // 'rank' — highest AI score first, un-ranked candidates last, ties broken by newest first
          arr.sort((a, b) => {
            const sa = getScore(a), sb = getScore(b);
            if (sa == null && sb == null) return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            if (sa == null) return 1;
            if (sb == null) return -1;
            return sb - sa;
          });
        }
        return arr;
      };

      // Groups candidates into position folders purely from the data — no fixed taxonomy, so a
      // brand-new position (e.g. the first "Electrical Engineer" resume) automatically becomes
      // its own folder the moment it's saved to Resume Database. Largest folders sort first;
      // "Uncategorized" (blank position) always sorts last.
      const folders = useMemo(() => {
        const map = new Map();
        filtered.forEach(c => {
          const label = rdbNormalizePosition(c.position || c.current_designation || '');
          const key = label.toLowerCase();
          if (!map.has(key)) map.set(key, { key, label, items: [] });
          map.get(key).items.push(c);
        });
        const groups = Array.from(map.values()).map(g => ({ ...g, items: sortCandidates(g.items) }));
        groups.sort((a, b) => {
          if (a.key === 'uncategorized') return 1;
          if (b.key === 'uncategorized') return -1;
          return b.items.length - a.items.length || a.label.localeCompare(b.label);
        });
        return groups;
      }, [filtered, sortBy, scoreOverrides]);

      const toggleFolder = (key) => setCollapsedFolders(prev => ({ ...prev, [key]: !prev[key] }));
      const allFoldersCollapsed = folders.length > 0 && folders.every(g => collapsedFolders[g.key]);
      const toggleAllFolders = () => {
        if (allFoldersCollapsed) { setCollapsedFolders({}); return; }
        const next = {}; folders.forEach(g => { next[g.key] = true; }); setCollapsedFolders(next);
      };

      // ── Rank a single Resume DB candidate with Claude — used both for the per-candidate button
      // and the per-folder bulk backfill. Persists via dbSaveWithRetry so it degrades gracefully
      // (score just won't be saved, but the UI still shows it) if the claude_score column hasn't
      // been added to hiring_pipeline yet — run:
      //   ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS claude_score integer;
      //   ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS claude_score_reason text;
      const rankCandidate = React.useCallback(async (c) => {
        setRankingIds(prev => ({ ...prev, [c.id]: true }));
        try {
          const profile = rdbCandidateSummaryText(c);
          const res = await fetch('/api/claude', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6', max_tokens: 400,
              messages: [{ role: 'user', content: `You are an HR assessor for SATCO Arabia (oil & gas, power, desalination, Abu Dhabi construction).\n\nRate this stored Resume Database candidate's overall resume strength for the position "${c.position || c.current_designation || 'their stated role'}". Weigh total relevant experience, career progression/seniority, GCC or Middle East project experience, breadth of relevant skills, and completeness of the profile.\n\n=== CANDIDATE PROFILE ===\n${profile}\n\nRespond ONLY with valid JSON:\n{"score":<integer 0-100>,"reason":"one sentence justification"}` }]
            })
          });
          if (!res.ok) throw new Error(`Claude API ${res.status}`);
          const data = await res.json();
          const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
          const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
          const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
          setScoreOverrides(prev => ({ ...prev, [c.id]: { score, reason: parsed.reason || '' } }));
          const { error } = await dbSaveWithRetry('hiring_pipeline', { claude_score: score, claude_score_reason: parsed.reason || null }, c.id);
          if (error) {
            showToast(`⚡ Ranked ${c.candidate_name || 'candidate'} ${score}/100 — but couldn't save it. Run the claude_score SQL migration in Supabase to keep this permanently.`, 'error');
          } else {
            showToast(`⚡ ${c.candidate_name || 'Candidate'} ranked ${score}/100`);
          }
        } catch (e) {
          showToast('❌ AI ranking failed: ' + e.message, 'error');
        } finally {
          setRankingIds(prev => { const n = { ...prev }; delete n[c.id]; return n; });
        }
      }, []);

      const rankFolder = async (group) => {
        const todo = group.items.filter(c => getScore(c) == null);
        if (!todo.length) { showToast('Everyone in this folder is already ranked'); return; }
        for (const c of todo) { await rankCandidate(c); }
      };

    const getReason = (c) => { const ov = scoreOverrides[c.id]; if (ov && ov.reason) return ov.reason; return c.claude_score_reason || ''; };
    const getFitChecks = (c) => fitCheckOverrides[c.id] || c.role_fit_checks || [];
    const checkFit = React.useCallback(async (c) => { const role = window.prompt("Check this candidate's fit for which role?", c.position || c.current_designation || ''); if (!role || !role.trim()) return; setCheckingFitIds(prev => ({ ...prev, [c.id]: true })); try { const profile = rdbCandidateSummaryText(c); const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: `You are an HR assessor for SATCO Arabia (oil & gas, power, desalination, Abu Dhabi construction).\n\nAssess whether this stored Resume Database candidate is a good fit for the role "${role}". Consider relevant experience, seniority, GCC or Middle East project experience, and skills match.\n\n=== CANDIDATE PROFILE ===\n${profile}\n\nRespond ONLY with valid JSON:\n{"score":<integer 0-100>,"verdict":"<short verdict e.g. Strong Fit / Possible Fit / Not a Fit>","strengths":["..."],"concerns":["..."],"suggested_role":"<a role that may suit them better, or empty string if this role fits well>"}` }] }) }); if (!res.ok) throw new Error(`Claude API ${res.status}`); const data = await res.json(); const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join(''); const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); const entry = { role, score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))), verdict: parsed.verdict || '', strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [], concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [], suggested_role: parsed.suggested_role || '', checked_at: new Date().toISOString() }; const base = fitCheckOverrides[c.id] || c.role_fit_checks || []; const nextChecks = [entry, ...base].slice(0, 10); setFitCheckOverrides(prev => ({ ...prev, [c.id]: nextChecks })); const { error } = await dbSaveWithRetry('hiring_pipeline', { role_fit_checks: nextChecks }, c.id); if (error) { showToast(`Fit checked for ${role} — but couldn't save it permanently.`, 'error'); } else { showToast(`✅ ${c.candidate_name || 'Candidate'}: ${entry.verdict || entry.score + '/100'} for ${role}`); } } catch (e) { showToast('❌ Fit check failed: ' + e.message, 'error'); } finally { setCheckingFitIds(prev => { const n = { ...prev }; delete n[c.id]; return n; }); } }, [fitCheckOverrides]);

    // ── Invite to Interview — same trigger_interview_invite DB function the Recruiting Console
    // (satco-hr-portal) calls, invoked directly against the shared Supabase project. Sends a real
    // interview-invite email via the queued edge function, then brings the candidate back into the
    // active Hiring Pipeline (mirroring what the Recruiting Console's own invite flow does through
    // the sync trigger). Requires source_application_id — candidates added directly in this app
    // (not via the Recruiting Console) won't have one; the button is disabled for those.
    const inviteToInterview = React.useCallback(async (c) => {
      if (!c.source_application_id) { showToast('No linked application on file for this candidate — invite must be sent from the Recruiting Console.', 'error'); return; }
      if (!window.confirm(`Send an interview invite email to ${c.candidate_name || 'this candidate'}?`)) return;
      setInvitingIds(prev => ({ ...prev, [c.id]: true }));
      try {
        const { data, error } = await dbProp.rpc('trigger_interview_invite', { p_application_id: c.source_application_id, p_slots: null, p_mode: null });
        if (error) throw new Error(error.message);
        const reqId = data && data.request_id;
        if (!reqId) throw new Error('Could not queue email');
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 1200));
          const { data: poll, error: pollErr } = await dbProp.rpc('check_http_response', { p_request_id: reqId });
          if (pollErr) throw new Error(pollErr.message);
          if (poll && poll.done) break;
        }
        showToast(`📧 Interview invite sent to ${c.candidate_name || 'candidate'}`);
        try { await onMoveLocation(c.id, 'pipeline'); } catch (e) { /* email already sent; move is best-effort */ }
      } catch (e) {
        showToast('❌ Invite failed: ' + e.message, 'error');
      } finally {
        setInvitingIds(prev => { const n = { ...prev }; delete n[c.id]; return n; });
      }
    }, [dbProp, onMoveLocation]);

    // ── Reject & Notify — same trigger_rejection_email DB function the Recruiting Console calls.
    // Sends a real rejection email, then records the verdict on this record so the badge updates
    // immediately without waiting on a refetch.
    const rejectAndNotify = React.useCallback(async (c) => {
      if (!c.source_application_id) { showToast('No linked application on file for this candidate — rejection email must be sent from the Recruiting Console.', 'error'); return; }
      if (!window.confirm(`Send a rejection email to ${c.candidate_name || 'this candidate'}? This cannot be undone.`)) return;
      setRejectingIds(prev => ({ ...prev, [c.id]: true }));
      try {
        const { data, error } = await dbProp.rpc('trigger_rejection_email', { p_application_id: c.source_application_id, p_custom_body_html: null });
        if (error) throw new Error(error.message);
        const reqId = data && data.request_id;
        if (!reqId) throw new Error('Could not queue email');
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 1200));
          const { data: poll, error: pollErr } = await dbProp.rpc('check_http_response', { p_request_id: reqId });
          if (pollErr) throw new Error(pollErr.message);
          if (poll && poll.done) break;
        }
        await dbSaveWithRetry('hiring_pipeline', { interview_verdict: 'rejected' }, c.id);
        showToast(`📭 Rejection email sent to ${c.candidate_name || 'candidate'}`);
      } catch (e) {
        showToast('❌ Reject failed: ' + e.message, 'error');
      } finally {
        setRejectingIds(prev => { const n = { ...prev }; delete n[c.id]; return n; });
      }
    }, [dbProp]);

      return (
        <div className="resume-db-shell">
          <div className="rdb-page-head">
            <div>
              <div className="rdb-eyebrow">Recruitment</div>
              <h1 className="rdb-title">Resume Database</h1>
              <div className="rdb-subtitle">
                Stored candidates for future hiring. Search first, filter second, then open the candidate or move them back to Hiring Pipeline when needed.
              </div>
            </div>
            <button className="rdb-btn rdb-btn-primary" onClick={onAdd}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Resume
            </button>
          </div>

          <div className="rdb-kpi-grid">
            <div className="rdb-kpi-card">
              <div className="rdb-kpi-label">Total</div>
              <div className="rdb-kpi-value">{records.length}</div>
              <div className="rdb-kpi-note">All stored records</div>
            </div>
            <div className="rdb-kpi-card">
              <div className="rdb-kpi-label">Stored</div>
              <div className="rdb-kpi-value">{verdictCounts.none}</div>
              <div className="rdb-kpi-note">Ready for future roles</div>
            </div>
            <div className="rdb-kpi-card">
              <div className="rdb-kpi-label">On Hold</div>
              <div className="rdb-kpi-value">{verdictCounts.onhold}</div>
              <div className="rdb-kpi-note">Review later</div>
            </div>
            <div className="rdb-kpi-card">
              <div className="rdb-kpi-label">Not Suitable</div>
              <div className="rdb-kpi-value">{verdictCounts.rejected}</div>
              <div className="rdb-kpi-note">Archived for reference</div>
            </div>
          </div>

          <div className="rdb-workbar">
            <div className="rdb-toolbar">
              <div className="rdb-search-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, position, passport, company, skill or location" />
              </div>
              <div className="rdb-filter-group">
                {[["all","All"],["none","Stored"],["onhold","On Hold"],["rejected","Not Suitable"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setVerdictFilter(k)} className={`rdb-pill${verdictFilter===k?' active':''}`}>
                    {l}
                    <span style={{ marginLeft:'5px', opacity: verdictFilter===k ? 0.82 : 0.58 }}>
                      {k==='all'?records.length:k==='onhold'?verdictCounts.onhold:k==='rejected'?verdictCounts.rejected:verdictCounts.none}
                    </span>
                  </button>
                ))}
              </div>
              <span className="rdb-count-note">Showing {filtered.length} of {records.length}</span>
            </div>

            <div className="rdb-discipline-row">
              {DISCIPLINE_TABS.filter(t => t.key === 'all' || disciplineCounts[t.key] > 0).map(t => (
                <button key={t.key} onClick={() => setDisciplineTab(t.key)} className={`rdb-chip${disciplineTab === t.key ? ' active' : ''}`}>
                  {t.label}
                  <span style={{ marginLeft:'5px', opacity: disciplineTab === t.key ? 0.82 : 0.55 }}>{disciplineCounts[t.key] || 0}</span>
                </button>
              ))}
            </div>
            <div className="rdb-intel-row">
              {[
                ['all','All Profiles',intelCounts.all],
                ['hasCv','CV on File',intelCounts.hasCv],
                ['noCv','CV Missing',intelCounts.noCv],
                ['gcc','GCC / ME',intelCounts.gcc],
                ['withWork','Work History',intelCounts.withWork],
                ['needsInfo','Needs Info',intelCounts.needsInfo],
              ].map(([k,l,n]) => (
                <button key={k} onClick={() => setIntelFilter(k)} className={`rdb-chip rdb-chip-soft${intelFilter === k ? ' active' : ''}`}>
                  {l}<span style={{ marginLeft:'5px', opacity: intelFilter === k ? 0.82 : 0.55 }}>{n}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rdb-sort-bar">
            <span className="rdb-sort-label">Sort within folder</span>
            <div className="rdb-filter-group">
              {[["rank","AI Rank"],["date","Date Received"],["name","Name"],["experience","Experience"],["location","Location"]].map(([k,l]) => (
                <button key={k} onClick={() => setSortBy(k)} className={`rdb-pill${sortBy===k?' active':''}`}>{l}</button>
              ))}
            </div>
            <button type="button" className="rdb-chip" onClick={toggleAllFolders} style={{ marginLeft:'auto' }}>
              {allFoldersCollapsed ? 'Expand all folders' : 'Collapse all folders'}
            </button>
          </div>

          {/* ── Position folders — one per distinct position found in the data. A brand-new
               position (e.g. the first Electrical Engineer resume) automatically gets its own
               folder here the moment it's saved; nothing to configure. ── */}
          <div className="rdb-folder-list">
            {folders.length === 0 && (
              <div className="rdb-empty">
                <div className="rdb-empty-title">No candidates found</div>
                <div style={{ fontSize:'12.5px' }}>Adjust the search above.</div>
              </div>
            )}
            {folders.map(group => {
              const isCollapsed = !!collapsedFolders[group.key];
              const unranked = group.items.filter(c => getScore(c) == null).length;
              const folderBusy = group.items.some(c => rankingIds[c.id]);
              return (
                <div key={group.key} className="rdb-folder">
                  <button type="button" className="rdb-folder-head" onClick={() => toggleFolder(group.key)}>
                    <span className="rdb-folder-caret">{isCollapsed ? '▸' : '▾'}</span>
                    <span className="rdb-folder-icon">🗂️</span>
                    <span className="rdb-folder-name">{group.label}</span>
                    <span className="rdb-folder-count">{group.items.length}</span>
                  </button>
                  {!isCollapsed && (
                    <>
                      {unranked > 0 && (
                        <div className="rdb-folder-rank-bar">
                          <span>{unranked} candidate{unranked > 1 ? 's' : ''} not yet AI-ranked</span>
                          <button type="button" className="rdb-chip rdb-chip-soft" onClick={() => rankFolder(group)} disabled={folderBusy}>
                            {folderBusy ? 'Ranking…' : `⚡ Rank all ${unranked} with AI`}
                          </button>
                        </div>
                      )}
                      <ResumeDatabaseTable
                        filtered={group.items}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onMoveBack={moveBack}
                        onSelect={setSelectedCandidate}
                        showToast={showToast}
                        dbProp={dbProp}
                        findUpdatedResume={findUpdatedResume}
                        getScore={getScore}
                        onRank={rankCandidate}
                        rankingIds={rankingIds}
                        getReason={getReason}
                        onCheckFit={checkFit}
                        checkingFitIds={checkingFitIds}
                        getFitChecks={getFitChecks}
                        onInvite={inviteToInterview}
                        invitingIds={invitingIds}
                        onReject={rejectAndNotify}
                        rejectingIds={rejectingIds}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Sliding detail panel ── */}
          {selectedCandidate && (
            <ResumeCandidatePanel
              c={selectedCandidate}
              onClose={()=>setSelectedCandidate(null)}
              onEdit={()=>{ setSelectedCandidate(null); onEdit(selectedCandidate); }}
              onDelete={()=>{ if(window.confirm(`Delete ${selectedCandidate.candidate_name||'this candidate'} permanently?`)){ setSelectedCandidate(null); onDelete(selectedCandidate.id); } }}
              onMoveBack={async()=>{ try{ await onMoveLocation(selectedCandidate.id,'pipeline'); showToast(`${selectedCandidate.candidate_name||'Candidate'} moved back to Hiring Pipeline`); setSelectedCandidate(null); }catch(e){ showToast('❌ '+e.message,'error'); } }}
              showToast={showToast}
              dbProp={dbProp}
            />
          )}
        </div>
      );
    });

    function ResumeDatabaseTable({ filtered, onEdit, onDelete, onMoveBack, onSelect, showToast, dbProp, findUpdatedResume, getScore, onRank, rankingIds, getReason, onCheckFit, checkingFitIds, getFitChecks, onInvite, invitingIds, onReject, rejectingIds }) {
      const [cvViewer, setCvViewer] = React.useState(null);

      const verdictStyle = (v) => {
        if (v === 'onhold')   return { label:'On Hold',      color:'#835700', bg:'#fff4ce', border:'#f0cb40', cls:'orange' };
        if (v === 'rejected') return { label:'Not Suitable', color:'#c50f1f', bg:'#fde7e9', border:'#f1767d', cls:'red' };
        if (v === 'selected') return { label:'Selected',     color:'#107c10', bg:'#dff6dd', border:'#92c353', cls:'green' };
        return                       { label:'Stored',       color:'#0078d4', bg:'#dce9f9', border:'#5aa0e0', cls:'blue' };
      };

      const openCv = (c) => {
        setCvViewer(resolveCvViewerProps(c));
      };

      // Send email alert to HR when CV is missing
      const sendNoCvAlert = async (c) => {
        const msg = `*CV Missing — Upload Required*\n\nCandidate: *${c.candidate_name||'Unknown'}*\nPosition: ${c.position||'—'}\nEmail: ${c.email||'—'}\nPhone: ${c.phone||'—'}\n\nPlease upload their CV to the HR Portal → Resume Database.`;
        try {
        } catch(e) { console.warn('Alert failed', e); }
        showToast(`Alert sent to HR to upload CV for ${c.candidate_name||'candidate'}`);
      };

      if (filtered.length === 0) return (
        <div className="rdb-empty">
          <div className="rdb-empty-title">No candidates found</div>
          <div style={{ fontSize:'12.5px' }}>Adjust the search, status filter, or discipline chip above.</div>
        </div>
      );

      return (
        <>
        <div className="rdb-card-list">
          {filtered.map(c => {
            const vs = verdictStyle(c.interview_verdict);
            const hasResume = !!(c.resume_url || c.cv_path);
            const sig = rdbCandidateSignals(c);
            const allSkills = sig.skills;
            const skills = allSkills.slice(0,5);
            const companies = sig.companies.slice(0,3);
            const locations = sig.locations.slice(0,3);
            const updatedEntry = findUpdatedResume ? findUpdatedResume(c) : null;
            const statusBg = updatedEntry ? '#fff7ed' : vs.bg;
            const statusColor = updatedEntry ? '#9a3412' : vs.color;
            const aiRankScore = getScore ? getScore(c) : (c.claude_score != null && c.claude_score !== '' ? Number(c.claude_score) : null);
            const isRanking = !!(rankingIds && rankingIds[c.id]);
            const isInviting = !!(invitingIds && invitingIds[c.id]);
            const isRejecting = !!(rejectingIds && rejectingIds[c.id]);
            const hasLinkedApplication = !!c.source_application_id;
            return (
              <div key={c.id} className="rdb-card-wrap">
                {updatedEntry && (
                  <div className="rdb-update-strip">
                    <strong>Updated resume found</strong>
                    <span>This candidate is also active in Hiring Pipeline as {updatedEntry.candidate_name || 'the same candidate'}{updatedEntry.position ? `, ${updatedEntry.position}` : ''}. This stored record may be older.</span>
                    <button onClick={(e)=>{ e.stopPropagation(); if(window.confirm(`Delete this older Resume DB record for ${c.candidate_name}?
The Hiring Pipeline record will be kept.`)){ onDelete(c.id); showToast('Old Resume DB record removed'); } }} className="rdb-link-danger">
                      Remove old record
                    </button>
                  </div>
                )}
                <article className="rdb-candidate-card rdb-list-compact-card" onClick={()=>onSelect(c)} style={{ borderLeftColor: updatedEntry ? '#d97706' : vs.border }}>
                  <button type="button" onClick={()=>onSelect(c)} className="rdb-avatar" style={{ background: statusBg, borderColor: updatedEntry ? '#f59e0b' : vs.border, color: statusColor }}>
                    {(c.candidate_name||'?')[0].toUpperCase()}
                  </button>

                  <div className="rdb-candidate-main">
                    <div className="rdb-card-top">
                      <div style={{ minWidth:0 }}>
                        <button type="button" onClick={()=>onSelect(c)} className="rdb-name-btn">
                          {c.candidate_name || '—'}
                        </button>
                        <div className="rdb-title-line">{c.position || c.current_designation || 'Position not specified'}</div>
                      </div>
                      <div className="rdb-card-badges">
                        <span className="rdb-badge" style={{ color:statusColor, background:statusBg }}>{updatedEntry ? 'Updated in Pipeline' : vs.label}</span>
                        {aiRankScore != null && (
                          <span className="rdb-badge rdb-score-badge" style={{ color: aiRankScore>=70?'#166534':aiRankScore>=40?'#92400e':'#b91c1c', background: aiRankScore>=70?'#dcfce7':aiRankScore>=40?'#fef3c7':'#fee2e2' }} title="AI resume-strength ranking">
                            ⚡ {aiRankScore}/100
                          </span>
                        )}
                        {aiRankScore != null && getReason && getReason(c) && (
                          <details className='rdb-why-details' onClick={(e)=>e.stopPropagation()} style={{ marginTop:2 }}>
                            <summary style={{ cursor:'pointer', fontSize:12, color:'#6b7280' }}>Why?</summary>
                            <div style={{ fontSize:12, color:'#374151', marginTop:4, maxWidth:320 }}>{getReason(c)}</div>
                          </details>
                        )}
                        {c.experience && <span className="rdb-badge rdb-badge-neutral">{c.experience} yrs</span>}
                        {c.nationality && <span className="rdb-badge rdb-badge-neutral">{c.nationality}</span>}
                        {sig.hasGcc && <span className="rdb-badge" style={{ color:'#166534', background:'#dcfce7' }}>GCC / ME</span>}
                        {sig.workHistory.length > 0 && <span className="rdb-badge rdb-badge-neutral">Work history</span>}
                        {hasResume ? <span className="rdb-badge rdb-badge-neutral">CV on file</span> : <span className="rdb-badge" style={{ color:'#b91c1c', background:'#fee2e2' }}>CV missing</span>}
                      </div>
                    </div>

                    <div className="rdb-info-grid">
                      {(c.current_employer || c.current_designation) && (
                        <div className="rdb-info-item">
                          <span className="rdb-info-label">Current</span>
                          <span className="rdb-info-value">{[c.current_designation, c.current_employer].filter(Boolean).join(' at ')}</span>
                        </div>
                      )}
                      {c.current_location && (
                        <div className="rdb-info-item">
                          <span className="rdb-info-label">Location</span>
                          <span className="rdb-info-value">{c.current_location}</span>
                        </div>
                      )}
                      {c.referred_by && (
                        <div className="rdb-info-item">
                          <span className="rdb-info-label">Source</span>
                          <span className="rdb-info-value">{c.referred_by}</span>
                        </div>
                      )}
                      {c.passport_no && (
                        <div className="rdb-info-item">
                          <span className="rdb-info-label">Passport</span>
                          <span className="rdb-info-value" style={{ fontFamily:'monospace' }}>{c.passport_no}</span>
                        </div>
                      )}
                      {c.created_at && (
                        <div className="rdb-info-item">
                          <span className="rdb-info-label">Received</span>
                          <span className="rdb-info-value">{fmtDateDisplay(c.created_at)}</span>
                        </div>
                      )}
                    </div>

                    {(c.email || c.phone) && (
                      <div className="rdb-contact-row">
                        {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                        {c.phone && <span>{c.phone}</span>}
                      </div>
                    )}

                    {(companies.length > 0 || locations.length > 0) && (
                      <div className="rdb-signal-row">
                        {companies.length > 0 && <span className="rdb-signal-label">Companies</span>}
                        {companies.map((co,i) => <span key={`co-${i}`} className="rdb-mini-chip">{co}</span>)}
                        {locations.length > 0 && <span className="rdb-signal-label">Locations</span>}
                        {locations.map((loc,i) => <span key={`loc-${i}`} className="rdb-mini-chip">{loc}</span>)}
                      </div>
                    )}

                    {skills.length > 0 && (
                      <div className="rdb-skills">
                        {skills.map((sk,i) => <span key={i} className="rdb-skill-chip">{sk}</span>)}
                        {allSkills.length > 5 && <span className="rdb-more-chip">+{allSkills.length - 5} more</span>}
                      </div>
                    )}

                    {c.verdict_reason && <div className="rdb-note">{c.verdict_reason}</div>}
                  </div>

                  <div className="rdb-card-actions">
                    <button data-mirror="open" onClick={()=>onSelect(c)} className="rdb-action-btn rdb-action-primary">Extracted Profile</button>
                    {hasResume ? (
                      <button data-mirror="view" onClick={()=>openCv(c)} className="rdb-action-btn">View CV</button>
                    ) : (
                      <button data-mirror="view" onClick={()=>sendNoCvAlert(c)} className="rdb-action-btn rdb-action-danger" title="Send alert to HR to upload CV">Request CV</button>
                    )}
                    <button data-mirror="move" onClick={()=>onMoveBack(c)} className="rdb-action-btn" title="Bring this candidate back into the active Hiring Pipeline">Move to Hiring Pipeline</button>
                    {onInvite && (
                      <button data-mirror="invite" onClick={(e)=>{ e.stopPropagation(); onInvite(c); }} disabled={isInviting || !hasLinkedApplication} className="rdb-action-btn" style={{ background:'#1d4ed8', color:'#fff', borderColor:'#1d4ed8' }} title={hasLinkedApplication ? "Send this candidate an interview invite email" : "No linked application on file — send from the Recruiting Console instead"}>
                        {isInviting ? 'Sending…' : '📧 Invite to Interview'}
                      </button>
                    )}
                    {onReject && (
                      <button data-mirror="reject" onClick={(e)=>{ e.stopPropagation(); onReject(c); }} disabled={isRejecting || !hasLinkedApplication} className="rdb-action-btn rdb-action-danger" title={hasLinkedApplication ? "Send this candidate a rejection email" : "No linked application on file — send from the Recruiting Console instead"}>
                        {isRejecting ? 'Sending…' : '📭 Reject & Notify'}
                      </button>
                    )}
                    {onRank && aiRankScore == null && (
                      <button data-mirror="rank" onClick={(e)=>{ e.stopPropagation(); onRank(c); }} disabled={isRanking} className="rdb-action-btn" title="Score this resume's overall strength with AI">
                        {isRanking ? 'Ranking…' : '⚡ Rank with AI'}
                      </button>
                    )}
                    {onCheckFit && (
                      <button data-mirror="fit" onClick={(e)=>{ e.stopPropagation(); onCheckFit(c); }} disabled={checkingFitIds && checkingFitIds[c.id]} className='rdb-action-btn' title='Ask AI whether this candidate fits a different role'>
                        {checkingFitIds && checkingFitIds[c.id] ? 'Checking…' : '🎯 Check Fit for Role'}
                      </button>
                    )}
                    <button data-mirror="edit" onClick={()=>onEdit(c)} className="rdb-action-btn">Edit</button>
                    <button data-mirror="delete" onClick={()=>{ if(window.confirm(`Delete ${c.candidate_name||'this candidate'} permanently?`)) onDelete(c.id); }} className="rdb-action-btn rdb-action-danger">Delete</button>
                  </div>
                  {getFitChecks && getFitChecks(c).length > 0 && (
                    <div className='rdb-fit-result' onClick={(e)=>e.stopPropagation()} style={{ padding:'8px 16px', fontSize:12, color:'#374151' }}>
                      <div style={{ fontWeight:600, color:'#111827' }}>Fit for "{getFitChecks(c)[0].role}": {getFitChecks(c)[0].verdict || (getFitChecks(c)[0].score+'/100')}</div>
                      {getFitChecks(c)[0].strengths && getFitChecks(c)[0].strengths.length > 0 && <div><b>Strengths:</b> {getFitChecks(c)[0].strengths.join('; ')}</div>}
                      {getFitChecks(c)[0].concerns && getFitChecks(c)[0].concerns.length > 0 && <div><b>Concerns:</b> {getFitChecks(c)[0].concerns.join('; ')}</div>}
                      {getFitChecks(c)[0].suggested_role && <div><b>Suggested role:</b> {getFitChecks(c)[0].suggested_role}</div>}
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>

        {cvViewer && (
          <CvViewerOverlay
            cvPath={cvViewer.cvPath}
            base64={cvViewer.base64}
            url={cvViewer.url}
            fileName={cvViewer.fileName}
            supaUrl="https://oaerqjrkdpuhiproppaz.supabase.co"
            supaKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI"
            onClose={()=>setCvViewer(null)}
          />
        )}
        </>
      );
    }

    /* ── Sliding detail panel for Resume Database — same style as Hiring Pipeline ── */
    function ResumeCandidatePanel({ c, onClose, onEdit, onDelete, onMoveBack, showToast, dbProp }) {
      const [cvViewer, setCvViewer] = React.useState(null);
      const [alertSent, setAlertSent] = React.useState(false);
      const hasResume = !!(c.resume_url || c.cv_path);

      const openCv = () => {
        setCvViewer(resolveCvViewerProps(c));
      };

      const sendNoCvAlert = async () => {
        const msg = `*CV Missing — Upload Required*\n\nCandidate: *${c.candidate_name||'Unknown'}*\nPosition: ${c.position||'—'}\nEmail: ${c.email||'—'}\nPhone: ${c.phone||'—'}\n\nPlease upload their CV to HR Portal → Resume Database.`;

        setAlertSent(true);
        showToast(`Alert sent to HR to upload CV for ${c.candidate_name||'candidate'}`);
      };

      const Row = ({ label, value }) => value ? (
        <div style={{ display:'flex', gap:'8px', padding:'6px 0', borderBottom:'1px solid var(--bd3)' }}>
          <span style={{ minWidth:'150px', fontSize:'12px', color:'#64748b', fontWeight:600, flexShrink:0 }}>{label}</span>
          <span style={{ fontSize:'12px', color:'#0f172a', wordBreak:'break-word' }}>{value}</span>
        </div>
      ) : null;

      const sig = rdbCandidateSignals(c);
      const wh = sig.workHistory;
      const skillList = sig.skills.slice(0, 30);
      const companies = sig.companies.slice(0, 10);
      const workLocations = sig.locations.slice(0, 10);
      const currentCompany = c.current_employer || companies[0] || '';
      const currentRole = c.current_designation || c.position || (wh[0] && (wh[0].designation || wh[0].role)) || '';
      const availability = c.available_from || c.expected_arrival_date || '';
      const salaryText = c.current_salary ? `AED ${Number(c.current_salary).toLocaleString()}` : (c.basic_salary ? `AED ${Number(c.basic_salary).toLocaleString()} basic` : '');
      const profileCompleteness = [c.candidate_name, currentRole, currentCompany, c.experience, c.current_location, c.nationality, c.skills, wh.length, hasResume, c.phone || c.email].filter(Boolean).length;
      const completionPct = Math.round((profileCompleteness / 10) * 100);
      const copySummary = async () => {
        const text = rdbCandidateSummaryText(c);
        try { await navigator.clipboard.writeText(text); showToast('Candidate summary copied'); }
        catch(e) { window.prompt('Copy candidate summary', text); }
      };
      const Fact = ({ label, value }) => value ? (
        <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'10px 12px', minWidth:0 }}>
          <div style={{ fontSize:'10.5px', color:'#64748b', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px' }}>{label}</div>
          <div style={{ fontSize:'13px', color:'#0f172a', fontWeight:750, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
        </div>
      ) : null;

      return (
        <>
        <ResizablePanel
          title={c.candidate_name || '(no name)'}
          subtitle={[c.current_designation||c.position, c.nationality, c.experience ? `${c.experience} yrs exp` : null].filter(Boolean).join(' · ')}
          headerColor="#059669"
          onClose={onClose}
          defaultSize="wide"
          zIndex={9999}>
          {/* Action buttons toolbar */}
          <div className="rdb-detail-toolbar" style={{ display:'flex', gap:'6px', flexWrap:'wrap', padding:'8px 14px', background:'#f8fafc', borderBottom:'1px solid var(--bd1)', flexShrink:0 }}>
            {hasResume ? (
              <button onClick={openCv} style={{ background:'#1a5fa8', border:'none', color:'#fff', padding:'5px 12px', borderRadius:'7px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>View CV</button>
            ) : (
              <button onClick={sendNoCvAlert} disabled={alertSent} style={{ background: alertSent?'#94a3b8':'#dc2626', border:'none', color:'#fff', padding:'5px 12px', borderRadius:'7px', fontSize:'11px', fontWeight:700, cursor: alertSent?'default':'pointer' }}>
                {alertSent ? 'Alert Sent' : 'Request CV'}
              </button>
            )}
            <button onClick={onMoveBack} style={{ background:'#1f4e79', border:'none', color:'#fff', padding:'5px 12px', borderRadius:'7px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Move to Pipeline</button>
            <button onClick={copySummary} style={{ background:'#475569', border:'none', color:'#fff', padding:'5px 12px', borderRadius:'7px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Copy Summary</button>
            <button onClick={onEdit} style={{ background:'#334155', border:'none', color:'#fff', padding:'5px 12px', borderRadius:'7px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Edit</button>
            <button onClick={onDelete} style={{ background:'#dc2626', border:'none', color:'#fff', padding:'5px 12px', borderRadius:'7px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Delete</button>
            <div style={{ marginLeft:'auto', display:'flex', gap:'6px', alignItems:'center' }}>
              {c.interview_verdict === 'onhold'  && <span style={{ background:'#fef9c3', color:'#854d0e', padding:'2px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>On Hold</span>}
              {c.interview_verdict === 'rejected' && <span style={{ background:'#fee2e2', color:'#991b1b', padding:'2px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>Not Suitable</span>}
              {hasResume ? <span style={{ background:'#dcfce7', color:'#166534', padding:'2px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>CV on file</span>
                         : <span style={{ background:'#fee2e2', color:'#991b1b', padding:'2px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>No CV</span>}
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }} className="hr-scroll rdb-detail-body">

            {/* ── EXTRACTED PROFILE SUMMARY ── */}
            <div className="rdb-extracted-profile-card" style={{ background:'#ffffff', border:'1px solid var(--bd4)', borderRadius:'12px', padding:'16px', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:'12px', alignItems:'flex-start', marginBottom:'12px' }}>
                <div>
                  <div style={{ fontSize:'10.5px', fontWeight:900, color:'#1f4e79', textTransform:'uppercase', letterSpacing:'0.08em' }}>Extracted Candidate Profile</div>
                  <div style={{ fontSize:'18px', fontWeight:850, color:'#0f172a', marginTop:'4px' }}>{c.candidate_name || 'Candidate'}</div>
                  <div style={{ fontSize:'12.5px', color:'#475569', marginTop:'3px' }}>{[currentRole, currentCompany].filter(Boolean).join(' at ') || 'Role and company not captured yet'}</div>
                </div>
                <span style={{ background: completionPct >= 75 ? '#dcfce7' : completionPct >= 45 ? '#fef9c3' : '#fee2e2', color: completionPct >= 75 ? '#166534' : completionPct >= 45 ? '#854d0e' : '#991b1b', padding:'5px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:800, whiteSpace:'nowrap' }}>
                  {completionPct}% profile data
                </span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'8px', marginBottom:'12px' }}>
                <Fact label="Experience" value={c.experience ? `${c.experience}` : null} />
                <Fact label="Current Location" value={c.current_location} />
                <Fact label="Nationality" value={c.nationality} />
                <Fact label="GCC / ME" value={sig.hasGcc ? 'Yes' : c.me_experience === 'no' ? 'No' : null} />
                <Fact label="Availability" value={availability} />
                <Fact label="Current Salary" value={salaryText} />
                <Fact label="Visa Category" value={c.visa_category} />
                <Fact label="Selected Role" value={c.position_selected} />
              </div>

              {sig.missing.length > 0 && (
                <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'10px', padding:'10px 12px', marginBottom:'12px' }}>
                  <div style={{ fontSize:'10.5px', fontWeight:850, color:'#9a3412', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Recruiter Attention</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                    {sig.missing.map((item,i)=><span key={i} style={{ background:'#fff', border:'1px solid #fed7aa', color:'#9a3412', borderRadius:'999px', padding:'3px 8px', fontSize:'11px', fontWeight:750 }}>{item}</span>)}
                  </div>
                </div>
              )}

              {(companies.length > 0 || workLocations.length > 0) && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'10px', marginTop:'4px' }}>
                  {companies.length > 0 && (
                    <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'10px 12px' }}>
                      <div style={{ fontSize:'10.5px', fontWeight:850, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'7px' }}>Companies Found</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                        {companies.map((name,i)=><span key={i} style={{ background:'#fff', border:'1px solid var(--bd4)', color:'#334155', borderRadius:'999px', padding:'3px 8px', fontSize:'11px', fontWeight:700 }}>{name}</span>)}
                      </div>
                    </div>
                  )}
                  {workLocations.length > 0 && (
                    <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'10px 12px' }}>
                      <div style={{ fontSize:'10.5px', fontWeight:850, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'7px' }}>Work Locations Found</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                        {workLocations.map((loc,i)=><span key={i} style={{ background:'#fff', border:'1px solid var(--bd4)', color:'#334155', borderRadius:'999px', padding:'3px 8px', fontSize:'11px', fontWeight:700 }}>{loc}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {skillList.length > 0 && (
                <div style={{ marginTop:'12px' }}>
                  <div style={{ fontSize:'10.5px', fontWeight:850, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'7px' }}>Skills Extracted from CV</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                    {skillList.map((s,i)=><span key={i} style={{ background:'#eef4fb', border:'1px solid #c7d7e8', color:'#1f4e79', borderRadius:'999px', padding:'4px 9px', fontSize:'11px', fontWeight:750 }}>{s}</span>)}
                  </div>
                </div>
              )}
            </div>

            {/* ── CONTACT ── */}
            <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Contact</div>
              <Row label="Phone / WhatsApp" value={[c.phone, c.whatsapp].filter(Boolean).join(' · ') || c.phone} />
              <Row label="Email" value={c.email} />
              <Row label="Current Location" value={c.current_location} />
              <Row label="Home Address" value={c.home_address} />
            </div>

            {/* ── PERSONAL ── */}
            <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Personal</div>
              <Row label="Nationality" value={c.nationality} />
              <Row label="Date of Birth" value={c.dob_candidate} />
              <Row label="Marital Status" value={c.marital_status} />
              <Row label="Religion" value={c.religion} />
              <Row label="Languages" value={c.languages} />
            </div>

            {/* ── PASSPORT / ID ── */}
            <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Passport & ID</div>
              <Row label="Passport No" value={c.passport_no} />
              <Row label="Passport Expiry" value={c.passport_expiry_candidate} />
              <Row label="Place of Issue" value={c.place_of_issue} />
              <Row label="Emirates ID" value={c.emirates_id} />
              <Row label="EID Expiry" value={c.eid_expiry} />
            </div>

            {/* ── EDUCATION ── */}
            {(c.education || c.edu_level || c.edu_spec || c.edu_inst) && (
              <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Education</div>
                <Row label="Highest Qualification" value={c.education || c.edu_level} />
                <Row label="Specialisation" value={c.edu_spec} />
                <Row label="Institution" value={c.edu_inst} />
                <Row label="Year" value={c.edu_year} />
              </div>
            )}

            {/* ── EXPERIENCE & SKILLS ── */}
            <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Experience & Skills</div>
              <Row label="Position Applied" value={c.position} />
              <Row label="Total Experience" value={c.experience ? `${c.experience} years` : null} />
              <Row label="Current Employer" value={c.current_employer} />
              <Row label="Current Designation" value={c.current_designation} />
              <Row label="GCC / ME Experience" value={c.me_experience === 'yes' ? 'Yes — worked in Middle East/GCC' : c.me_experience === 'no' ? 'No — no Middle East experience' : null} />
              <Row label="Available From" value={c.available_from} />
              <Row label="Current Salary" value={c.current_salary ? `AED ${Number(c.current_salary).toLocaleString()}` : null} />
              {c.skills && (
                <div style={{ padding:'8px 0', borderBottom:'1px solid var(--bd3)' }}>
                  <div style={{ fontSize:'11px', color:'#64748b', fontWeight:700, marginBottom:'7px' }}>Key Skills</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                    {c.skills.split(/[,;]/).map((s,i) => s.trim() && <span key={i} style={{ background:'#eff6ff', color:'#1d4ed8', padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:600 }}>{s.trim()}</span>)}
                  </div>
                </div>
              )}
            </div>

            {/* ── WORK HISTORY (structured JSON) ── */}
            {wh.length > 0 && (
              <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Work History</div>
                <div className="rdb-work-table-wrap">
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11.5px', minWidth:'620px' }}>
                    <thead><tr style={{ background:'#f1f5f9' }}>
                      {['Company','Role','Location','Period'].map(h=><th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:700, color:'#475569', fontSize:'11px', borderBottom:'1px solid var(--bd1)' }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {wh.map((row,i)=>(
                        <tr key={i} style={{ borderTop:i>0?'1px solid #f1f5f9':'none', background:i%2===0?'#fff':'#fafbfc' }}>
                          <td style={{ padding:'7px 10px', fontWeight:600, color:'#0f172a' }}>{row.company||'—'}</td>
                          <td style={{ padding:'7px 10px', color:'#475569' }}>{row.designation||row.role||'—'}</td>
                          <td style={{ padding:'7px 10px', color:'#64748b' }}>{row.location||row.work_location||row.country||'—'}</td>
                          <td style={{ padding:'7px 10px', color:'#64748b', fontSize:'11px', whiteSpace:'nowrap' }}>{row.period || row.duration || row.years || [row.from,row.to].filter(Boolean).join(' → ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── WORK HISTORY (me_notes — from AI resume scan, plain text) ── */}
            {!wh.length && c.me_notes && (
              <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Work History (from CV scan)</div>
                <div style={{ fontSize:'12px', color:'#334155', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                  {c.me_notes.split(/[;\n]/).filter(Boolean).map((line, i) => (
                    <div key={i} style={{ padding:'5px 0', borderBottom:'1px solid var(--bd3)', display:'flex', gap:'6px', alignItems:'flex-start' }}>
                      <span style={{ color:'#2563eb', flexShrink:0, marginTop:'2px' }}>▸</span>
                      <span>{line.trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CERTIFICATIONS ── */}
            {(c.certifications_held || c.other_certifications) && (
              <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Certifications</div>
                {c.certifications_held && (
                  <div style={{ padding:'6px 0', borderBottom:'1px solid var(--bd3)' }}>
                    <div style={{ fontSize:'11px', color:'#64748b', fontWeight:700, marginBottom:'6px' }}>Professional Certifications</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                      {c.certifications_held.split(',').map((s,i) => s.trim() && (
                        <span key={i} style={{ background:'#fef9c3', color:'#854d0e', padding:'3px 9px', borderRadius:'10px', fontSize:'11px', fontWeight:600 }}>{s.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
                <Row label="Other Certifications" value={c.other_certifications} />
              </div>
            )}

            {/* ── OFFER & SALARY ── */}
            {(c.basic_salary || c.allowance || c.deployment_site || c.accommodation_by) && (
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:800, color:'#15803d', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Offer & Deployment</div>
                <Row label="Basic Salary" value={c.basic_salary ? `AED ${Number(c.basic_salary).toLocaleString()}/month` : null} />
                <Row label="Allowance" value={c.allowance ? `AED ${Number(c.allowance).toLocaleString()}/month` : null} />
                <Row label="Total Package" value={c.total_salary ? `AED ${Number(c.total_salary).toLocaleString()}/month` : null} />
                <Row label="Deployment Site" value={c.deployment_site} />
                <Row label="Accommodation" value={c.accommodation_by} />
                <Row label="Transport" value={c.transport_by} />
                <Row label="Air Ticket" value={c.air_ticket} />
              </div>
            )}

            {/* ── MEDICAL ── */}
            {(c.gamka_result || c.medical_conditions || c.medical_notes) && (
              <div style={{ background:'#faf5ff', border:'1px solid #e9d5ff', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Medical</div>
                <Row label="Medical Result" value={c.gamka_result} />
                <Row label="Medical Date" value={c.gamka_date} />
                <Row label="Medical Conditions" value={c.medical_conditions} />
                {c.medical_notes && <Row label="Notes" value={c.medical_notes} />}
              </div>
            )}

            {/* ── FAMILY ── */}
            {(c.dependants_count || c.children_count || c.family_in_uae || c.emergency_contact) && (
              <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Family & Emergency</div>
                <Row label="Dependants" value={c.dependants_count} />
                <Row label="Children" value={c.children_count} />
                <Row label="Family in UAE" value={c.family_in_uae} />
                <Row label="Family Details" value={c.family_details} />
                <Row label="Emergency Contact" value={c.emergency_contact} />
              </div>
            )}

            {/* ── NOTES / REMARKS ── */}
            {(c.remarks || c.verdict_reason || c.interview_notes) && (
              <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Notes & Recruiter Comments</div>
                <Row label="Remarks" value={c.remarks} />
                <Row label="Verdict Reason" value={c.verdict_reason} />
                <Row label="Interview Notes" value={c.interview_notes} />
              </div>
            )}

            {/* ── PIPELINE / REFERRAL / ASSESSMENT ── */}
            <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Pipeline & Assessment</div>
              <Row label="Referred By" value={c.referred_by} />
              <Row label="Referrer Contact" value={c.referred_contact} />
              <Row label="Interview Date" value={c.interview_date} />
              <Row label="Interview Mode" value={c.interview_type} />
              <Row label="Interviewed By" value={c.interviewed_by} />
              <Row label="Interview Score" value={c.interview_score ? `${c.interview_score}/30` : null} />
              {c.interview_verdict && <Row label="Verdict" value={c.interview_verdict==='selected'?'Selected':c.interview_verdict==='onhold'?'On Hold':c.interview_verdict==='rejected'?'Not Suitable':c.interview_verdict} />}
              {c.verdict_reason && <Row label="Reason" value={c.verdict_reason} />}
              {c.interview_notes && <Row label="Interview Notes" value={c.interview_notes} />}
              {c.remarks && (
                <div style={{ padding:'8px 0', borderBottom:'1px solid var(--bd3)' }}>
                  <div style={{ fontSize:'11px', color:'#64748b', fontWeight:700, marginBottom:'4px' }}>Remarks</div>
                  <div style={{ fontSize:'12px', color:'#334155', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{c.remarks}</div>
                </div>
              )}
              <Row label="Added" value={c.created_at ? fmtDateDisplay(c.created_at) : null} />
              {c.updated_at && c.updated_at !== c.created_at && <Row label="Last Updated" value={fmtDateDisplay(c.updated_at)} />}
            </div>

          </div>
        </ResizablePanel>

        {/* CV Viewer overlay */}
        {cvViewer && (
          <CvViewerOverlay
            cvPath={cvViewer.cvPath}
            base64={cvViewer.base64}
            url={cvViewer.url}
            fileName={cvViewer.fileName}
            supaUrl="https://oaerqjrkdpuhiproppaz.supabase.co"
            supaKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI"
            onClose={()=>setCvViewer(null)}
          />
        )}
        </>
      );
    }


    // -------- Hiring Modal --------
    // ── Uncontrolled field: lag-free text input that reads from dataRef ──
    function UF({ label, fieldKey, dataRef, type='text', opts, wide, placeholder, onBlur }) {
      const inputRef = React.useRef(null);
      React.useEffect(() => {
        if (inputRef.current) inputRef.current.value = dataRef.current[fieldKey] || '';
      }, [fieldKey]);
      const handleChange = (e) => { dataRef.current[fieldKey] = e.target.value; };
      const handleBlur = (e) => { dataRef.current[fieldKey] = e.target.value; if (onBlur) onBlur(fieldKey, e.target.value); };
      if (opts) {
        return (
          <div style={{ gridColumn: wide?'span 2':undefined }}>
            <label style={S.label}>{label}</label>
            <select data-fk={fieldKey} defaultValue={dataRef.current[fieldKey]||''} onChange={e=>{ dataRef.current[fieldKey]=e.target.value; }}
              style={{ ...S.input, width:'100%' }}>
              <option value="">— Select —</option>
              {opts.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        );
      }
      if (type==='textarea') return (
        <div style={{ gridColumn: wide?'span 2':undefined }}>
          <label style={S.label}>{label}</label>
          <textarea data-fk={fieldKey} ref={inputRef} defaultValue={dataRef.current[fieldKey]||''} onChange={handleChange} onBlur={handleBlur}
            placeholder={placeholder} style={{ ...S.input, width:'100%', minHeight:'70px', resize:'vertical' }} />
        </div>
      );
      return (
        <div style={{ gridColumn: wide?'span 2':undefined }}>
          <label style={S.label}>{label}</label>
          <input data-fk={fieldKey} ref={inputRef} type={type} defaultValue={dataRef.current[fieldKey]||''} onChange={handleChange} onBlur={handleBlur}
            placeholder={placeholder} style={{ ...S.input, width:'100%' }} />
        </div>
      );
    }

    // Hoisted to module scope (was previously defined INSIDE HiringModal's render body,
    // recreated on every render). A function component recreated every render has an unstable
    // identity, so React treated each render's version as a brand-new component type and
    // unmounted/remounted it — wiping out its local `open` state. Since HRApp's header clock
    // ticks every second (setNow) and cascades a re-render down through this whole tree, any
    // expanded step row was silently collapsing back within about a second, before there was
    // time to fill in a date. Declaring it once here as a real top-level component fixes that:
    // its identity stays stable across re-renders, so `open` survives.
    function VisaStepRow({ step, d, sopSteps, renderKey, setRenderKey, showToast, saveVisaStepField }) {
      const isAnchor = step.dateField && ANCHOR_DATE_FIELDS.includes(step.dateField);
      const hasDate = step.dateField ? !!d[step.dateField] : false;
      const confirmedNoDate = step.dateField ? isStepConfirmed(d, step.dateField) : false;
      const done = hasDate || confirmedNoDate;
      const [open, setOpen] = React.useState(false);

      const applyCascade = (dateField) => {
        const { confirmations, skippedAnchors } = cascadeStepConfirmations(d, sopSteps, dateField);
        d.step_confirmations = JSON.stringify(confirmations);
        if (skippedAnchors.length) showToast('Earlier step "' + skippedAnchors[0] + '" still needs an exact date before it counts as complete.', 'error');
        setRenderKey(k=>k+1);
        saveVisaStepField({ [dateField]: d[dateField] || null, step_confirmations: d.step_confirmations });
      };
      const markCompleteNoDate = () => {
        const confirmations = parseStepConfirmations(d);
        confirmations[step.dateField] = true;
        d.step_confirmations = JSON.stringify(confirmations);
        applyCascade(step.dateField);
      };

      return (
        <div style={{ border:`1.5px solid ${done?'#86efac':'#e2e8f0'}`, borderRadius:'10px', overflow:'hidden', marginBottom:'8px', background: done?'#f0fdf4':'#fff' }}>
          <div onClick={()=>setOpen(o=>!o)} style={{ padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', userSelect:'none' }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:800, background:done?'#16a34a':'#cbd5e1', color:'#fff' }}>
              {done ? '✓' : step.ref}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:done?'#166534':'#1e293b' }}>{step.label}</div>
              <div style={{ fontSize:'10.5px', color:'#64748b', marginTop:'1px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                <span><EmojiIcon e="👤" /> {step.who}</span>
                <span><EmojiIcon e="⏱" /> {step.tat}</span>
                {hasDate && <span style={{ color:'#059669', fontWeight:600 }}><EmojiIcon e="📅" /> {d[step.dateField]}</span>}
                {confirmedNoDate && !hasDate && <span style={{ color:'#059669', fontWeight:600 }}>Completed · date not recorded</span>}
                {isAnchor && !done && <span style={{ color:'#92400e', fontWeight:600 }}>Needs an exact date</span>}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
              {step.dateField ? (done
                ? <span style={{ fontSize:'11px', background:'#dcfce7', color:'#166534', padding:'2px 10px', borderRadius:'10px', fontWeight:700 }}>Done</span>
                : <span style={{ fontSize:'11px', background:'#f1f5f9', color:'#64748b', padding:'2px 10px', borderRadius:'10px', fontWeight:600 }}>Pending</span>)
                : <span style={{ fontSize:'11px', background:'#f1f5f9', color:'#475569', padding:'2px 10px', borderRadius:'10px', fontWeight:600 }}>—</span>}
              <span style={{ fontSize:'12px', color:'#94a3b8', transform:open?'rotate(180deg)':'rotate(0)', transition:'0.2s', display:'inline-block' }}>▼</span>
            </div>
          </div>
          {open && (
            <div style={{ borderTop:'1px solid var(--bd1)', padding:'14px 16px', background:'#fafafa', display:'flex', flexDirection:'column', gap:'10px' }}>
              {step.warning && <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', color:'#92400e', fontWeight:600 }}>{step.warning}</div>}
              <div style={{ fontSize:'11.5px', color:'#64748b', background:'#eff6ff', padding:'8px 12px', borderRadius:'8px', border:'1px solid #bfdbfe', lineHeight:1.6 }}><EmojiIcon e="💡" /> {step.hint}</div>
              {step.dateField && (
                <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'4px' }}>Date completed</label>
                    <input key={`${step.dateField}-${renderKey}`} type="date"
                      defaultValue={d[step.dateField]||''}
                      onChange={e=>{ d[step.dateField]=e.target.value; if (e.target.value) applyCascade(step.dateField); else { setRenderKey(k=>k+1); saveVisaStepField({ [step.dateField]: null }); } }}
                      style={{ width:'100%', padding:'7px 10px', border:'1px solid var(--bd2)', borderRadius:'7px', fontSize:'13px', fontFamily:'inherit', background:'#fff' }} />
                  </div>
                  {step.refField && (
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'4px' }}>{step.refLabel||'Reference No.'}</label>
                      <input key={`${step.refField}-${renderKey}`} type="text"
                        defaultValue={d[step.refField]||''}
                        onChange={e=>{ d[step.refField]=e.target.value; }}
                        onBlur={e=>{ saveVisaStepField({ [step.refField]: e.target.value || null }); }}
                        placeholder="Enter reference number"
                        style={{ width:'100%', padding:'7px 10px', border:'1px solid var(--bd2)', borderRadius:'7px', fontSize:'13px', fontFamily:'inherit' }} />
                    </div>
                  )}
                  {step.expiryField && (
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'4px' }}>{step.expiryLabel||'Expiry Date'}</label>
                      <input key={`${step.expiryField}-${renderKey}`} type="date"
                        defaultValue={d[step.expiryField]||''}
                        onChange={e=>{ d[step.expiryField]=e.target.value; setRenderKey(k=>k+1); saveVisaStepField({ [step.expiryField]: e.target.value || null }); }}
                        style={{ width:'100%', padding:'7px 10px', border:'1px solid var(--bd2)', borderRadius:'7px', fontSize:'13px', fontFamily:'inherit' }} />
                    </div>
                  )}
                  {step.resultField && (
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', display:'block', marginBottom:'4px' }}>Result</label>
                      <select key={`${step.resultField}-${renderKey}`}
                        defaultValue={d[step.resultField]||''}
                        onChange={e=>{ d[step.resultField]=e.target.value; saveVisaStepField({ [step.resultField]: e.target.value || null }); }}
                        style={{ width:'100%', padding:'7px 10px', border:'1px solid var(--bd2)', borderRadius:'7px', fontSize:'13px', fontFamily:'inherit', background:'#fff' }}>
                        <option value="">— Select —</option>
                        {step.resultOpts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  )}
                {!hasDate && !isAnchor && (
                  <button type="button" onClick={markCompleteNoDate}
                    style={{ alignSelf:'flex-start', background: confirmedNoDate ? '#dcfce7' : '#f8fafc', border:'1px solid ' + (confirmedNoDate ? '#86efac' : '#cbd5e1'), color: confirmedNoDate ? '#166534' : '#475569', borderRadius:'7px', padding:'7px 14px', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    <EmojiLabel text={confirmedNoDate ? '✓ Marked completed — date unknown' : 'Mark completed — date unknown'} />
                  </button>
                )}
                {isAnchor && (
                  <div style={{ fontSize:'11px', color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'7px', padding:'7px 10px' }}>This date starts a compliance deadline elsewhere — an exact date is needed here, not just a completion mark.</div>
                )}
                </div>
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    function HiringModal({ record, onSave, onDelete, onClose, showToast, onOpenSheet, onMoveLocation, onHiringUpdate, onStartVisaProcessing }) {
      // Use ref for data so text inputs don't cause re-renders
      // position_selected is intentionally left blank until the interviewer confirms it after the interview
      const initRecord = { step:'resume', status:'Active', ...record };
      const dataRef = React.useRef(initRecord);
      const [activeTab, setActiveTab] = useState('candidate');
      const [docState, setDocState] = useState({}); // per-docKey: { preview, scanning, ocr, applied }
      const [renderKey, setRenderKey] = useState(0); // force re-render when needed
      // Salary monthly/hourly toggle for the Decision tab — declared here (not inside the
      // tab's conditional render block) so it's called on every render regardless of which
      // tab is active. A hook called only when activeTab==='offer' would change the total
      // hook count between renders and crash React (error #310).
      const [salaryMode, setSalaryMode] = useState(initRecord.rate_per_hour && !initRecord.basic_salary ? 'hourly' : 'monthly');
      const [moving, setMoving] = useState(false); // disables the move button while the request is in flight
      const [savingCandidate, setSavingCandidate] = useState(false); // disables Save Candidate + shows progress while the save request is in flight
      const [previewDoc, setPreviewDoc] = useState(null); // { url, isPdf, label }
      const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
      // Build blob URL whenever a PDF is previewed — forces browser PDF viewer, not Adobe
      useEffect(() => {
        if (!previewDoc || !previewDoc.isPdf || !previewDoc.url) { setPdfBlobUrl(null); return; }
        try {
          const b64 = previewDoc.url.split(',')[1];
          const bytes = atob(b64);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          const blob = new Blob([arr], { type: 'application/pdf' });
          const bUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(bUrl);
          return () => URL.revokeObjectURL(bUrl);
        } catch(e) { setPdfBlobUrl(null); }
      }, [previewDoc]);

      const updateField = (k, v) => { dataRef.current[k] = v; };

      // ── Joining Report — available for pipeline candidates too (e.g. temp IDs like
      // 'SA1010T') who've already arrived / are mid visa-processing but aren't in the
      // employees table yet. Maps hiring_pipeline's field names onto the same shape
      // JoiningReportModal expects from a real employee record.
      const [showJoiningReport, setShowJoiningReport] = useState(false);
      const joiningReportInput = () => {
        const d = dataRef.current;
        const parts = (d.emergency_contact || '').split(/—|-/).map(s => (s||'').trim()).filter(Boolean);
        return {
          employee_id: d.temp_employee_id || '',
          full_name: d.candidate_name || '',
          position: d.position_selected || d.position || '',
          department: d.department || '',
          nationality: d.nationality || '',
          mobile: d.phone || d.whatsapp || '',
          email: d.email || '',
          passport_no: d.passport_no || '',
          passport_expiry: d.passport_expiry_candidate || '',
          camp_arrival_date: d.arrival_date || d.date_of_arrival || '',
          actual_joining_date: d.residence_visa_date || '',
          emergency_name: parts[0] || '',
          emergency_relation: parts[1] || '',
          emergency_mobile: parts[2] || '',
          emergency_country: '',
        };
      };
      const saveJoiningReportPatch = async (patch) => {
        const id = dataRef.current.id;
        if (!id) { showToast && showToast('⚠️ Save the candidate first (💾 Save Candidate below), then generate the Joining Report.', 'error'); throw new Error('Candidate not saved yet'); }
        const dbPatch = {
          arrival_date: patch.camp_arrival_date || null,
          date_of_arrival: patch.camp_arrival_date || null,
          residence_visa_date: patch.actual_joining_date || null,
        };
        const combinedEmergency = [patch.emergency_name, patch.emergency_relation, patch.emergency_mobile].filter(Boolean).join(' — ');
        if (combinedEmergency) dbPatch.emergency_contact = combinedEmergency;
        const { error } = await db.from('hiring_pipeline').update(dbPatch).eq('id', id);
        if (error) { showToast && showToast('❌ Could not save joining details: ' + error.message, 'error'); throw error; }
        Object.assign(dataRef.current, dbPatch);
        if (onHiringUpdate) onHiringUpdate({ id, ...dbPatch });
      };

      // Collect current values from dataRef for saving
      const collectAndSave = async () => {
        if (savingCandidate) return; // guard against double-clicks firing two saves at once
        setSavingCandidate(true);
        try {
          // Sweep all inputs/selects/textareas inside the modal to catch any unfired onChange
          const modal = document.querySelector('[data-hiring-modal]');
          if (modal) {
            modal.querySelectorAll('input[data-fk], select[data-fk], textarea[data-fk]').forEach(el => {
              if (el.dataset.fk) dataRef.current[el.dataset.fk] = el.value;
            });
          }
          if (!dataRef.current.candidate_name || !dataRef.current.candidate_name.trim()) {
            showToast('⚠️ Candidate name is required before saving', 'error');
            return;
          }
          await onSave({ ...dataRef.current });
        } catch (e) {
          // onSave (saveHiring) already has its own try/catch and toasts — this is a last-resort
          // net so a bug anywhere in the save path (or in collecting the form values above) always
          // surfaces something instead of the button silently doing nothing.
          console.error('Save Candidate failed:', e);
          showToast('❌ Save failed: ' + (e && e.message ? e.message : 'unknown error — check browser console for details'), 'error');
        } finally {
          setSavingCandidate(false);
        }
      };

      // Change the visa route (S1/S2/S3). Saves to Supabase IMMEDIATELY (like the verdict
      // buttons) instead of waiting for "Save Candidate" — previously the click only updated
      // dataRef in memory, so closing the modal (✖, Cancel, or clicking outside) before hitting
      // Save Candidate silently discarded the change, which looked like "can't change the visa route".
      const handleScenarioClick = async (newId) => {
        const d = dataRef.current;
        const cur = d.hiring_scenario;
        if (cur === newId) return;
        if (cur) {
          const progressFields = ['work_permit_date','status_change_date','entry_permit_date','visa_arranged_date','visa_cancel_date','medical_fitness_date','eid_biometric_date','visa_stamped_in_passport_date'];
          const hasProgress = progressFields.some(f => d[f]) || (d.step_confirmations && d.step_confirmations !== '{}');
          if (hasProgress) {
            const curLabel = HIRING_SCENARIOS.find(s=>s.id===cur)?.shortLabel || cur;
            const newLabel = HIRING_SCENARIOS.find(s=>s.id===newId)?.shortLabel || newId;
            const ok = window.confirm('This candidate already has visa-route progress recorded under ' + curLabel + '. Switching to ' + newLabel + ' changes which steps apply from here. Dates already recorded on shared steps (medical, EID, etc.) are kept. Continue?');
            if (!ok) return;
          }
        }
        d.hiring_scenario = newId;
        setRenderKey(k => k + 1);
        if (d.id) {
          try {
            const { data, error } = await db.from('hiring_pipeline').update({ hiring_scenario: newId }).eq('id', d.id).select();
            if (error) showToast('Visa route save failed: ' + error.message, 'error');
            else if (!data || data.length === 0) showToast('❌ Visa route save affected 0 rows — check Supabase RLS policy (WITH CHECK) on hiring_pipeline UPDATE.', 'error');
            else {
              showToast('Visa route saved — ' + (HIRING_SCENARIOS.find(s=>s.id===newId)?.shortLabel || newId));
              if (onHiringUpdate) onHiringUpdate({ id: d.id, hiring_scenario: newId });
            }
          } catch(e) { showToast('Error: ' + e.message, 'error'); }
        }
      };

      // Move this candidate between the active Hiring Pipeline and the Resume Database.
      // Saves to Supabase immediately (same pattern as the verdict buttons / visa route click)
      // so the move sticks even if the modal is closed right after.
      const handleMoveLocation = async (newLocation) => {
        const d = dataRef.current;
        if (!d.id) { showToast('Save the candidate first, then move them.', 'error'); return; }
        setMoving(true);
        try {
          await onMoveLocation(d.id, newLocation);
          showToast(newLocation === 'resume_db' ? `🗄️ ${d.candidate_name||'Candidate'} moved to Resume Database` : `↩️ ${d.candidate_name||'Candidate'} moved back to Hiring Pipeline`);
          onClose();
        } catch (e) {
          showToast('❌ Move failed: ' + e.message, 'error');
        } finally {
          setMoving(false);
        }
      };

      // Immediately persist a Visa Steps field change to Supabase — same pattern as the visa
      // route / verdict / move-location actions above. The step date, reference, expiry and
      // result inputs previously only mutated dataRef in memory, so closing the modal (✖) or
      // clicking outside instead of hitting "Save Candidate" silently discarded whatever was
      // just entered on that tab — it looked like the data "reverted to null/Pending" the next
      // time the record was opened, even though nothing was actually wrong with the values.
      const saveVisaStepField = async (patch) => {
        const d = dataRef.current;
        if (!d.id) { showToast('Save the candidate first (💾 Save Candidate below) so visa step dates can be saved.', 'error'); return; }
        // Schema-cache-safe update: if a column doesn't exist yet in Supabase (e.g. the new
        // typing_center_date field on the simplified pipeline), drop it and retry so the rest
        // of the patch still saves instead of failing outright.
        let payload = { ...patch };
        const isMissingCol = (err, col) => {
          const msg = (err && (err.message || err.details || '')) || '';
          return new RegExp(col, 'i').test(msg) && /(schema cache|does not exist|column)/i.test(msg);
        };
        try {
          let droppedCols = [];
          for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
            const { data, error } = await db.from('hiring_pipeline').update(payload).eq('id', d.id).select();
            if (!error) {
              if (!data || data.length === 0) { showToast('❌ Step save affected 0 rows — check Supabase RLS policy (WITH CHECK) on hiring_pipeline UPDATE.', 'error'); return; }
              if (onHiringUpdate) onHiringUpdate({ id: d.id, ...payload });
              if (droppedCols.length) showToast(`⚠ Saved, but "${droppedCols.join(', ')}" isn't a column in Supabase yet — run the pending SQL migration in Settings to store it.`, 'error');
              return;
            }
            const badCol = Object.keys(payload).find(col => isMissingCol(error, col));
            if (!badCol) { showToast('Step save failed: ' + error.message, 'error'); return; }
            droppedCols.push(badCol);
            delete payload[badCol];
            if (Object.keys(payload).length === 0) { showToast('Step save failed: ' + error.message, 'error'); return; }
          }
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
      };

      const HIRING_DOC_TYPES = [
        { key:'passport_img_url', label:'🛂 Passport', accept:'image/jpeg,image/png,image/webp,application/pdf',
          ocrPrompt:`OCR this passport. Extract:
1. Full name (surname + given names)
2. Passport number
3. Date of birth (YYYY-MM-DD)
4. Nationality
5. Expiry date (YYYY-MM-DD)
Reply ONLY as valid JSON, no markdown:
{"fullName":"...","passportNo":"...","dob":"YYYY-MM-DD","nationality":"...","expiryDate":"YYYY-MM-DD"}
Use null for missing fields.` },
        { key:'resume_url', label:'📄 Resume / CV', accept:'image/jpeg,image/png,application/pdf',
          ocrPrompt:`Read this resume/CV and extract the following fields. For meExperience: answer "yes" if the candidate has worked in any Middle East country (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, Iraq), otherwise "no". For workHistory: list the top 8 experience rows as "Company | Role/Designation | Work Location/Country/Site | Period" separated by semicolons. For meNotes: list ALL companies from the experience table regardless of country — include company, country/site, role and period. For eduLevel: the highest qualification stated (e.g. Diploma, Bachelor's, ITI, High School). For areaOfExpertise: the candidate's primary technical/functional specialization, distinct from their literal job title — pick the single best-fit category such as "QA/QC", "Piping Supervision", "Planning & Scheduling", "HSE/Safety", "Project Management", "Construction Supervision", "Electrical", "Instrumentation", "Welding Inspection", "Civil/Structural", "Mechanical", "Procurement", "Document Control", "Commissioning", or similar — infer this from their overall work history and skills, not just their most recent title. Do NOT extract or guess notice period or availability date — leave that null. Reply ONLY with valid JSON, no markdown:
{"fullName":"...","passportNo":"...","passportExpiry":"YYYY-MM-DD","placeOfIssue":"...","experienceYears":"...","position":"...","phone":"...","email":"...","currentEmployer":"...","currentDesignation":"...","areaOfExpertise":"...","skills":"comma-separated technical skills/tools/certifications/trade skills max 25","eduLevel":"...","meExperience":"yes or no","workHistory":"Company | Role | Location | Period; Company | Role | Location | Period","meNotes":"full experience history with companies, countries, roles and periods","noticePeriod":null}
Use null for missing fields.` },
        { key:'interview_sheet_url', label:'📝 Filled Interview Sheet', accept:'image/jpeg,image/png,application/pdf',
          ocrPrompt:`This is a filled SATCO Arabia Candidate Interview Sheet. Extract data that is WRITTEN, TYPED, or FILLED IN by hand. For checkbox fields (certifications), only extract items where the checkbox is PHYSICALLY TICKED — do NOT list items just because their label is printed on the form. Reply ONLY as valid JSON, no markdown fences, no preamble:
{
  "fullName": "candidate full name",
  "dob": "YYYY-MM-DD or null",
  "nationality": "nationality",
  "passportNo": "passport number",
  "passportExpiry": "YYYY-MM-DD or null",
  "placeOfIssue": "place of issue",
  "religion": "religion",
  "maritalStatus": "Single or Married or Divorced or Widowed",
  "phone": "mobile number",
  "whatsapp": "whatsapp number",
  "email": "email address",
  "languages": "languages known",
  "currentLocation": "current location/country",
  "address": "home address",
  "referredBy": "referred by",
  "eduLevel": "highest qualification",
  "eduSpec": "specialisation/trade",
  "eduInst": "institution/college",
  "eduYear": "year of passing",
  "position": "position applied for",
  "experienceYears": "total years experience",
  "currentEmployer": "current/last employer",
  "currentDesignation": "current/last designation",
  "currentSalary": "current salary",
  "noticePeriod": "notice period or available from",
  "skills": "key skills listed",
  "meExperience": "yes or no",
  "meNotes": "full work history from all companies",
  "otherCerts": "ONLY certificates PHYSICALLY TICKED with a checkmark on the form. The form has printed checkboxes — only return items where a visible tick/check mark is in the box. If NO boxes are ticked, return null. Do NOT return names from unchecked printed labels.",
  "dependants": "number of dependants",
  "children": "number of children",
  "familyUae": "family in UAE status",
  "emergencyContact": "emergency contact details",
  "scoreTechnical": "technical score 1-5 or null",
  "scoreComm": "communication score 1-5 or null",
  "scoreSafety": "safety score 1-5 or null",
  "scoreExp": "experience score 1-5 or null",
  "scoreAttitude": "attitude score 1-5 or null",
  "scoreDocs": "docs/certs score 1-5 or null",
  "interviewDate": "YYYY-MM-DD or null",
  "interviewedBy": "interviewer name",
  "interviewMode": "interview mode",
  "verdict": "Selected or On Hold or Not Suitable or null",
  "verdictReason": "verdict reason/notes",
  "interviewNotes": "interviewer observations",
  "basicSalary": "basic salary offered",
  "allowance": "allowance offered",
  "accommodation": "accommodation arrangement",
  "transport": "transport arrangement",
  "food": "food arrangement",
  "joiningDate": "expected joining date YYYY-MM-DD or null",
  "visaCategory": "visa category",
  "deploymentSite": "deployment site",
  "offerNotes": "special terms notes",
  "medicalConditions": "known medical conditions",
  "onMedication": "on medication status",
  "colourBlind": "colour blindness status",
  "visionAids": "vision/hearing aids",
  "fitHeight": "fit for working at height",
  "fitCse": "fit for confined space",
  "gamkaResult": "Pre-employment medical result (Fit/Unfit/Conditional)",
  "gamkaDate": "Pre-employment medical date YYYY-MM-DD or null",
  "medicalNotes": "additional medical notes"
}
Use null for any field not found or left blank.`,
          applyFn: 'interview_sheet' },
        { key:'offer_signed_url', label:'✍️ Signed Offer Letter', accept:'image/*,.pdf', ocrPrompt:null },
        { key:'certificates_url', label:'🎓 Certificates / Trade Docs', accept:'.pdf,image/*', ocrPrompt:null },
        { key:'offer_letter_url', label:'📧 Offer Letter (sent copy)', accept:'.pdf,image/*', ocrPrompt:null },
      ];

      const handleDocFile = async (docKey, file) => {
        if (!file) return;
        const docType = HIRING_DOC_TYPES.find(d => d.key === docKey);
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');

        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          // Preview locally as base64, but persist a Storage URL to the DB —
          // hiring_pipeline rows were storing multi-MB base64 PDFs/images inline,
          // which select('*') on loadAll() re-downloaded for every candidate on every load.
          const candidateKey = dataRef.current.id || dataRef.current.candidate_name || 'new';
          const storedUrl = await uploadCertImage(candidateKey, docKey, file, 'hiring-docs');
          if (!storedUrl) {
            // Storage upload failed (bucket permissions, network, etc). Falling back to an inline
            // base64 copy so nothing is lost, but a multi-MB file here can make "Save Candidate"
            // fail silently later — warn now, while it's still obvious which file caused it.
            showToast(`⚠️ "${docType?.label||docKey}" couldn't be uploaded to Storage — keeping a local copy for now, but Save Candidate may fail if the file is large. Check the hr-documents Storage bucket is set to Public in Supabase.`, 'error');
          }
          dataRef.current[docKey] = storedUrl || dataUrl;
          setDocState(s => ({ ...s, [docKey]: { preview: dataUrl, scanning: !!docType?.ocrPrompt, ocr: null, applied: false } }));

          if (!docType?.ocrPrompt) return;

          try {
            const base64 = dataUrl.split(',')[1];
            let contentParts;
            if (isPdf) {
              // PDFs use document type
              contentParts = [
                { type:'document', source:{ type:'base64', media_type:'application/pdf', data:base64 } },
                { type:'text', text: docType.ocrPrompt }
              ];
            } else {
              // Images use image type
              const mtype = isImage ? file.type : 'image/jpeg';
              contentParts = [
                { type:'image', source:{ type:'base64', media_type:mtype, data:base64 } },
                { type:'text', text: docType.ocrPrompt }
              ];
            }

            const res = await fetch('/api/claude', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({
                model:'claude-haiku-4-5-20251001',
                max_tokens: docKey === 'interview_sheet_url' ? 3000 : 1000,
                messages:[{ role:'user', content: contentParts }]
              })
            });
            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`API error ${res.status}: ${errText.slice(0,120)}`);
            }
            const json = await res.json();
            const raw = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
            let ocr = {};
            try {
              ocr = parseClaudeJson(raw);
            } catch(e) {
              // Show full diagnostic: error + first 200 chars of raw
              ocr = { error: 'Parse failed: ' + e.message + ' | raw: ' + raw.slice(0,200) };
            }
            setDocState(s => ({ ...s, [docKey]: { ...s[docKey], scanning: false, ocr } }));
            // Auto-apply extracted fields (incl. dates like DOB / passport expiry) to the form
            // as soon as the scan succeeds — previously this required a manual "Apply to Form"
            // click, and if that click was missed (or the modal closed right after upload) the
            // scanned date fields never made it into dataRef.current, so "Save Candidate" had
            // nothing to persist and it looked like "the date isn't saved" after uploading a resume.
            if (!ocr.error) { await applyOcr(docKey, ocr); }
          } catch(e) {
            setDocState(s => ({ ...s, [docKey]: { ...s[docKey], scanning: false, ocr: { error: e.message } } }));
          }
        };
        reader.readAsDataURL(file);
      };

      const applyOcr = async (docKey, ocrOverride) => {
        const ocr = ocrOverride || docState[docKey]?.ocr;
        if (!ocr || ocr.error) return;
        const dt = HIRING_DOC_TYPES.find(d => d.key === docKey);

        // Passport fields
        if (docKey === 'passport_img_url') {
          if (ocr.fullName)    { dataRef.current.candidate_name = ocr.fullName; }
          if (ocr.passportNo)  { dataRef.current.passport_no    = ocr.passportNo; }
          if (ocr.nationality) { dataRef.current.nationality    = ocr.nationality; }
          if (ocr.dob)         { dataRef.current.dob_candidate  = ocr.dob; }
          if (ocr.expiryDate)  { dataRef.current.passport_expiry_candidate = ocr.expiryDate; }
        }
        // Resume fields
        if (docKey === 'resume_url') {
          if (ocr.fullName)           { dataRef.current.candidate_name             = ocr.fullName; }
          if (ocr.passportNo)         { dataRef.current.passport_no                = ocr.passportNo; }
          if (ocr.passportExpiry)     { dataRef.current.passport_expiry_candidate  = ocr.passportExpiry; }
          if (ocr.placeOfIssue)       { dataRef.current.place_of_issue             = ocr.placeOfIssue; }
          if (ocr.experienceYears)    { dataRef.current.experience                 = String(ocr.experienceYears); }
          // Resume OCR only tells us the position the candidate APPLIED for.
          // position_selected is the interviewer's confirmation and must stay untouched here —
          // it is filled in manually after the interview, never auto-derived.
          if (ocr.position && !dataRef.current.position) {
            dataRef.current.position = ocr.position;
          }
          if (ocr.phone)              { dataRef.current.phone                      = ocr.phone; }
          if (ocr.email)              { dataRef.current.email                      = ocr.email; }
          if (ocr.currentEmployer)    { dataRef.current.current_employer            = ocr.currentEmployer; }
          if (ocr.currentDesignation) { dataRef.current.current_designation         = ocr.currentDesignation; }
          if (ocr.areaOfExpertise)    { dataRef.current.area_of_expertise            = ocr.areaOfExpertise; }
          if (ocr.skills)             { dataRef.current.skills                      = ocr.skills; }
          if (ocr.meExperience)       { dataRef.current.me_experience               = ocr.meExperience; }
          if (ocr.meNotes)            { dataRef.current.me_notes                    = ocr.meNotes; }
          if (ocr.workHistory)        { dataRef.current.work_history                = ocr.workHistory; }
          if (!ocr.workHistory && ocr.meNotes) { dataRef.current.work_history        = ocr.meNotes; }
          if (ocr.eduLevel)           { dataRef.current.education                   = ocr.eduLevel; }
          if (ocr.nationality)        { dataRef.current.nationality                 = ocr.nationality; }
          // Never populate notice period / available_from from a resume scan
          // (it must be filled during the interview, not inferred from employment dates)

          // ── Save resume-extracted fields to DB immediately ───────────────────
          if (dataRef.current.id) {
            const RESUME_SAVE_KEYS = [
              'candidate_name','passport_no','passport_expiry_candidate','place_of_issue',
              'experience','position','phone','email',
              'current_employer','current_designation','area_of_expertise','skills',
              'education','me_experience','me_notes','work_history','nationality'
            ];
            const resumePatch = {};
            RESUME_SAVE_KEYS.forEach(k => { resumePatch[k] = dataRef.current[k] || null; });
            const { data: rpRows, error: rpErr } = await db.from('hiring_pipeline').update(resumePatch).eq('id', dataRef.current.id).select();
            if (rpErr) console.warn('Resume auto-save failed:', rpErr.message);
            else if (!rpRows || rpRows.length === 0) console.warn('Resume auto-save affected 0 rows — check RLS policy.');
          }
        }
        // ── Interview Sheet — apply ALL extracted fields and save to DB ──────
        if (docKey === 'interview_sheet_url') {
          const map = {
            fullName:          'candidate_name',
            dob:               'dob_candidate',
            nationality:       'nationality',
            passportNo:        'passport_no',
            passportExpiry:    'passport_expiry_candidate',
            placeOfIssue:      'place_of_issue',
            religion:          'religion',
            maritalStatus:     'marital_status',
            phone:             'phone',
            whatsapp:          'whatsapp',
            email:             'email',
            languages:         'languages',
            currentLocation:   'current_location',
            address:           'home_address',
            referredBy:        'referred_by',
            position:          'position',
            experienceYears:   'experience',
            currentEmployer:   'current_employer',
            currentDesignation:'current_designation',
            currentSalary:     'current_salary',
            // noticePeriod intentionally excluded — filled during interview, not from OCR
            skills:            'skills',
            meExperience:      'me_experience',
            meNotes:           'me_notes',
            // otherCerts handled below with garbage filter
            dependants:        'dependants_count',
            children:          'children_count',
            familyUae:         'family_in_uae',
            emergencyContact:  'emergency_contact',
            scoreTechnical:    'interview_score_technical',
            scoreComm:         'interview_score_comm',
            scoreSafety:       'interview_score_safety',
            scoreExp:          'interview_score_exp',
            scoreAttitude:     'interview_score_attitude',
            scoreDocs:         'interview_score_docs',
            interviewDate:     'interview_date',
            interviewedBy:     'interviewed_by',
            interviewMode:     'interview_mode',
            verdict:           'interview_verdict',
            verdictReason:     'verdict_reason',
            interviewNotes:    'interview_notes',
            basicSalary:       'basic_salary',
            allowance:         'allowance',
            accommodation:     'accommodation',
            transport:         'transport_by',
            food:              'food_by',
            joiningDate:       'expected_arrival_date',
            visaCategory:      'visa_category',
            deploymentSite:    'deployment_site',
            offerNotes:        'remarks',
            medicalConditions: 'medical_conditions',
            onMedication:      'on_medication',
            colourBlind:       'colour_blindness',
            visionAids:        'vision_aids',
            fitHeight:         'fit_for_height',
            fitCse:            'fit_for_cse',
            gamkaResult:       'gamka_result',
            gamkaDate:         'gamka_date',
            medicalNotes:      'medical_notes',
          };
          let fieldsApplied = 0;
          Object.entries(map).forEach(([ocrKey, dbKey]) => {
            const val = ocr[ocrKey];
            if (val !== null && val !== undefined && val !== '') {
              dataRef.current[dbKey] = String(val);
              fieldsApplied++;
            }
          });
          // ── Filter otherCerts: reject if OCR read the unchecked printed cert list ──
          // The interview sheet prints all cert names as labels regardless of whether ticked.
          // If the returned value contains 3+ standard cert label strings, it read unchecked items.
          if (ocr.otherCerts !== null && ocr.otherCerts !== undefined && String(ocr.otherCerts||'').trim()) {
            const PRINTED = ['ADNOC HSE','H2S Awareness','SCBA','Fire Fighting','First Aid',
              'Working at Height','Confined Space','Rigger Level','DROPS Awareness','LOTO',
              'CSWIP','AWS-CWI','API 510','NACE Coating','NDT Level','SOE Card','ADNOC TPA',
              'NEBOSH','PMP','CompEx'];
            const val = String(ocr.otherCerts);
            const hits = PRINTED.filter(lbl => val.includes(lbl)).length;
            if (hits >= 3) {
              // OCR read the printed unchecked list — discard
              dataRef.current['other_certifications'] = null;
            } else if (val.trim()) {
              dataRef.current['other_certifications'] = val;
              fieldsApplied++;
            }
          }
          // Compute total interview score
          const scoreKeys = ['interview_score_technical','interview_score_comm','interview_score_safety',
            'interview_score_exp','interview_score_attitude','interview_score_docs'];
          const total = scoreKeys.reduce((s,k) => s+(parseInt(dataRef.current[k])||0), 0);
          if (total > 0) dataRef.current.interview_score = total;
          // NOTE: stage/step is intentionally NOT auto-advanced here — moving a candidate's
          // pipeline stage is a deliberate action via the "Move to next stage" button.
          // Save immediately to DB
          if (dataRef.current.id) {
            const SAVE_KEYS = ['candidate_name','dob_candidate','nationality','passport_no',
              'passport_expiry_candidate','place_of_issue','religion','marital_status','phone',
              'whatsapp','email','languages','current_location','home_address','referred_by',
              'position','experience','current_employer','current_designation','skills',
              'me_experience','me_notes','interview_date','interviewed_by','interview_mode',
              'interview_score','interview_score_technical','interview_score_comm',
              'interview_score_safety','interview_score_exp','interview_score_attitude',
              'interview_score_docs','interview_verdict','verdict_reason','interview_notes',
              'basic_salary','allowance','deployment_site','visa_category','expected_arrival_date',
              'medical_conditions','gamka_result','gamka_date','interview_sheet_url'];
            const patch = {};
            SAVE_KEYS.forEach(k => { patch[k] = dataRef.current[k] || null; });
            const { data: ocrSavedRows, error } = await dbSaveWithRetry('hiring_pipeline', patch, dataRef.current.id);
            if (error) {
              showToast('⚠️ DB save error: ' + error.message, 'error');
            } else if (!ocrSavedRows || ocrSavedRows.length === 0) {
              showToast('❌ Save affected 0 rows — check Supabase RLS policy on hiring_pipeline UPDATE.', 'error');
            } else {
              showToast(`✅ ${fieldsApplied} fields extracted from interview sheet and saved to hiring record!`);
            }
          } else {
            showToast(`✅ ${fieldsApplied} fields extracted from interview sheet — save the candidate record to persist.`);
          }
          setDocState(s => ({ ...s, [docKey]: { ...s[docKey], applied: true } }));
          setRenderKey(k => k+1);
          setTimeout(() => setDocState(s => ({ ...s, [docKey]: { ...s[docKey], applied: false } })), 4000);
          return; // skip default flow below
        }

        setDocState(s => ({ ...s, [docKey]: { ...s[docKey], applied: true } }));
        setRenderKey(k => k+1);
        setTimeout(() => setDocState(s => ({ ...s, [docKey]: { ...s[docKey], applied: false } })), 3000);
        showToast('Details auto-filled from document ✓');
      };

      const rescanDoc = async (docKey, docType) => {
        const savedUrl = dataRef.current[docKey];
        if (!savedUrl || !docType?.ocrPrompt) return;
        const isPdf = isPdfUrl(savedUrl);
        const isImage = savedUrl.startsWith('data:image');
        setDocState(s => ({ ...s, [docKey]: { ...s[docKey], scanning: true, ocr: null } }));
        try {
          const base64 = savedUrl.split(',')[1];
          let contentParts;
          if (isPdf) {
            contentParts = [
              { type:'document', source:{ type:'base64', media_type:'application/pdf', data:base64 } },
              { type:'text', text: docType.ocrPrompt }
            ];
          } else {
            const mtype = isImage ? savedUrl.split(';')[0].split(':')[1] : 'image/jpeg';
            contentParts = [
              { type:'image', source:{ type:'base64', media_type:mtype, data:base64 } },
              { type:'text', text: docType.ocrPrompt }
            ];
          }
          const res = await fetch('/api/claude', {
            method:'POST',
            headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens: 1000, messages:[{ role:'user', content: contentParts }] })
          });
          if (!res.ok) { const t = await res.text(); throw new Error(`API error ${res.status}: ${t.slice(0,120)}`); }
          const json = await res.json();
          const raw = (json.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
          let ocr = {};
          try {
            ocr = parseClaudeJson(raw);
          } catch(e) { ocr = { error: 'Parse failed: ' + e.message + ' | raw: ' + raw.slice(0,200) }; }
          setDocState(s => ({ ...s, [docKey]: { ...s[docKey], scanning: false, ocr } }));
        } catch(e) {
          setDocState(s => ({ ...s, [docKey]: { ...s[docKey], scanning: false, ocr: { error: e.message } } }));
        }
      };

      const tabs = [
        { id:'candidate', label:'👤 Candidate' },
        { id:'supplier',  label:'🏢 Supplier' },
        { id:'interview', label:'🎙 Interview' },
        { id:'offer',     label:'📋 Decision' },
        { id:'pipeline',  label:'🔄 Pipeline' },
        { id:'visa',      label:'🛂 Visa Steps' },
        { id:'documents', label:'📁 Documents' },
      ];

      // Memoised so this wrapper's own identity only changes when renderKey changes (matching
      // the key= below) — previously a fresh function was created on every HiringModal render.
      // React treats <F/> as a different component type whenever F's reference changes, so
      // every field built with <F/> was unmounting/remounting on every re-render of this modal
      // — including the header clock's once-a-second tick, which cascades a re-render down
      // through the whole tree. That silently reset in-progress edits and closed native
      // date/select pickers before they could register a change (reported as "Current
      // Location closes immediately" and "Step Due Date won't change").
      const F = React.useCallback((props) => <UF key={`${props.fieldKey}-${renderKey}`} dataRef={dataRef} {...props} />, [renderKey]);

      const autoCalcTotal = () => {
        const t = (parseFloat(dataRef.current.basic_salary)||0) + (parseFloat(dataRef.current.allowance)||0);
        dataRef.current.total_salary = t > 0 ? String(t) : '';
        setRenderKey(k => k+1);
      };

      return (
        <ResizablePanel
          title={record.id ? `Edit — ${dataRef.current.candidate_name || 'Candidate'}` : 'New Candidate — Hiring Pipeline'}
          subtitle="Hiring Pipeline · SATCO Arabia"
          headerColor="#1f2937"
          onClose={onClose}
          defaultSize="wide"
          zIndex={10050}>
          <div data-hiring-modal style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }} onClick={e=>e.stopPropagation()}>
            {/* Tab Bar */}
            <div className="hiring-modal-tabbar" style={{ display:'flex', borderBottom:'1px solid var(--bd1)', background:'#f8fafc', padding:'0 16px', flexShrink:0, overflowX:'auto', overflowY:'hidden', WebkitOverflowScrolling:'touch' }}>
              {tabs.map(t=>(
                <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ background: activeTab===t.id?'#dbeafe':'transparent', border:'none', borderRadius: activeTab===t.id?'8px 8px 0 0':'0', borderBottom: activeTab===t.id?'2px solid #2563eb':'2px solid transparent', padding:'10px 14px', fontSize:'12.5px', fontWeight:activeTab===t.id?800:600, color:activeTab===t.id?'#1d4ed8':'#64748b', cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', gap:6, flexShrink:0, whiteSpace:'nowrap', touchAction:'pan-x' }}><EmojiLabel text={t.label} size={13} gap={6} /></button>
              ))}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>

              {/* ── TAB: Candidate ── */}
              {activeTab==='candidate' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  <SectionHead label="Personal Details" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Full Name *" fieldKey="candidate_name" placeholder="As per passport" wide />
                    <F label="Position Applied For" fieldKey="position" placeholder="e.g. Pipe Fitter" />
                    <F label="Nationality" fieldKey="nationality" opts={['Indian','Pakistani','Bangladeshi','Sri Lankan','Nepali','Filipino','Egyptian','Sudanese','Ethiopian','Other']} />
                    <F label="Current Location" fieldKey="current_location" opts={['India','UAE','Pakistan','Bangladesh','Sri Lanka','Nepal','Philippines','Other']} />
                  </div>
                  <div style={{ background:'var(--color-background-secondary,#f8fafc)', border:'0.5px solid var(--bd1)', borderRadius:'10px', padding:'12px 16px', fontSize:'12px', color:'#64748b' }}>
                    Interview outcome, position offered, salary, benefits and visa route are all set together once the interview is done — see the <strong style={{color:'#1e293b'}}>Decision</strong> tab.
                    {dataRef.current.hiring_scenario && <span> Current visa route: <strong style={{color:HIRING_SCENARIOS.find(s=>s.id===dataRef.current.hiring_scenario)?.color||'#1e293b'}}>{HIRING_SCENARIOS.find(s=>s.id===dataRef.current.hiring_scenario)?.shortLabel||dataRef.current.hiring_scenario}</strong>.</span>}
                  </div>

                  <SectionHead label="Contact Information" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Phone" fieldKey="phone" placeholder="+91 98000 00000" />
                    <F label="WhatsApp No" fieldKey="whatsapp" placeholder="+91 98000 00000" />
                    <F label="Email" fieldKey="email" type="email" placeholder="candidate@email.com" />
                    <F label="Referred By" fieldKey="referred_by" placeholder="Name of referrer" />
                    <F label="Referrer Contact" fieldKey="referred_contact" placeholder="Phone number" />
                    <F label="Available From" fieldKey="available_from" type="date" />
                    <F label="Department" fieldKey="department" placeholder="e.g. Engineering, HSE" />
                  </div>

                  <SectionHead label="Passport & Experience" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Passport No" fieldKey="passport_no" placeholder="A1234567" />
                    <F label="Passport Expiry" fieldKey="passport_expiry_candidate" type="date" />
                    <F label="Place of Issue" fieldKey="place_of_issue" placeholder="e.g. Lucknow" />
                    <F label="Years of Experience" fieldKey="experience" placeholder="e.g. 15" />
                    <F label="Current / Last Employer" fieldKey="current_employer" placeholder="Company name" />
                    <F label="Current / Last Designation" fieldKey="current_designation" placeholder="Job title" />
                    <F label="Key Skills" fieldKey="skills" type="textarea" wide placeholder="Pipe Fabrication, Welding, Isometric Reading…" />
                  </div>

                  <SectionHead label="Experience & Middle East" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Has Middle East / Gulf Experience?" fieldKey="me_experience" opts={['yes','no']} />
                    <F label="Work History (All Companies)" fieldKey="me_notes" type="textarea" wide placeholder="e.g. ESSAR PROJECT LTD (India) — Pipe Fabricator, Jul 2019–Oct 2020; L&T (India) — Pipe Fabricator, Dec 2020–Oct 2022…" />
                  </div>
                </div>
              )}

              {/* ── TAB: Supplier ── */}
              {activeTab==='supplier' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  {/* Supplier hire toggle */}
                  <div style={{ background: dataRef.current.is_supplier_hire==='yes' ? '#eff6ff' : '#f8fafc', border:`2px solid ${dataRef.current.is_supplier_hire==='yes'?'#2563eb':'#e2e8f0'}`, borderRadius:'12px', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}
                    onClick={()=>{ dataRef.current.is_supplier_hire = dataRef.current.is_supplier_hire==='yes'?'no':'yes'; setRenderKey(k=>k+1); }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'14px', color:'#0f172a' }}><EmojiIcon e="🏢" /> Supplier / Sub-contractor Hire</div>
                      <div style={{ fontSize:'12px', color:'#64748b', marginTop:'3px' }}>This candidate is sourced from an external supplier or manpower agency and deployed to a client site</div>
                    </div>
                    <div key={`toggle-${renderKey}`} style={{ width:'44px', height:'24px', borderRadius:'12px', background: dataRef.current.is_supplier_hire==='yes'?'#2563eb':'#cbd5e1', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                      <div style={{ position:'absolute', top:'3px', left: dataRef.current.is_supplier_hire==='yes'?'23px':'3px', width:'18px', height:'18px', borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transition:'left 0.2s' }}></div>
                    </div>
                  </div>

                  {dataRef.current.is_supplier_hire==='yes' && (<>
                    <SectionHead label="Supplier / Agency Details" />
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                      <F label="Supplier / Agency Name *" fieldKey="supplier_name" placeholder="e.g. Al Faris Manpower LLC" wide />
                      <F label="Contact Person Name" fieldKey="supplier_contact_name" placeholder="Account manager name" />
                      <F label="Supplier Phone" fieldKey="supplier_phone" placeholder="+971 50 000 0000" />
                      <F label="Supplier WhatsApp" fieldKey="supplier_whatsapp" placeholder="+971 50 000 0000" />
                      <F label="Supplier Email" fieldKey="supplier_email" type="email" placeholder="supplier@agency.com" wide />
                      <F label="Supplier Address" fieldKey="supplier_address" placeholder="Office address / emirate" wide />
                    </div>

                    <SectionHead label="Additional Notes" />
                    <F label="Supplier Notes / Remarks" fieldKey="supplier_notes" type="textarea" wide placeholder="PO reference, contract terms, site deployment details, billing cycle…" />

                    <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'8px', padding:'12px 16px', fontSize:'12px', color:'#92400e', lineHeight:1.7 }}><EmojiIcon e="⚠️" /><strong>Reminder:</strong> Ensure a valid Purchase Order (PO) or supplier contract is on file before deployment. The hourly rate and food / accommodation / transport responsibility are set in the <strong><EmojiIcon e="📋" /> Decision</strong> tab — rate confirmed: <strong key={`rate-${renderKey}`}>{dataRef.current.rate_per_hour ? `AED ${dataRef.current.rate_per_hour}/hr` : 'Not set'}</strong>
                    </div>
                  </>)}

                  {dataRef.current.is_supplier_hire!=='yes' && (
                    <div style={{ textAlign:'center', padding:'40px 20px', color:'#94a3b8' }}>
                      <div style={{ fontSize:'40px', marginBottom:'12px' }}><EmojiIcon e="🏢" /></div>
                      <div style={{ fontWeight:600, fontSize:'14px', color:'#64748b' }}>Not a supplier hire</div>
                      <div style={{ fontSize:'12px', marginTop:'6px' }}>Toggle the switch above if this candidate was sourced through an external supplier or manpower agency.</div>
                    </div>
                  )}
                </div>
              )}

                            {/* ── TAB: Interview ── */}
              {activeTab==='interview' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  <SectionHead label="Interview Logistics" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Interview Date" fieldKey="interview_date" type="date" />
                    <F label="Mode" fieldKey="interview_mode" opts={['In-person (Abu Dhabi)','In-person (Dubai)','Video Call (WhatsApp)','Video Call (Teams)','Telephone']} />
                    <F label="Interviewed By" fieldKey="interviewed_by" placeholder="Interviewer name" />
                    <F label="Interview Type" fieldKey="interview_type" opts={['Technical','HR','Combined']} />
                  </div>

                  <SectionHead label="Scoring (each criterion out of 5)" />
                  <div style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
                    <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      {[
                        { label:'Technical Knowledge', fk:'interview_score_technical' },
                        { label:'Communication Skills', fk:'interview_score_comm' },
                        { label:'Safety Awareness', fk:'interview_score_safety' },
                        { label:'Experience Match', fk:'interview_score_exp' },
                        { label:'Attitude & Discipline', fk:'interview_score_attitude' },
                        { label:'Certifications & Docs', fk:'interview_score_docs' },
                      ].map(({ label, fk }) => (
                        <div key={fk} style={{ border:'1px solid var(--bd1)', borderRadius:'8px', padding:'10px 12px' }}>
                          <div style={{ fontSize:'11px', fontWeight:700, color:'#475569', marginBottom:'7px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</div>
                          <div style={{ display:'flex', gap:'5px' }}>
                            {[1,2,3,4,5].map(n => {
                              const cur = parseInt(dataRef.current[fk]||0);
                              return (
                                <button key={n} type="button" onClick={() => {
                                  dataRef.current[fk] = n;
                                  const total = [
                                    'interview_score_technical','interview_score_comm','interview_score_safety',
                                    'interview_score_exp','interview_score_attitude','interview_score_docs'
                                  ].reduce((s,k) => s + (parseInt(dataRef.current[k])||0), 0);
                                  dataRef.current.interview_score = total;
                                  setRenderKey(k=>k+1);
                                }}
                                  style={{ width:'28px', height:'28px', borderRadius:'5px', border: cur>=n ? '1px solid #d97706' : '1px solid #cbd5e1',
                                    background: cur>=n ? '#fbbf24' : '#f8fafc', color: cur>=n ? '#92400e' : '#94a3b8',
                                    fontWeight:700, fontSize:'11px', cursor:'pointer', fontFamily:'monospace' }}>
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background:'#0f172a', borderRadius:'12px', padding:'18px 20px', textAlign:'center', minWidth:'130px', flexShrink:0 }}>
                      <div key={`score-${renderKey}`} style={{ fontSize:'44px', fontWeight:800, color:'#fff', lineHeight:1, fontFamily:'monospace' }}>
                        {[
                          'interview_score_technical','interview_score_comm','interview_score_safety',
                          'interview_score_exp','interview_score_attitude','interview_score_docs'
                        ].reduce((s,k)=>s+(parseInt(dataRef.current[k])||0),0)}
                      </div>
                      <div style={{ fontSize:'11px', color:'#93c5fd', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:'4px' }}>out of 30</div>
                      <div style={{ fontSize:'11px', marginTop:'6px', color:'#6ee7b7' }}>
                        <EmojiLabel text={(() => {
                          const t = ['interview_score_technical','interview_score_comm','interview_score_safety','interview_score_exp','interview_score_attitude','interview_score_docs'].reduce((s,k)=>s+(parseInt(dataRef.current[k])||0),0);
                          if (t>=26) return '⭐ Excellent';
                          if (t>=21) return '✅ Good';
                          if (t>=17) return '🟡 Average';
                          if (t>0)   return '⚠️ Low';
                          return '—';
                        })()} />
                      </div>
                    </div>
                  </div>

                  <SectionHead label="Notes" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Interview Notes / Observations" fieldKey="interview_notes" type="textarea" wide placeholder="Overall impression, skills assessed, concerns, strengths…" />
                  </div>
                  <div style={{ background:'#f8fafc', border:'0.5px solid var(--bd1)', borderRadius:'10px', padding:'12px 16px', fontSize:'12px', color:'#64748b' }}>
                    Once scoring is done, record the verdict, position offered, salary and visa route together in the <strong style={{color:'#1e293b'}}><EmojiIcon e="📋" /> Decision</strong> tab.
                    {dataRef.current.interview_verdict && <span> Current verdict: <strong style={{color: dataRef.current.interview_verdict==='selected'?'#15803d':dataRef.current.interview_verdict==='onhold'?'#92400e':'#b91c1c'}}>{dataRef.current.interview_verdict==='selected'?'Selected':dataRef.current.interview_verdict==='onhold'?'On Hold':'Not Suitable'}</strong>.</span>}
                  </div>

                  <SectionHead label="Medical & Health" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Known Medical Conditions" fieldKey="medical_conditions" opts={['None','Diabetes','Hypertension','Heart condition','Asthma / Respiratory','Back / Spine issue','Vision impairment','Other']} />
                    <F label="On Medication?" fieldKey="on_medication" opts={['No','Yes – stable, cleared by doctor']} />
                    <F label="Colour Blindness?" fieldKey="colour_blindness" opts={['No','Yes – partial','Yes – complete']} />
                    <F label="Fit for Working at Height?" fieldKey="fit_for_height" opts={['Yes – fit','Not assessed yet','No – restricted']} />
                    <F label="Fit for Confined Space?" fieldKey="fit_for_cse" opts={['Yes – fit','Not assessed yet','No – restricted']} />
                    <F label="Pre-Employment Medical Result" fieldKey="gamka_result" opts={['Not done yet','FIT – valid','Conditionally Fit','UNFIT']} />
                    <F label="Medical Date" fieldKey="gamka_date" type="date" />
                    <F label="Medical Notes" fieldKey="medical_notes" type="textarea" wide placeholder="Any conditions to flag…" />
                  </div>

                  <SectionHead label="Family Information" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="No. of Dependants" fieldKey="dependants_count" placeholder="e.g. 3" />
                    <F label="No. of Children" fieldKey="children_count" placeholder="e.g. 2" />
                    <F label="Family in UAE?" fieldKey="family_in_uae" opts={['No – family in home country','Yes – on family visa']} />
                    <F label="Emergency Contact" fieldKey="emergency_contact" placeholder="Name — Relationship — Phone" />
                  </div>

                  <SectionHead label="🖨️ Interview Sheet" />
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'13.5px', color:'#1e40af' }}>Generate Printable Interview Sheet</div>
                      <div style={{ fontSize:'12px', color:'#3b82f6', marginTop:'3px' }}>Opens the full A4 interview sheet with this candidate's data pre-filled, ready to print or save as PDF.</div>
                    </div>
                    <button type="button" onClick={() => {
                      const d = dataRef.current;
                      const params = new URLSearchParams({
                        name: d.candidate_name||'', position: d.position||'', nationality: d.nationality||'',
                        passport_no: d.passport_no||'', passport_expiry: d.passport_expiry_candidate||'',
                        phone: d.phone||'', email: d.email||'', location: d.current_location||'',
                        experience: d.experience||'', employer: d.current_employer||'', designation: d.current_designation||'',
                        education: d.education||'', skills: d.skills||'', referred_by: d.referred_by||'',
                        dob: d.dob_candidate||'', marital: d.marital_status||'', religion: d.religion||'',
                        languages: d.languages||'', address: d.home_address||'',
                      });
                      onOpenSheet && onOpenSheet(dataRef.current); onClose();
                    }}
                      style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'10px 20px', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, fontFamily:'inherit' }}><EmojiIcon e="📝" /> Open Interview Sheet</button>
                  </div>

                </div>
              )}

              {/* ── TAB: Decision (interview outcome -> position, salary, benefits, visa route) ── */}
              {activeTab==='offer' && (() => {
                const d = dataRef.current;
                const verdict = d.interview_verdict;

                return (
                <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>

                  <SectionHead label="Interview Outcome" />
                  <div style={{ background:'#fff', border:'0.5px solid var(--bd1)', borderRadius:'12px', padding:'16px 18px', display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div>
                      <label style={S.label}>Verdict</label>
                      <div style={{ fontSize:'10px', color:'#059669', marginBottom:'5px', fontStyle:'italic' }}>Clicks save instantly — no need to hit Save Record</div>
                      <div key={`verdict-${renderKey}`} style={{ display:'flex', gap:'8px', marginTop:'4px', flexWrap:'wrap' }}>
                        {[['selected','Selected','#15803d'],['onhold','On Hold','#92400e'],['rejected','Not Suitable','#b91c1c']].map(([v,l,clr]) => (
                          <button key={v} type="button" onClick={async () => {
                            d.interview_verdict = v;
                            setRenderKey(k=>k+1);
                            if (d.id) {
                              try {
                                const { error } = await db.from('hiring_pipeline').update({ interview_verdict: v }).eq('id', d.id);
                                if (error) showToast('Verdict save failed: ' + error.message, 'error');
                                else showToast(v==='selected'?'Verdict saved — Selected':v==='onhold'?'Verdict saved — On Hold':'Verdict saved — Not Suitable');
                              } catch(e) { showToast('Error: ' + e.message, 'error'); }
                            }
                          }}
                            style={{ padding:'8px 16px', borderRadius:'8px', border:'1.5px solid',
                              borderColor: d.interview_verdict===v ? clr : '#e2e8f0',
                              background: d.interview_verdict===v ? clr : '#f8fafc',
                              color: d.interview_verdict===v ? '#fff' : '#64748b',
                              fontWeight:600, fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <F label="Verdict Reason / Comments" fieldKey="verdict_reason" type="textarea" wide placeholder="Reason for selection / hold / rejection, next steps…" />
                  </div>

                  <div style={{ background: d.pipeline_location==='resume_db' ? '#eff6ff' : '#fafaf9', border: `1px solid ${d.pipeline_location==='resume_db' ? '#bfdbfe' : '#e7e5e4'}`, borderRadius:'10px', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'14px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:'220px' }}>
                      <div style={{ fontWeight:700, fontSize:'13px', color: d.pipeline_location==='resume_db' ? '#1e40af' : '#44403c' }}>
                        <EmojiLabel text={d.pipeline_location==='resume_db' ? '🗄️ Stored in Resume Database' : 'Not moving forward right now?'} />
                      </div>
                      <div style={{ fontSize:'11.5px', color:'#64748b', marginTop:'3px' }}>
                        {d.pipeline_location==='resume_db'
                          ? "Excluded from the Hiring Pipeline's Total Active count. Bring this candidate back any time a fit comes up — they'll land in 1 · New Resumes."
                          : 'Park this candidate in the Resume Database — they stay on record with all details and remarks, searchable, and out of the active pipeline counts until you bring them back.'}
                      </div>
                    </div>
                    {record.id ? (
                      d.pipeline_location==='resume_db'
                        ? <button type="button" disabled={moving} onClick={()=>handleMoveLocation('pipeline')} style={{ background:'#059669', color:'#fff', border:'none', padding:'9px 16px', borderRadius:'8px', fontSize:'14.5px', fontWeight:700, cursor: moving?'default':'pointer', opacity: moving?0.6:1, whiteSpace:'nowrap', fontFamily:'inherit' }}>Move to Hiring Pipeline</button>
                        : <button type="button" disabled={moving} onClick={()=>handleMoveLocation('resume_db')} style={{ background:'#1e293b', color:'#fff', border:'none', padding:'9px 16px', borderRadius:'8px', fontSize:'14.5px', fontWeight:700, cursor: moving?'default':'pointer', opacity: moving?0.6:1, whiteSpace:'nowrap', fontFamily:'inherit' }}>Move to Resume Database</button>
                    ) : (
                      <span style={{ fontSize:'11px', color:'#94a3b8' }}>Save the candidate first</span>
                    )}
                  </div>

                  {verdict === 'rejected' ? (
                    <div style={{ background:'#fef2f2', border:'0.5px solid #fecaca', borderRadius:'10px', padding:'14px 16px', fontSize:'12.5px', color:'#7f1d1d' }}>
                      Marked Not Suitable — position, salary, benefits and visa route don't apply. The candidate stays on record for future openings.
                    </div>
                  ) : (
                  <>
                  <SectionHead label="Position & Date of Joining" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <div>
                      <label style={S.label}>Position Offered</label>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        <input data-fk="position_selected" key={`position_selected-${renderKey}`}
                          defaultValue={d.position_selected || d.position || ''}
                          onChange={e=>{ d.position_selected=e.target.value; }}
                          placeholder="e.g. Pipe Fitter Gr.II"
                          style={{ ...S.input, flex:1 }} />
                        <button type="button" onClick={()=>{ d.position_selected=d.position||''; setRenderKey(k=>k+1); }}
                          title="Copy the applied position as-is"
                          style={{ background:'#f1f5f9', border:'1px solid var(--bd2)', borderRadius:'7px', padding:'7px 10px', fontSize:'11px', cursor:'pointer', whiteSpace:'nowrap', color:'#475569', fontWeight:600, flexShrink:0 }}>
                          Same as applied
                        </button>
                      </div>
                      <div style={{ marginTop:'5px', fontSize:'10.5px', color:'#64748b' }}>Applied for: <strong style={{color:'#1e293b'}}>{d.position||'—'}</strong></div>
                    </div>
                    <F label="Date of Joining" fieldKey="expected_arrival_date" type="date" />

                  <SectionHead label="Salary" />
                  <div style={{ background:'#fff', border:'0.5px solid var(--bd1)', borderRadius:'12px', padding:'16px 18px' }}>
                    <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                      {[['monthly','Monthly'],['hourly','Hourly']].map(([m,l]) => (
                        <button key={m} type="button" onClick={()=>setSalaryMode(m)}
                          style={{ padding:'6px 14px', borderRadius:'7px', border:'1px solid ' + (salaryMode===m?'#1e293b':'#cbd5e1'),
                            background: salaryMode===m ? '#1e293b' : '#fff', color: salaryMode===m ? '#fff' : '#64748b',
                            fontWeight:500, fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                    {salaryMode === 'monthly' ? (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                        <F label="Basic Salary (AED/month)" fieldKey="basic_salary" type="number" placeholder="e.g. 4000" />
                        <F label="Allowance (AED/month)" fieldKey="allowance" type="number" placeholder="e.g. 1000" />
                        <div style={{ gridColumn:'span 2', display:'flex', alignItems:'flex-end', gap:'10px' }}>
                          <div style={{ flex:1 }}>
                            <label style={S.label}>Total Gross Salary (AED/month)</label>
                            <input key={`total-${renderKey}`} type="number" defaultValue={d.total_salary||''} readOnly
                              style={{ ...S.input, width:'100%', background:'#f8fafc', fontWeight:700 }} placeholder="Click to calculate" />
                          </div>
                          <button onClick={autoCalcTotal} style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1d4ed8', padding:'8px 14px', borderRadius:'6px', fontSize:'14px', cursor:'pointer', fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>Calculate</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                        <F label="Rate Per Hour (AED)" fieldKey="rate_per_hour" type="number" placeholder="e.g. 18.50" />
                      </div>
                    )}
                  </div>

                  <SectionHead label="FAT — provided by" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
                    <F label="Food" fieldKey="food_by" opts={['Provided by SATCO','Provided by Supplier','Provided by Client','Self-arranged']} />
                    <F label="Accommodation" fieldKey="accommodation_by" opts={['Provided by SATCO','Provided by Supplier','Provided by Client','Self-arranged']} />
                    <F label="Transport" fieldKey="transport_by" opts={['Provided by SATCO','Provided by Supplier','Provided by Client','Self-arranged']} />
                  </div>

                  <SectionHead label="Other Benefits" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Air Ticket (initial)" fieldKey="air_ticket" opts={['Borne by Employee','Provided by SATCO']} />
                    <F label="Deployment Site" fieldKey="deployment_site" placeholder="e.g. ADNOC Ruwais, TAQA Habshan" />
                  </div>
                  <div style={{ fontSize:'11px', color:'#94a3b8' }}>Anything else worth noting can go in Remarks, in the Pipeline tab.</div>

                  <SectionHead label="Visa Route" />
                  <div style={{ fontSize:'10px', color:'#059669', marginBottom:'5px', fontStyle:'italic' }}>Clicks save instantly — no need to hit Save Record</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                    {HIRING_SCENARIOS.map(sc => {
                      const sel = d.hiring_scenario === sc.id;
                      return (
                        <div key={sc.id} onClick={()=>handleScenarioClick(sc.id)}
                          style={{ border:`1.5px solid ${sel?sc.color:'#e2e8f0'}`, borderRadius:'10px', padding:'12px', cursor:'pointer', background:sel?sc.bg:'#fff', transition:'all 0.15s' }}>
                          <div style={{ fontSize:'20px', marginBottom:'4px' }}>{sc.icon}</div>
                          <div style={{ fontSize:'12px', fontWeight:600, color:sc.color, marginBottom:'3px' }}>{sc.shortLabel}</div>
                          <div style={{ fontSize:'10.5px', color:'#64748b', lineHeight:1.5 }}>{sc.desc}</div>
                          {sc.risk && <div style={{ fontSize:'10px', color:'#92400e', background:'#fef3c7', padding:'3px 7px', borderRadius:'6px', marginTop:'6px' }}>{sc.risk}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {!d.hiring_scenario && (
                    <div style={{ fontSize:'11.5px', color:'#b91c1c', fontWeight:500 }}>Select a visa route above — this determines which steps appear in the Visa Steps tab.</div>
                  )}

                  <SectionHead label="Offer Letter Tracking" />
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Offer Letter Date" fieldKey="offer_letter_date" type="date" />
                    <F label="Offer Accepted Date" fieldKey="offer_accepted_date" type="date" />
                    <F label="Offer Status" fieldKey="offer_status" opts={['Draft','Sent','Accepted','Rejected','Withdrawn']} />
                  </div>
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px', padding:'12px', fontSize:'12px', color:'#1e40af', lineHeight:1.6 }}>
                    Upload the signed offer letter in the <strong>Documents</strong> tab.
                  </div>
                  </div>
                  </>
                  )}
                </div>
                );
              })()}

              {/* ── TAB: Pipeline ── */}
              {activeTab==='pipeline' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                  <SectionHead label="Hiring Workflow Status" />

                  {/* Temp Employee ID + Transport/Arrival — merged in from the old separate
                      "view candidate" screen so everything lives on this one edit screen now. */}
                  {(() => {
                    const effStepNow = resolveStep(dataRef.current);
                    const VISA_STAGE_IDS = ['visa_processing','visa_arranged','entry_permit','travel','work_permit','status_change','medical','eid','visa_stamped','visa_cancel','joined'];
                    return (
                      <>
                        {(dataRef.current.temp_employee_id || VISA_STAGE_IDS.includes(effStepNow)) && (
                          <TempIdDepositPanel candidate={dataRef.current} onStartVisaProcessing={onStartVisaProcessing} showToast={showToast}
                            onUpdated={(patch)=>{ Object.assign(dataRef.current, patch); setRenderKey(k=>k+1); }} />
                        )}
                        {VISA_STAGE_IDS.includes(effStepNow) && (
                          <TransportArrangementPanel candidate={dataRef.current} showToast={showToast}
                            onUpdated={(patch)=>{ Object.assign(dataRef.current, patch); setRenderKey(k=>k+1); }} />
                        )}
                      </>
                    );
                  })()}

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
                    <F label="Overall Status" fieldKey="status" opts={['Active','Offer Pending','Offer Accepted','Visa Processing','Travelling','Joined','On Hold','Withdrawn']} />
                    <div>
                      <label style={S.label}>Pipeline Stage Override</label>
                      <select
                        key={`stage-${renderKey}`}
                        defaultValue={dataRef.current.manual_stage || ''}
                        onChange={e => { dataRef.current.manual_stage = e.target.value || null; setRenderKey(k => k + 1); }}
                        style={{ ...S.input, width:'100%' }}
                      >
                        <option value="">— Auto (date-based) —</option>
                        {HIRING_STEPS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <div style={{ fontSize:'10.5px', color:'#94a3b8', marginTop:'4px' }}>
                        Auto-calculated stage: <strong>{HIRING_STEPS.find(s=>s.id===resolveStep({ ...dataRef.current, manual_stage: null }))?.label || '—'}</strong>.
                        {dataRef.current.manual_stage ? ' Overridden above — switch back to "Auto" once dates are up to date.' : ' This is what shows on the board unless overridden above.'}
                      </div>
                    </div>
                    <F label="Step Due Date" fieldKey="step_due_date" type="date" />
                  </div>
                  {/* Step tracker — scenario-aware */}
                  {(() => {
                    const sc = dataRef.current.hiring_scenario;
                    const scSteps = getScenarioSteps(sc);
                    const scInfo = HIRING_SCENARIOS.find(s=>s.id===sc);
                    const effStep = resolveStep(dataRef.current);
                    const dateMap = { resume:'created_at', interview:'interview_date', offer_sent:'offer_letter_date', offer_signed:'offer_accepted_date',
                      visa_arranged:'visa_arranged_date', entry_permit:'entry_permit_date', travel:'arrival_date', work_permit:'work_permit_date',
                      status_change:'status_change_date', medical:'medical_fitness_date', eid:'eid_biometric_date', visa_stamped:'visa_stamped_in_passport_date',
                      visa_cancel:'visa_cancel_date', joined:'available_from' };
                    if (!sc) return <div style={{ color:'#94a3b8', fontSize:'12.5px', padding:'12px', background:'#f8fafc', borderRadius:'8px' }}>Select a visa route in the 📋 Decision tab to see step progress.</div>;
                    return (
                      <div>
                        {scInfo && <div style={{ background:scInfo.bg, border:`1.5px solid ${scInfo.color}`, borderRadius:'9px', padding:'10px 14px', marginBottom:'12px', fontSize:'12px', fontWeight:700, color:scInfo.color }}>{scInfo.icon} {scInfo.label}</div>}
                        <div style={{ display:'flex', flexDirection:'column' }}>
                          {scSteps.map((step, idx) => {
                            const stepIdx = scSteps.findIndex(s=>s.id===effStep);
                            const done = idx < stepIdx; const active = idx === stepIdx;
                            const dateFld = dataRef.current[dateMap[step.id]];
                            return (
                              <div key={step.id} style={{ display:'flex', gap:'14px' }}>
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                                  <div style={{ width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', background: done?'#16a34a':active?step.color:'#cbd5e1', color:'#fff', fontWeight:700, flexShrink:0, boxShadow: active?`0 0 0 3px ${step.color}33`:'none' }}>{done?'✓':step.icon}</div>
                                  {idx < scSteps.length-1 && <div style={{ width:'2px', flex:'1', minHeight:'24px', background: done?'#16a34a':'#e2e8f0', margin:'2px 0' }} />}
                                </div>
                                <div style={{ flex:1, paddingBottom:'14px', paddingTop:'4px' }}>
                                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                                    <div style={{ fontSize:'13px', fontWeight: active?700:600, color: done?'#059669':active?step.color:'#94a3b8' }}>{step.label}</div>
                                    <div style={{ fontSize:'10.5px', color:'#94a3b8' }}>Target: {step.days}d</div>
                                  </div>
                                  {dateFld && <div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px' }}>{fmtDateDisplay(dateFld)}</div>}
                                  {active && <span style={{ fontSize:'11px', color:step.color, fontWeight:600, background:step.color+'12', padding:'1px 8px', borderRadius:'8px' }}>Current</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ fontSize:'11.5px', color:'#94a3b8' }}>Exact step dates, reference numbers and completion confirmations are recorded in the <strong style={{color:'#64748b'}}><EmojiIcon e="🛂" /> Visa Steps</strong> tab.</div>
                  <F label="Remarks / Notes" fieldKey="remarks" type="textarea" wide placeholder="Any follow-up actions, HR notes…" />

                  {/* Joined banner */}
                  <div key={`joined-banner-${renderKey}`} style={{ display: dataRef.current.status==='Joined' ? 'block' : 'none' }}>
                    <div style={{ background:'#dcfce7', border:'2px solid #86efac', borderRadius:'10px', padding:'14px 18px' }}>
                      <div style={{ fontWeight:700, color:'#166534', fontSize:'13.5px', marginBottom:'6px' }}><EmojiIcon e="🎉" /> Candidate Marked as Joined</div>
                      <div style={{ fontSize:'12px', color:'#166534', lineHeight:1.7 }}>
                        When you save, this candidate will be <strong>automatically added to the Employee Directory</strong> with a new SA-series Employee ID.<br/>
                        Joining date will be set to: <strong>{dataRef.current.expected_arrival_date || dataRef.current.available_from || 'today'}</strong>
                        {dataRef.current.is_supplier_hire==='yes' && <span> · Supplier: <strong>{dataRef.current.supplier_name||'—'}</strong></span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB: Visa Steps (SOP-HR-002) ── */}
              {activeTab==='visa' && (() => {
                const sc = dataRef.current.hiring_scenario;
                const d = dataRef.current;
                const scInfo = HIRING_SCENARIOS.find(s=>s.id===sc);

                if (!sc) return (
                  <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>
                    <div style={{ background:'#fef3c7', border:'2px solid #f59e0b', borderRadius:'12px', padding:'16px 18px' }}>
                      <div style={{ fontSize:'15px', fontWeight:800, color:'#92400e', marginBottom:'4px' }}><EmojiIcon e="📋" /> Select Hiring Scenario to unlock visa steps</div>
                      <div style={{ fontSize:'12px', color:'#78350f' }}>Which route applies to this candidate? This determines the exact SOP steps shown below.</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
                      {HIRING_SCENARIOS.map(scen => (
                        <div key={scen.id} onClick={()=>{ handleScenarioClick(scen.id); setActiveTab('visa'); }}
                          style={{ border:`2px solid ${scen.color}`, borderRadius:'12px', padding:'16px', cursor:'pointer', background:scen.bg, transition:'all 0.15s' }}>
                          <div style={{ fontSize:'26px', marginBottom:'6px' }}>{scen.icon}</div>
                          <div style={{ fontSize:'13px', fontWeight:800, color:scen.color, marginBottom:'4px' }}>{scen.shortLabel}</div>
                          <div style={{ fontSize:'11px', color:'#64748b', lineHeight:1.5 }}>{scen.desc}</div>
                          <div style={{ marginTop:'8px', background:scen.color, color:'#fff', borderRadius:'8px', padding:'6px 10px', textAlign:'center', fontSize:'12px', fontWeight:700 }}>Select →</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:'11px', color:'#94a3b8', textAlign:'center' }}>You can also select the visa route from the <strong><EmojiIcon e="📋" /> Decision</strong> tab, alongside the interview verdict and salary.</div>
                  </div>
                );


                const sopSteps = SOP_BY_SCENARIO[sc] || [];
                const totalSteps = sopSteps.filter(s=>s.dateField).length;
                const doneSteps  = sopSteps.filter(s=>s.dateField && stepDone(d, s.dateField)).length;
                const pct = totalSteps > 0 ? Math.round(doneSteps/totalSteps*100) : 0;

                const phaseColors = { PRE:'#64748b', A:'#b45309', B:'#0369a1', T:'#991b1b', S:'#0f766e', ARR:'#334155', V:'#0369a1' };
                const phaseNames  = { PRE:'Pre-checks', A:'Phase A — Pre-Arrival / Pre-Departure', B:'Phase B — Post-Arrival', T:'Termination (Old Employer)', S:'Sponsorship by SATCO', ARR:'Starting Point', V:'Visa Processing & Onboarding' };

                const phases = [...new Set(sopSteps.map(s=>s.track))];


                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    {/* Scenario badge + progress */}
                    <div style={{ background:scInfo.bg, border:`2px solid ${scInfo.color}`, borderRadius:'12px', padding:'14px 18px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                        <div>
                          <div style={{ fontSize:'14px', fontWeight:800, color:scInfo.color }}>{scInfo.icon} {scInfo.label}</div>
                          <div style={{ fontSize:'11.5px', color:'#64748b', marginTop:'2px' }}>{scInfo.desc}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'22px', fontWeight:800, color:scInfo.color }}>{pct}%</div>
                          <div style={{ fontSize:'10.5px', color:'#64748b' }}>{doneSteps} / {totalSteps} steps</div>
                        </div>
                      </div>
                      <div style={{ marginTop:'10px', height:'8px', background:'#e2e8f0', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ height:'100%', background:scInfo.color, width:`${pct}%`, borderRadius:'4px', transition:'width 0.3s' }} />
                      </div>
                      <div style={{ marginTop:'10px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                        {HIRING_SCENARIOS.filter(s=>s.id!==sc).map(other => (
                          <button key={other.id} type="button" onClick={()=>handleScenarioClick(other.id)}
                            style={{ background:other.color, border:'none', color:'#fff', padding:'5px 12px', borderRadius:'7px', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Switch to {other.shortLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Steps by phase */}
                    {phases.map(ph => (
                      <div key={ph}>
                        <div style={{ fontSize:'12px', fontWeight:800, color:phaseColors[ph]||'#64748b', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'10px', paddingBottom:'6px', borderBottom:`2px solid ${phaseColors[ph]||'#e2e8f0'}20` }}>
                          {phaseNames[ph]||ph}
                        </div>
                        {sopSteps.filter(s=>s.track===ph).map(step => (
                          <VisaStepRow key={step.ref} step={step} d={d} sopSteps={sopSteps} renderKey={renderKey} setRenderKey={setRenderKey} showToast={showToast} saveVisaStepField={saveVisaStepField} />
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}


              {/* ── TAB: Documents ── */}
              {activeTab==='documents' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  <SectionHead label="Document Uploads with AI Auto-Detection" />
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px', padding:'12px', fontSize:'12px', color:'#1e40af', lineHeight:1.7 }}><EmojiIcon e="🤖" /><strong>AI-powered documents:</strong> Upload Passport or Resume — Claude fills candidate details automatically. Upload a <strong>filled Interview Sheet</strong> — Claude extracts all scores, verdict, salary, and medical data and saves directly to this record.
                  </div>
                  <div style={{ background:'#fef9c3', border:'1px solid #fde047', borderRadius:'8px', padding:'10px 12px', fontSize:'12px', color:'#713f12', lineHeight:1.6 }}><EmojiIcon e="📌" /><strong>Visa &amp; Travel documents</strong> (Visit Visa, Ticket, D-Return, D-Hotel, Medical, Entry Permit) — upload these by <strong>clicking the candidate's name</strong> in the kanban board to open the Transport &amp; Onboarding panel. Do not upload them here.
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                    {HIRING_DOC_TYPES.map(dt => {
                      const st = docState[dt.key] || {};
                      const savedUrl = dataRef.current[dt.key];
                      const preview = st.preview || (savedUrl?.startsWith('data:') ? savedUrl : null);
                      const isImg = preview?.startsWith('data:image');
                      const hasDoc = !!(st.preview || savedUrl);
                      return (
                        <div key={dt.key} style={{ border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden', background:'#fff' }}>
                          {/* Doc header row */}
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background: hasDoc?'#f0fdf4':'#f8fafc', borderBottom: hasDoc?'1px solid #86efac':'1px solid #e2e8f0' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <span style={{ fontSize:'14px' }}>{hasDoc?'✅':''}</span>
                              <span style={{ fontWeight:700, fontSize:'13px', color:'#0f172a' }}><EmojiLabel text={dt.label} size={14} gap={6} /></span>
                              {dt.ocrPrompt && <span style={{ fontSize:'10.5px', background:'#dbeafe', color:'#1d4ed8', padding:'1px 7px', borderRadius:'8px', fontWeight:600 }}><EmojiIcon e="🤖" /> AI scan</span>}
                            </div>
                            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                              {hasDoc && savedUrl && !savedUrl.startsWith('data:') && (
                                <a href={savedUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11.5px', color:'#2563eb', fontWeight:600 }}><EmojiIcon e="📎" /> View</a>
                              )}
                              {hasDoc && (
                                <button onClick={()=>{ dataRef.current[dt.key]=''; setDocState(s=>({...s,[dt.key]:{}})); }} style={{ ...S.iconBtn, fontSize:'13px', color:'#dc2626' }}>Remove</button>
                              )}
                              <label style={{ background:'#2563eb', color:'#fff', padding:'5px 12px', borderRadius:'6px', fontSize:'11.5px', fontWeight:600, cursor:'pointer' }}>
                                <EmojiLabel text={hasDoc?'↺ Replace':'⬆ Upload'} />
                                <input type="file" accept={dt.accept} style={{ display:'none' }} onChange={e=>e.target.files[0]&&handleDocFile(dt.key,e.target.files[0])} />
                              </label>
                            </div>
                          </div>

                          {/* Preview */}
                          {hasDoc && (
                            <div style={{ padding:'14px 16px', display:'flex', gap:'16px', flexWrap:'wrap' }}>
                              {/* Clickable thumbnail */}
                              <div style={{ flexShrink:0 }}>
                                {(st.preview||savedUrl||'').startsWith('data:image') ? (
                                  <img
                                    src={st.preview||savedUrl} alt="doc"
                                    onClick={()=>setPreviewDoc({ url: st.preview||savedUrl, isPdf:false, label:dt.label })}
                                    style={{ width:'120px', height:'80px', objectFit:'cover', borderRadius:'8px', border:'2px solid #2563eb', cursor:'zoom-in' }}
                                    title="Click to view full size"
                                  />
                                ) : (
                                  <div
                                    onClick={()=>setPreviewDoc({ url: st.preview||savedUrl, isPdf:true, label:dt.label })}
                                    style={{ width:'120px', height:'80px', background:'#eff6ff', borderRadius:'8px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'4px', border:'2px solid #2563eb', cursor:'zoom-in' }}
                                    title="Click to view document"
                                  >
                                    <span style={{ fontSize:'28px' }}><EmojiIcon e="📄" /></span>
                                    <span style={{ fontSize:'10px', fontWeight:700, color:'#2563eb' }}>Click to View</span>
                                  </div>
                                )}
                              </div>

                              {/* OCR panel */}
                              <div style={{ flex:1 }}>
                                {st.scanning && (
                                  <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'#2563eb', fontSize:'12.5px', fontWeight:600 }}>
                                    <div style={{ width:'14px', height:'14px', border:'2px solid #93c5fd', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}></div>
                                    🤖 AI is reading the document…
                                  </div>
                                )}
                                {!st.scanning && st.ocr && !st.ocr.error && (
                                  <div>
                                    <div style={{ fontSize:'11.5px', fontWeight:700, color:'#059669', marginBottom:'8px' }}><EmojiIcon e="✅" /> AI detected the following:</div>
                                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'4px 12px', marginBottom:'10px' }}>
                                      {Object.entries(st.ocr).filter(([k,v])=>v&&k!=='error').map(([k,v])=>(
                                        <div key={k} style={{ fontSize:'11px' }}>
                                          <span style={{ color:'#64748b', textTransform:'capitalize' }}>{k.replace(/([A-Z])/g,' $1').toLowerCase()}: </span>
                                          <span style={{ fontWeight:600, color:'#0f172a' }}>{String(v)}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div style={{ display:'flex', gap:'8px' }}>
                                      <button onClick={()=>applyOcr(dt.key)} style={{ background: st.applied?'#059669':'#2563eb', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'6px', fontSize:'14px', fontWeight:700, cursor:'pointer', transition:'background 0.2s' }}>
                                        <EmojiLabel text={st.applied ? '✓ Applied to form!' : '⬇ Apply to Form'} />
                                      </button>
                                      {dt.ocrPrompt && <button onClick={()=>rescanDoc(dt.key, dt)} style={{ background:'#f8fafc', color:'#475569', border:'1px solid var(--bd2)', padding:'6px 12px', borderRadius:'6px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Re-scan</button>}
                                    </div>
                                  </div>
                                )}
                                {!st.scanning && st.ocr?.error && (
                                  <div>
                                    <div style={{ fontSize:'11.5px', color:'#dc2626', marginBottom:'8px' }}><EmojiIcon e="⚠" /> Could not read document: {st.ocr.error}</div>
                                    {dt.ocrPrompt && <button onClick={()=>rescanDoc(dt.key, dt)} style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5', padding:'5px 12px', borderRadius:'6px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Retry Scan</button>}
                                  </div>
                                )}
                                {!st.scanning && !st.ocr && !dt.ocrPrompt && (
                                  <div style={{ fontSize:'12px', color:'#64748b' }}>Document uploaded successfully.</div>
                                )}
                                {!st.scanning && !st.ocr && dt.ocrPrompt && hasDoc && (
                                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                    <span style={{ fontSize:'12px', color:'#94a3b8' }}>Document saved.</span>
                                    <button onClick={()=>rescanDoc(dt.key, dt)} style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', padding:'5px 12px', borderRadius:'6px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Scan Now</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


            {/* Document Preview Lightbox */}
            {previewDoc && (() => {
              // Save to folder = download
              const handleSaveToFolder = () => {
                const a = document.createElement('a');
                a.href = previewDoc.url;
                const ext = previewDoc.isPdf ? 'pdf' : 'jpg';
                a.download = `${previewDoc.label.replace(/[^a-z0-9]/gi,'_')}.${ext}`;
                a.click();
              };
              // Open blob URL in new tab — most reliable for PDFs
              const handleOpenTab = () => {
                if (pdfBlobUrl) { window.open(pdfBlobUrl, '_blank'); }
                else if (previewDoc.url) {
                  // fallback: build blob on the fly
                  try {
                    const b64 = previewDoc.url.split(',')[1];
                    const bytes = atob(b64);
                    const arr = new Uint8Array(bytes.length);
                    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                    const blob = new Blob([arr], { type:'application/pdf' });
                    window.open(URL.createObjectURL(blob), '_blank');
                  } catch(e) { window.open(previewDoc.url, '_blank'); }
                }
              };
              return (
                <div onClick={()=>setPreviewDoc(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
                  <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'12px', overflow:'hidden', maxWidth:'92vw', maxHeight:'93vh', width: previewDoc.isPdf ? '88vw' : 'auto', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--bd1)', background:'#f8fafc', flexShrink:0 }}>
                      <span style={{ fontWeight:700, fontSize:'14px', color:'#0f172a', display:'flex', alignItems:'center', gap:6 }}><EmojiLabel text={previewDoc.label} size={15} gap={6} /></span>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                        {previewDoc.isPdf && (
                          <button onClick={handleOpenTab} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Open in New Tab</button>
                        )}
                        <button onClick={handleSaveToFolder} style={{ background:'#0f2744', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'7px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Save to Folder</button>
                        <button onClick={()=>setPreviewDoc(null)} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#64748b', lineHeight:1 }}></button>
                      </div>
                    </div>
                    <div style={{ flex:1, overflow:'hidden', display:'flex' }}>
                      {previewDoc.isPdf ? (
                        pdfBlobUrl
                          ? <object data={pdfBlobUrl} type="application/pdf" style={{ width:'100%', height:'85vh', border:'none' }}>
                              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px', padding:'40px', color:'#64748b' }}>
                                <div style={{ fontSize:'48px' }}></div>
                                <div style={{ fontWeight:600 }}>PDF cannot display inline in this browser.</div>
                                <button onClick={()=>window.open(pdfBlobUrl,'_blank')} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'10px 22px', borderRadius:'8px', fontSize:'15px', fontWeight:700, cursor:'pointer' }}>Open PDF in New Tab</button>
                              </div>
                            </object>
                          : <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px', color:'#94a3b8', padding:'40px', textAlign:'center' }}>
                              <div style={{ fontSize:'48px' }}></div>
                              <div style={{ fontWeight:600, color:'#64748b' }}>Building PDF preview…</div>
                            </div>
                      ) : (
                        <div style={{ overflow:'auto', flex:1, padding:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <img src={previewDoc.url} alt="Document" style={{ maxWidth:'80vw', maxHeight:'85vh', objectFit:'contain', display:'block' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--bd1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'11.5px', color:'#94a3b8', display:'flex', alignItems:'center', gap:'14px' }}>
                {record.id ? `Last updated: ${record.updated_at ? new Date(record.updated_at).toLocaleDateString('en-GB') : '—'}` : 'New candidate record'}
                {record.id && onDelete && (
                  <button type="button" onClick={() => {
                    if (window.confirm(`Delete ${record.candidate_name || 'this candidate'} permanently? This cannot be undone.`)) {
                      onDelete(record.id);
                      onClose();
                    }
                  }}
                    style={{ background:'none', border:'none', color:'#dc2626', fontSize:'11.5px', fontWeight:700, cursor:'pointer', padding:0, fontFamily:'inherit' }}>Delete Candidate</button>
                )}
              </div>
            </div>
            <div style={{ borderTop:'1px solid var(--bd1)', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', flexShrink:0 }}>
              <div style={{ display:'flex', gap:'10px' }}>
                {dataRef.current.id && (
                  <button className="hr-btn" onClick={() => setShowJoiningReport(true)} style={{ background:'#0f766e', color:'#fff', border:'none', padding:'9px 16px', borderRadius:'6px', fontSize:'14.5px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}><EmojiLabel text="📝 Joining Report" /></button>
                )}
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <button className="hr-btn" style={S.btnSec} onClick={onClose} disabled={savingCandidate}>Cancel</button>
                <button className="hr-btn" style={{ ...S.btnPri, opacity: savingCandidate?0.7:1, cursor: savingCandidate?'default':'pointer' }} onClick={collectAndSave} disabled={savingCandidate}>{savingCandidate ? 'Saving…' : 'Save Candidate'}</button>
              </div>
            </div>
            {showJoiningReport && (
              <JoiningReportModal
                employee={joiningReportInput()}
                onClose={()=>setShowJoiningReport(false)}
                onSaved={saveJoiningReportPatch}
                showToast={showToast}
              />
            )}
          </div>
          </div>
        </ResizablePanel>
      );
    }


    // ════════════════════════════════════════════════════════════
    // INTERVIEW SHEET OVERLAY — full-screen in-app, no routing
    // ════════════════════════════════════════════════════════════
    const HSE_CERTS_LIST = [
      'ADNOC HSE Induction & LSR','H2S Awareness (Level 1)','H2S / SCBA (Level 2)',
      'Basic Fire Fighting / Fire Warden','First Aid / CPR','Working at Height Medical',
      'Confined Space Entry (CSE)','Authorized Gas Tester (AGT)','Rigger Level 1',
      'Rigger Level 2','Scaffold Erector (CISRS/STI)','DROPS Awareness',
      'LOTO / Energy Isolation (AIP)','CompEx (Ex01–Ex04)',
    ];
    const PROF_CERTS_LIST = [
      'CSWIP 3.1 Welding Inspector','AWS-CWI','API 510','API 570','API 653',
      'NACE Coating Inspector Lvl 2','NDT Level II','ISO 9001 Lead Auditor',
      'SOE Card (UAE)','ADNOC TPA','PMP / PMI','NEBOSH IGC','IOSH',
    ];
    const IVW_QS = [
      'Describe your experience with the trade / discipline applied for.',
      'What types of projects / clients have you worked for? (Oil & Gas, EPC, Offshore)',
      'Are you familiar with ADNOC standards and permit-to-work systems?',
      'Explain a safety incident you witnessed and how you handled it.',
      'What are your salary expectations and when can you join?',
      'Do you have any family obligation that may affect remote site deployment?',
      'Are you comfortable with shift work, overtime, or site rotations?',
      'Do you have any outstanding visa bans or immigration issues?',
      'References — who can vouch for your work? (Name / Contact)',
    ];

  

    // ============================================================
    // CANDIDATES DIRECTORY — unified, deduplicated candidate list
    // pulled from Hiring Pipeline + Resume Database (both live in the
    // hiring_pipeline table; `hiring` prop already holds all of it),
    // for browsing and exporting (Excel + SATCO-letterhead PDF).
    // Read-only: this tab is for scanning candidate details, not
    // managing pipeline status — use Hiring / Resume DB for that.
    // ============================================================
    function candidateCompleteness(r) {
      const fields = ['current_designation','experience','education','work_history','skills'];
      let score = 0;
      fields.forEach(f => { if (r[f] && String(r[f]).trim()) score++; });
      return score;
    }

    function dedupeCandidates(records) {
      const groups = {};
      (records || []).forEach(r => {
        const name = (r.candidate_name || '').trim();
        if (!name) return;
        if (name.toUpperCase() === 'TEST TEAMS INTEGRATION') return;
        const email = (r.email || '').trim().toLowerCase();
        const key = email || ('NAME::' + name.toLowerCase());
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });
      const out = [];
      Object.values(groups).forEach(rows => {
        rows.sort((a, b) => {
          const ca = candidateCompleteness(a), cb = candidateCompleteness(b);
          if (ca !== cb) return cb - ca;
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        out.push(rows[0]);
      });
      out.sort((a, b) => (a.candidate_name || '').localeCompare(b.candidate_name || ''));
      return out;
    }

    function CandidatesDirectoryView({ records, showToast, onEdit }) {
      const [q, setQ] = useState('');
      const [cvViewer, setCvViewer] = useState(null);
      const candidates = useMemo(() => dedupeCandidates(records), [records]);
      const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return candidates;
        return candidates.filter(c => [c.candidate_name, c.current_designation, c.skills, c.experience]
          .some(v => v && String(v).toLowerCase().includes(term)));
      }, [candidates, q]);

      const exportExcel = () => {
        const wb = XLSX.utils.book_new();
        const rows = filtered.map(c => ({
          'Name': c.candidate_name || '',
          'Current Designation': c.current_designation || '',
          'Area of Expertise': c.area_of_expertise || '',
          'Years of Experience': c.experience || '',
          'Education': c.education || '',
          'Work History': c.work_history || '',
          'Skills': c.skills || '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'Candidates');
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `SATCO_Candidates_${today}.xlsx`);
        showToast && showToast('✅ Candidate list exported to Excel');
      };

      const exportPdf = async () => {
        try {
          const { PDFDocument, rgb, StandardFonts } = PDFLib;
          const NAVY = rgb(0.051, 0.133, 0.251);
          const BLACK = rgb(0, 0, 0);
          const DGRAY = rgb(0.282, 0.349, 0.412);
          const BORDER = rgb(0.796, 0.851, 0.906);
          const ROWALT = rgb(0.965, 0.973, 0.984);

          const pdfDoc = await PDFDocument.create();
          const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const reg = await pdfDoc.embedFont(StandardFonts.Helvetica);

          const fetchBytes = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());
          const headerImg = await pdfDoc.embedJpg(await fetchBytes('./satco-letterhead-header.jpg'));
          const footerImg = await pdfDoc.embedJpg(await fetchBytes('./satco-letterhead-footer.jpg'));

          // Landscape A4 — six columns need the width
          const PW = 841.89, PH = 595.28;
          const ML = 28, MR = 28, CW = PW - ML - MR;

          const toWA = s => String(s || '')
            .replace(/–/g, '-').replace(/—/g, '--')
            .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
            .replace(/•/g, '*').replace(/…/g, '...')
            .replace(/[^\x00-\xFF]/g, '?');

          const cols = [
            { key: 'candidate_name', label: 'Name', w: 0.12 },
            { key: 'current_designation', label: 'Current Designation', w: 0.12 },
            { key: 'area_of_expertise', label: 'Area of Expertise', w: 0.11 },
            { key: 'experience', label: 'Years Exp.', w: 0.06 },
            { key: 'education', label: 'Education', w: 0.13 },
            { key: 'work_history', label: 'Work History', w: 0.26 },
            { key: 'skills', label: 'Skills', w: 0.20 },
          ];
          let colX = []; let cx = ML;
          cols.forEach(c => { colX.push(cx); cx += CW * c.w; });

          const FONT_SIZE = 6.7;
          const LINE_GAP = 8.2;
          const PAD = 4;

          const wrapText = (text, maxW, font, size) => {
            const words = toWA(text).split(/\s+/).filter(Boolean);
            const lines = [];
            let line = '';
            words.forEach(w => {
              const test = line ? line + ' ' + w : w;
              if (font.widthOfTextAtSize(test, size) > maxW && line) {
                lines.push(line); line = w;
              } else {
                line = test;
              }
            });
            if (line) lines.push(line);
            return lines.length ? lines : ['—'];
          };

          let page, y;
          const drawHeaderRow = () => {
            page.drawRectangle({ x: ML, y: y - 14, width: CW, height: 14, color: NAVY });
            cols.forEach((c, i) => {
              page.drawText(c.label, { x: colX[i] + PAD, y: y - 10.5, size: 7, font: bold, color: rgb(1, 1, 1) });
            });
            y -= 14;
          };
          const addPage = () => {
            page = pdfDoc.addPage([PW, PH]);
            const hRatio = headerImg.height / headerImg.width;
            const hW = CW, hH = hW * hRatio;
            page.drawImage(headerImg, { x: ML, y: PH - 16 - hH, width: hW, height: hH });
            const fRatio = footerImg.height / footerImg.width;
            const fW = CW, fH = fW * fRatio;
            page.drawImage(footerImg, { x: ML, y: 12, width: fW, height: fH });
            y = PH - 16 - hH - 14;
            page.drawText('CANDIDATE DIRECTORY', { x: ML, y, size: 12, font: bold, color: NAVY });
            y -= 16;
            page.drawText(`Generated ${new Date().toLocaleDateString('en-GB')} — ${filtered.length} candidate(s)`, { x: ML, y, size: 7.5, font: reg, color: DGRAY });
            y -= 14;
            drawHeaderRow();
          };

          const FOOTER_LIMIT = 60;
          addPage();

          filtered.forEach((c, idx) => {
            const cellLines = cols.map(col => wrapText(c[col.key] || '—', CW * col.w - PAD * 2, reg, FONT_SIZE));
            const rowLines = Math.max(...cellLines.map(l => l.length), 1);
            const rowH = rowLines * LINE_GAP + PAD * 1.5;

            if (y - rowH < FOOTER_LIMIT) addPage();

            if (idx % 2 === 1) {
              page.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, color: ROWALT });
            }
            cols.forEach((col, i) => {
              let ly = y - PAD - FONT_SIZE;
              cellLines[i].forEach(line => {
                page.drawText(line, { x: colX[i] + PAD, y: ly, size: FONT_SIZE, font: reg, color: BLACK });
                ly -= LINE_GAP;
              });
            });
            page.drawLine({ start: { x: ML, y: y - rowH }, end: { x: ML + CW, y: y - rowH }, thickness: 0.4, color: BORDER });
            y -= rowH;
          });

          const bytes = await pdfDoc.save();
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `SATCO_Candidate_Directory_${new Date().toISOString().slice(0, 10)}.pdf`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          showToast && showToast('✅ Candidate directory PDF generated on SATCO letterhead');
        } catch (e) {
          console.error('Candidate PDF export failed:', e);
          showToast && showToast('❌ PDF export failed: ' + e.message, 'error');
        }
      };

      const sendToClientPdf = async (c) => {
        try {
          const { PDFDocument, rgb, StandardFonts } = PDFLib;
          const NAVY = rgb(0.051, 0.133, 0.251);
          const BLACK = rgb(0, 0, 0);
          const DGRAY = rgb(0.282, 0.349, 0.412);
          const pdfDoc = await PDFDocument.create();
          const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const reg = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const fetchBytes = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());
          const headerImg = await pdfDoc.embedJpg(await fetchBytes('./satco-letterhead-header.jpg'));
          const footerImg = await pdfDoc.embedJpg(await fetchBytes('./satco-letterhead-footer.jpg'));

          const PW = 595.28, PH = 841.89; // portrait A4 — reads like a CV profile, not a table row
          const ML = 40, MR = 40, CW = PW - ML - MR;

          const toWA = s => String(s || '')
            .replace(/[–]/g, '-').replace(/[—]/g, '--')
            .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
            .replace(/[•]/g, '*').replace(/[…]/g, '...')
            .replace(/[^\x00-\xFF]/g, '?');

          const page = pdfDoc.addPage([PW, PH]);
          const hRatio = headerImg.height / headerImg.width;
          const hW = CW, hH = hW * hRatio;
          page.drawImage(headerImg, { x: ML, y: PH - 22 - hH, width: hW, height: hH });
          const fRatio = footerImg.height / footerImg.width;
          const fW = CW, fH = fW * fRatio;
          page.drawImage(footerImg, { x: ML, y: 18, width: fW, height: fH });

          let y = PH - 22 - hH - 26;
          page.drawText('CANDIDATE PROFILE', { x: ML, y, size: 10, font: bold, color: DGRAY });
          y -= 22;
          page.drawText(toWA(c.candidate_name || 'Candidate'), { x: ML, y, size: 18, font: bold, color: NAVY });
          y -= 20;
          if (c.current_designation) {
            page.drawText(toWA(c.current_designation), { x: ML, y, size: 12, font: reg, color: DGRAY });
            y -= 24;
          } else {
            y -= 8;
          }

          const drawWrapped = (text, size, lineGap, color) => {
            const words = toWA(text).split(/\s+/).filter(Boolean);
            let line = '';
            words.forEach(w => {
              const test = line ? line + ' ' + w : w;
              if (reg.widthOfTextAtSize(test, size) > CW && line) {
                page.drawText(line, { x: ML, y, size, font: reg, color }); y -= lineGap; line = w;
              } else { line = test; }
            });
            if (line) { page.drawText(line, { x: ML, y, size, font: reg, color }); y -= lineGap; }
          };

          const sectionHead = (label) => {
            page.drawRectangle({ x: ML, y: y - 15, width: CW, height: 15, color: NAVY });
            page.drawText(label.toUpperCase(), { x: ML + 8, y: y - 11, size: 8.5, font: bold, color: rgb(1, 1, 1) });
            y -= 24;
          };

          if (c.area_of_expertise) {
            sectionHead('Area of Expertise');
            drawWrapped(c.area_of_expertise, 10, 14, BLACK);
            y -= 10;
          }

          sectionHead('Years of Experience');
          drawWrapped(c.experience || 'Not specified', 10, 14, BLACK);
          y -= 10;

          sectionHead('Education');
          drawWrapped(c.education || 'Not specified', 10, 14, BLACK);
          y -= 10;

          sectionHead('Work History');
          drawWrapped(c.work_history || 'Not specified', 9.5, 13, BLACK);
          y -= 10;

          sectionHead('Skills');
          drawWrapped(c.skills || 'Not specified', 9.5, 13, BLACK);

          const bytes = await pdfDoc.save();
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const safeName = (c.candidate_name || 'Candidate').replace(/[^a-z0-9]+/gi, '_');
          a.download = `SATCO_Candidate_Profile_${safeName}.pdf`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          showToast && showToast(`✅ ${c.candidate_name || 'Candidate'} profile ready to send to client`);
        } catch (e) {
          console.error('Client profile PDF failed:', e);
          showToast && showToast('❌ Profile PDF failed: ' + e.message, 'error');
        }
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by name, designation, or skill…"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ flex: '1 1 280px', minWidth: '220px', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13.5px' }}
            />
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>{filtered.length} of {candidates.length} candidate(s)</div>
            <button onClick={exportExcel} style={{ padding: '9px 16px', background: '#166534', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>⬇ Excel</button>
            <button onClick={exportPdf} style={{ padding: '9px 16px', background: '#0f2942', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>⬇ PDF (Letterhead)</button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #dbe3ee', borderRadius: '10px', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0f2942', color: '#fff', zIndex: 1 }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '140px' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '160px' }}>Current Designation</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '140px' }}>Area of Expertise</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '90px' }}>Years Exp.</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '180px' }}>Education</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '260px' }}>Work History</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '220px' }}>Skills</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '110px' }}>Profile</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', minWidth: '200px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No candidates match your search.</td></tr>
                )}
                {filtered.map((c, i) => (
                  <tr key={c.id || i} style={{ borderTop: '1px solid #eef2f7', background: i % 2 === 1 ? '#f8fafc' : '#fff', verticalAlign: 'top' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 700, color: '#0f2942' }}>{c.candidate_name || '—'}</td>
                    <td style={{ padding: '9px 10px' }}>{c.current_designation || '—'}</td>
                    <td style={{ padding: '9px 10px' }}>{c.area_of_expertise || '—'}</td>
                    <td style={{ padding: '9px 10px' }}>{c.experience || '—'}</td>
                    <td style={{ padding: '9px 10px', whiteSpace: 'pre-wrap' }}>{c.education || '—'}</td>
                    <td style={{ padding: '9px 10px', whiteSpace: 'pre-wrap', maxWidth: '340px' }}>{c.work_history || '—'}</td>
                    <td style={{ padding: '9px 10px', whiteSpace: 'pre-wrap', maxWidth: '280px' }}>{c.skills || '—'}</td>
                    <td style={{ padding: '9px 10px' }}>
                      {candidateCompleteness(c) < 5
                        ? <span title="Some fields (designation, education, skills, etc.) weren't captured from the resume — open the CV and fill them in manually." style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>⚠ Incomplete</span>
                        : <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Complete</span>}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(c.resume_url || c.cv_path) && (
                          <button onClick={() => setCvViewer(resolveCvViewerProps(c))} title="Open the candidate's resume/CV" style={{ padding: '6px 10px', background: '#0f2942', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>📄 View Resume</button>
                        )}
                        {onEdit && (
                          <button onClick={() => onEdit(c)} title="Edit this candidate's details" style={{ padding: '6px 10px', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>✏️ Edit</button>
                        )}
                        <button onClick={() => sendToClientPdf(c)} title="Generate a one-page profile PDF on SATCO letterhead, ready to email to a client" style={{ padding: '6px 10px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>📤 Send to Client</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cvViewer && (
            <CvViewerOverlay
              cvPath={cvViewer.cvPath}
              base64={cvViewer.base64}
              url={cvViewer.url}
              fileName={cvViewer.fileName}
              supaUrl="https://oaerqjrkdpuhiproppaz.supabase.co"
              supaKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI"
              onClose={() => setCvViewer(null)}
            />
          )}
        </div>
      );
    }


    // ============================================================
    // CANDIDATES — single consolidated tab replacing the old separate
    // Hiring / Resume DB / Candidates Directory / Interview Sheet tabs.
    // Same underlying views and handlers as before (nothing about how
    // editing, deleting, moving, or opening the interview sheet works
    // has changed) — just one entry point with a 3-way toggle instead
    // of four items competing for space in the nav.
    // ============================================================
    function CandidatesTabView({
      pipelineRecords, resumeDbRecords, allRecords,
      onEditCandidate, onDeleteHiring, onSaveHiringDoc, onStartVisaProcessing,
      onMoveLocation, onOpenSheet, showToast, db,
    }) {
      const [mode, setMode] = useState('pipeline'); // 'pipeline' | 'talent_pool' | 'all'

      const chip = (key, label, count) => (
        <button
          onClick={() => setMode(key)}
          style={{
            padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            border: mode === key ? '1px solid #0f2942' : '1px solid #cbd5e1',
            background: mode === key ? '#0f2942' : '#fff',
            color: mode === key ? '#fff' : '#334155',
          }}
        >
          {label}{count != null ? ` (${count})` : ''}
        </button>
      );

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {chip('pipeline', '🧑‍💼 Active Pipeline', pipelineRecords.length)}
            {chip('talent_pool', '🗄️ Talent Pool', resumeDbRecords.length)}
            {chip('all', '📋 All / Search / Export', allRecords.length)}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {mode === 'pipeline' && (
              <HiringView
                records={pipelineRecords}
                crossRecords={resumeDbRecords}
                onAdd={() => onEditCandidate({})}
                onEdit={onEditCandidate}
                onDelete={onDeleteHiring}
                onSaveDoc={onSaveHiringDoc}
                onStartVisaProcessing={onStartVisaProcessing}
                onMoveLocation={onMoveLocation}
                showToast={showToast}
                onOpenSheet={onOpenSheet}
              />
            )}
            {mode === 'talent_pool' && (
              <ResumeDatabaseView
                records={resumeDbRecords}
                crossRecords={pipelineRecords}
                onAdd={() => onEditCandidate({ pipeline_location: 'resume_db' })}
                onEdit={onEditCandidate}
                onDelete={onDeleteHiring}
                onMoveLocation={onMoveLocation}
                showToast={showToast}
                db={db}
              />
            )}
            {mode === 'all' && (
              <CandidatesDirectoryView records={allRecords} showToast={showToast} onEdit={onEditCandidate} />
            )}
          </div>
        </div>
      );
    }
