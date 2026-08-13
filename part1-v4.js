    // ── PART 1: Config · Helpers · Login · HRApp · Dashboard · Lists · Settings ──


    // ============================================================
    // CONFIG — your Supabase project
    // ============================================================
    const SUPABASE_URL = 'https://oaerqjrkdpuhiproppaz.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZXJxanJrZHB1aGlwcm9wcGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTQ0NjksImV4cCI6MjA5NTUzMDQ2OX0.qBtb3OV1aFGX8e1QUg19qZmOwIIjipF6IZwBOLXY3YI';
    // ANTHROPIC_KEY removed — unused client-side; all AI calls go through the server-side /api/claude proxy which reads the key from Vercel env vars. Rotate the key that was previously hardcoded here.

    const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.db = db;
    window._satcoDB = db; // expose globally so CvViewerOverlay can use session JWT for signed URLs

    // -- Audit log + recycle bin helpers --------------------------------
    // Schema-cache-safe: if the audit_log table or deleted_at/deleted_by columns
    // don't exist yet (SQL migration not run), these fail silently / fall back
    // to a hard delete so the app keeps working exactly as before the migration.
    const logAudit = async (user, table, recordId, label, action, details) => {
      try {
        await db.from('audit_log').insert({
          actor_email: (user && user.email) || 'unknown',
          table_name: table,
          record_id: recordId != null ? String(recordId) : '',
          record_label: label || '',
          action, // 'create' | 'update' | 'delete' | 'restore' | 'purge'
          details: details || ''
        });
      } catch (e) {
        // audit_log table not created yet -- ignore, never block the user's action
      }
    };

    // Soft-delete a row (moves it to the Recycle Bin for 30 days). Falls back to a
    // real hard delete if the deleted_at/deleted_by columns don't exist yet.
    const softDeleteRow = async (user, table, id, label) => {
      try {
        const { error } = await db.from(table).update({
          deleted_at: new Date().toISOString(),
          deleted_by: (user && user.email) || 'unknown'
        }).eq('id', id);
        if (error) throw error;
        await logAudit(user, table, id, label, 'delete', 'Moved to Recycle Bin');
        return 'soft';
      } catch (e) {
        await db.from(table).delete().eq('id', id);
        await logAudit(user, table, id, label, 'delete', 'Hard-deleted (recycle bin columns not set up yet)');
        return 'hard';
      }
    };

    const restoreDeletedRow = async (user, table, id, label) => {
      await db.from(table).update({ deleted_at: null, deleted_by: null }).eq('id', id);
      await logAudit(user, table, id, label, 'restore', 'Restored from Recycle Bin');
    };

    const purgeDeletedRow = async (user, table, id, label) => {
      await db.from(table).delete().eq('id', id);
      await logAudit(user, table, id, label, 'purge', 'Permanently deleted from Recycle Bin');
    };

    // ── Upload a certificate/document image to Storage instead of storing
    //    base64 in the DB (avoids huge JSON columns + egress blowup on every load).
    //    Returns a public URL, or null on failure (caller can fall back to base64).
    const uploadCertImage = async (employeeId, cid, file, folder = 'training-certs') => {
      try {
        const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : (file.type?.includes('png') ? 'png' : file.type?.includes('pdf') ? 'pdf' : 'jpg');
        const path = `${folder}/${employeeId || 'unknown'}/${cid}-${Date.now()}.${ext}`;
        const { error } = await db.storage.from('hr-documents').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
        if (error) { console.error('Storage upload failed', error); return null; }
        const { data } = db.storage.from('hr-documents').getPublicUrl(path);
        return data?.publicUrl || null;
      } catch (e) { console.error('Storage upload error', e); return null; }
    };


    // True for both inline base64 PDFs and Storage-hosted .pdf URLs
    const isPdfUrl = (s) => !!s && (s.startsWith('data:application/pdf') || /\.pdf(\?|$)/i.test(s));

    // ── Robust Claude response → JSON parser ─────────────────────────────────
    // Handles: raw JSON, ```json...```, ``` ```, JSON embedded in prose text.
    // Uses String.fromCharCode(96) to build backtick so Babel doesn't choke.
    const parseClaudeJson = (raw) => {
      if (!raw) throw new Error('Empty response');
      const s = String(raw);
      // Find first { and last } using charCodeAt — avoids any Unicode confusion
      let start = -1, end = -1;
      for (let i = 0; i < s.length; i++) {
        if (s.charCodeAt(i) === 123) { start = i; break; }   // 123 = '{'
      }
      for (let i = s.length - 1; i >= 0; i--) {
        if (s.charCodeAt(i) === 125) { end = i; break; }     // 125 = '}'
      }
      if (start === -1 || end <= start) {
        // Show first 40 char codes to diagnose invisible characters
        const codes = [];
        for (let i = 0; i < Math.min(40, s.length); i++) codes.push(s.charCodeAt(i));
        throw new Error('No JSON braces found. Char codes: [' + codes.join(',') + ']');
      }
      return JSON.parse(s.slice(start, end + 1));
    };

    // ============================================================
    // EXCEL-STYLE TABLE HELPERS — column autofilter + frozen panes
    // Shared across every data table in the app.
    // ============================================================

    // useColumnFilters(rows, getters) → { filters, setColFilter, clearAll, filteredRows, activeCount }
    // getters: { colKey: (row) => displayValue, ... } — used to derive the unique value list per column
    function useColumnFilters(rows, getters) {
      const [filters, setFilters] = React.useState({}); // { colKey: Set(of allowed string values) | undefined (=all) }
      const setColFilter = (colKey, valuesSetOrNull) => {
        setFilters(prev => {
          const next = { ...prev };
          if (!valuesSetOrNull) delete next[colKey];
          else next[colKey] = valuesSetOrNull;
          return next;
        });
      };
      const clearAll = () => setFilters({});
      const filteredRows = React.useMemo(() => {
        const keys = Object.keys(filters);
        if (keys.length === 0) return rows;
        return rows.filter(r => keys.every(k => {
          const allowed = filters[k];
          if (!allowed) return true;
          const val = String((getters[k] ? getters[k](r) : r[k]) ?? '—');
          return allowed.has(val);
        }));
      }, [rows, filters, getters]);
      const activeCount = Object.keys(filters).length;
      return { filters, setColFilter, clearAll, filteredRows, activeCount };
    }

    // Detects Supabase/PostgREST "column does not exist in schema cache" errors — used to
    // gracefully retry a save without a newer column when its SQL migration hasn't been run yet.
    const isMissingColumnError = (error, colName) => {
      const msg = (error && (error.message || error.details || '')) || '';
      return new RegExp(colName, 'i').test(msg) && /(schema cache|does not exist|column)/i.test(msg);
    };
    const isMissingManualStageError = (error) => isMissingColumnError(error, 'manual_stage');

    // Generic Postgrest-safe insert/update — usable from ANY component (not just HRApp, which
    // has its own hiring-specific trySaveHiringRow). Retries progressively without whichever
    // column Postgrest reports as missing from the schema cache, so an out-of-date Supabase
    // schema never silently drops an entire save/insert (name, dates, resume link — everything)
    // just because one newer column hasn't been migrated yet. Pass `matchId` to update an
    // existing row by id; omit it to insert a new row.
    const extractMissingColumnGlobal = (error) => {
      const msg = (error && (error.message || error.details || '')) || '';
      const m = msg.match(/find the '([^']+)' column/i) || msg.match(/column '?"?([a-z0-9_]+)"?'? .*does not exist/i);
      return m ? m[1] : null;
    };
    const dbSaveWithRetry = async (table, payload, matchId) => {
      let clean = { ...payload };
      const maxAttempts = Object.keys(clean).length + 1;
      const dropped = [];
      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        const { data, error } = matchId
          ? await db.from(table).update(clean).eq('id', matchId).select()
          : await db.from(table).insert(clean).select();
        if (!error) return { data, error: null, dropped };
        const missingCol = extractMissingColumnGlobal(error) || Object.keys(clean).find(col => isMissingColumnError(error, col));
        if (!missingCol || !(missingCol in clean)) return { data, error, dropped };
        delete clean[missingCol];
        dropped.push(missingCol);
      }
      return { data: null, error: { message: 'Save failed after retries' }, dropped };
    };

    // ─────────────────────────────────────────────────────────────────────
    // Minimal line-icon system — replaces the ad-hoc emoji icons used
    // throughout the app (nav bar, Quick Access, KPI cards, buttons, tabs,
    // toasts, etc.) with small monochrome SVGs in the current text color.
    // ICON_PATHS holds the raw <path>/<line>/... markup for each icon name.
    // EMOJI_TO_ICON maps every emoji character previously used in the app
    // to one of these icon names, so existing data (e.g. `icon:'✅'`) keeps
    // working without having to rename every call site.
    // ─────────────────────────────────────────────────────────────────────
    const ICON_PATHS = {
  "arrow-right": "<line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/><polyline points=\"12 5 19 12 12 19\"/>",
  "arrow-left": "<line x1=\"19\" y1=\"12\" x2=\"5\" y2=\"12\"/><polyline points=\"12 19 5 12 12 5\"/>",
  "arrow-up-right": "<line x1=\"7\" y1=\"17\" x2=\"17\" y2=\"7\"/><polyline points=\"7 7 17 7 17 17\"/>",
  "arrow-down": "<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><polyline points=\"19 12 12 19 5 12\"/>",
  "corner-up-left": "<polyline points=\"9 14 4 9 9 4\"/><path d=\"M20 20v-7a4 4 0 0 0-4-4H4\"/>",
  "check-circle": "<path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/><polyline points=\"22 4 12 14.01 9 11.01\"/>",
  "check": "<polyline points=\"20 6 9 17 4 12\"/>",
  "x-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"15\" y1=\"9\" x2=\"9\" y2=\"15\"/><line x1=\"9\" y1=\"9\" x2=\"15\" y2=\"15\"/>",
  "x": "<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>",
  "alert-triangle": "<path d=\"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/>",
  "file-text": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/><polyline points=\"10 9 9 9 8 9\"/>",
  "clipboard": "<path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\" ry=\"1\"/>",
  "cpu": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" ry=\"2\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\"/><line x1=\"9\" y1=\"1\" x2=\"9\" y2=\"4\"/><line x1=\"15\" y1=\"1\" x2=\"15\" y2=\"4\"/><line x1=\"9\" y1=\"20\" x2=\"9\" y2=\"23\"/><line x1=\"15\" y1=\"20\" x2=\"15\" y2=\"23\"/><line x1=\"20\" y1=\"9\" x2=\"23\" y2=\"9\"/><line x1=\"20\" y1=\"14\" x2=\"23\" y2=\"14\"/><line x1=\"1\" y1=\"9\" x2=\"4\" y2=\"9\"/><line x1=\"1\" y1=\"14\" x2=\"4\" y2=\"14\"/>",
  "refresh-cw": "<polyline points=\"23 4 23 10 17 10\"/><polyline points=\"1 20 1 14 7 14\"/><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"/>",
  "building": "<rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"1\"/><line x1=\"9\" y1=\"7\" x2=\"9\" y2=\"7.01\"/><line x1=\"15\" y1=\"7\" x2=\"15\" y2=\"7.01\"/><line x1=\"9\" y1=\"11\" x2=\"9\" y2=\"11.01\"/><line x1=\"15\" y1=\"11\" x2=\"15\" y2=\"11.01\"/><line x1=\"9\" y1=\"15\" x2=\"9\" y2=\"15.01\"/><line x1=\"15\" y1=\"15\" x2=\"15\" y2=\"15.01\"/><line x1=\"9\" y1=\"21\" x2=\"9\" y2=\"17\"/><line x1=\"15\" y1=\"21\" x2=\"15\" y2=\"17\"/>",
  "passport": "<rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"2\"/><circle cx=\"12\" cy=\"9\" r=\"2.5\"/><line x1=\"9\" y1=\"15\" x2=\"15\" y2=\"15\"/><line x1=\"9\" y1=\"18\" x2=\"15\" y2=\"18\"/>",
  "save": "<path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z\"/><polyline points=\"17 21 17 13 7 13 7 21\"/><polyline points=\"7 3 7 8 15 8\"/>",
  "archive": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"5\" rx=\"1\"/><path d=\"M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9\"/><line x1=\"10\" y1=\"13\" x2=\"14\" y2=\"13\"/>",
  "briefcase": "<rect x=\"2\" y=\"7\" width=\"20\" height=\"14\" rx=\"2\" ry=\"2\"/><path d=\"M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"/>",
  "edit-3": "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z\"/>",
  "edit-2": "<path d=\"M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z\"/>",
  "graduation-cap": "<path d=\"M22 10 12 5 2 10l10 5 10-5z\"/><path d=\"M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5\"/><line x1=\"22\" y1=\"10\" x2=\"22\" y2=\"16.5\"/>",
  "link": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
  "trash": "<polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/>",
  "mail": "<path d=\"M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z\"/><polyline points=\"22 6 12 13 2 6\"/>",
  "send": "<line x1=\"22\" y1=\"2\" x2=\"11\" y2=\"13\"/><polygon points=\"22 2 15 22 11 13 2 9 22 2\"/>",
  "calendar": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>",
  "credit-card": "<rect x=\"1\" y=\"4\" width=\"22\" height=\"16\" rx=\"2\" ry=\"2\"/><line x1=\"1\" y1=\"10\" x2=\"23\" y2=\"10\"/>",
  "plus-square": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"16\"/><line x1=\"8\" y1=\"12\" x2=\"16\" y2=\"12\"/>",
  "star": "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"/>",
  "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>",
  "users": "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>",
  "rocket": "<path d=\"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z\"/><path d=\"M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z\"/><path d=\"M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0\"/><path d=\"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5\"/>",
  "user": "<path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>",
  "phone": "<path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z\"/>",
  "paperclip": "<path d=\"M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.41 17.41a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49\"/>",
  "upload": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"17 8 12 3 7 8\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"/>",
  "eye": "<path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  "map-pin": "<path d=\"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>",
  "cloud": "<path d=\"M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z\"/>",
  "mic": "<path d=\"M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z\"/><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\"/><line x1=\"12\" y1=\"19\" x2=\"12\" y2=\"23\"/><line x1=\"8\" y1=\"23\" x2=\"16\" y2=\"23\"/>",
  "car": "<path d=\"M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm14 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM3 17V11l2-5h14l2 5v6\"/>",
  "bar-chart-2": "<line x1=\"18\" y1=\"20\" x2=\"18\" y2=\"10\"/><line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"4\"/><line x1=\"6\" y1=\"20\" x2=\"6\" y2=\"14\"/>",
  "bell": "<path d=\"M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9\"/><path d=\"M13.73 21a2 2 0 0 1-3.46 0\"/>",
  "truck": "<rect x=\"1\" y=\"3\" width=\"15\" height=\"13\"/><polygon points=\"16 8 20 8 23 11 23 16 16 16 16 8\"/><circle cx=\"5.5\" cy=\"18.5\" r=\"2.5\"/><circle cx=\"18.5\" cy=\"18.5\" r=\"2.5\"/>",
  "settings": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"/>",
  "database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"/><path d=\"M21 12c0 1.66-4 3-9 3s-9-1.34-9-3\"/><path d=\"M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5\"/>",
  "lightbulb": "<path d=\"M9 18h6\"/><path d=\"M10 22h4\"/><path d=\"M12 2a7 7 0 0 0-4 12.7c.7.55 1 1.4 1 2.3h6c0-.9.3-1.75 1-2.3A7 7 0 0 0 12 2z\"/>",
  "book": "<path d=\"M4 19.5A2.5 2.5 0 0 1 6.5 17H20\"/><path d=\"M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z\"/>",
  "hash": "<line x1=\"4\" y1=\"9\" x2=\"20\" y2=\"9\"/><line x1=\"4\" y1=\"15\" x2=\"20\" y2=\"15\"/><line x1=\"10\" y1=\"3\" x2=\"8\" y2=\"21\"/><line x1=\"16\" y1=\"3\" x2=\"14\" y2=\"21\"/>",
  "printer": "<polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/>",
  "slash": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"4.93\" y1=\"4.93\" x2=\"19.07\" y2=\"19.07\"/>",
  "ticket": "<path d=\"M2 9a3 3 0 1 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 1 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z\"/><line x1=\"13\" y1=\"5\" x2=\"13\" y2=\"19\" strokeDasharray=\"2,2\"/>",
  "flag": "<path d=\"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z\"/><line x1=\"4\" y1=\"22\" x2=\"4\" y2=\"3\"/>",
  "tool": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/>",
  "folder": "<path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>",
  "folder-open": "<path d=\"M6 14 3 5h18l-3 9\"/><path d=\"M3 5h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>",
  "shield": "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/>",
  "package": "<line x1=\"16.5\" y1=\"9.4\" x2=\"7.5\" y2=\"4.21\"/><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"/><polyline points=\"3.27 6.96 12 12.01 20.73 6.96\"/><line x1=\"12\" y1=\"22.08\" x2=\"12\" y2=\"12\"/>",
  "camera": "<path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/>",
  "square": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>",
  "maximize": "<polyline points=\"15 3 21 3 21 9\"/><polyline points=\"9 21 3 21 3 15\"/><line x1=\"21\" y1=\"3\" x2=\"14\" y2=\"10\"/><line x1=\"3\" y1=\"21\" x2=\"10\" y2=\"14\"/>",
  "message-square": "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>",
  "image": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/><polyline points=\"21 15 16 10 5 21\"/>",
  "help-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/>",
  "lock": "<rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>",
  "smartphone": "<rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"2\" ry=\"2\"/><line x1=\"12\" y1=\"18\" x2=\"12.01\" y2=\"18\"/>",
  "dollar-sign": "<line x1=\"12\" y1=\"1\" x2=\"12\" y2=\"23\"/><path d=\"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\"/>",
  "target": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
  "award": "<circle cx=\"12\" cy=\"8\" r=\"7\"/><polyline points=\"8.21 13.89 7 23 12 20 17 23 15.79 13.88\"/>",
  "plus": "<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>",
  "rotate-ccw": "<polyline points=\"1 4 1 10 7 10\"/><path d=\"M3.51 15a9 9 0 1 0 2.13-9.36L1 10\"/>",
  "activity": "<polyline points=\"22 12 18 12 15 21 9 3 6 12 2 12\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/>",
  "pause": "<rect x=\"6\" y=\"4\" width=\"4\" height=\"16\"/><rect x=\"14\" y=\"4\" width=\"4\" height=\"16\"/>",
};
    const EMOJI_TO_ICON = {
  "→": "arrow-right",
  "←": "arrow-left",
  "↗": "arrow-up-right",
  "↓": "arrow-down",
  "↑": "upload",
  "⬆️": "upload",
  "⬆": "upload",
  "⬇": "download",
  "↩️": "corner-up-left",
  "↩": "corner-up-left",
  "↷": "corner-up-left",
  "↺": "rotate-ccw",
  "↣": "arrow-right",
  "➜": "arrow-right",
  "✅": "check-circle",
  "✓": "check",
  "✔": "check",
  "✔️": "check",
  "❌": "x-circle",
  "✕": "x",
  "✖": "x",
  "✖️": "x",
  "✗": "x",
  "✘": "x",
  "⚠️": "alert-triangle",
  "⚠": "alert-triangle",
  "🚨": "alert-triangle",
  "📄": "file-text",
  "📕": "book",
  "📚": "book",
  "📋": "clipboard",
  "📑": "clipboard",
  "🤖": "cpu",
  "🔄": "refresh-cw",
  "🔁": "refresh-cw",
  "🏢": "building",
  "🏨": "building",
  "🛂": "passport",
  "💾": "save",
  "🗄️": "archive",
  "🗄": "archive",
  "🗂": "folder",
  "🗂️": "folder",
  "💼": "briefcase",
  "📝": "edit-3",
  "✍️": "edit-2",
  "✍": "edit-2",
  "🎓": "graduation-cap",
  "🔗": "link",
  "✏️": "edit-2",
  "✏": "edit-2",
  "🗑️": "trash",
  "🗑": "trash",
  "📧": "mail",
  "✉️": "mail",
  "✉": "mail",
  "📨": "mail",
  "📬": "mail",
  "📤": "upload",
  "📅": "calendar",
  "🧑‍": "briefcase",
  "🧑‍💼": "briefcase",
  "🔍": "search",
  "🔎": "search",
  "✈️": "send",
  "✈": "send",
  "🛫": "send",
  "🛬": "send",
  "🪪": "credit-card",
  "🏥": "plus-square",
  "⚕️": "plus-square",
  "⭐": "star",
  "👥": "users",
  "👤": "user",
  "🚀": "rocket",
  "📞": "phone",
  "📎": "paperclip",
  "👁": "eye",
  "📍": "map-pin",
  "📌": "map-pin",
  "☁️": "cloud",
  "☁": "cloud",
  "🎙️": "mic",
  "🎙": "mic",
  "🚗": "car",
  "📊": "bar-chart-2",
  "🔔": "bell",
  "🚛": "truck",
  "⚙️": "settings",
  "⚙": "settings",
  "🛢️": "database",
  "🛢": "database",
  "💡": "lightbulb",
  "🔢": "hash",
  "🖨️": "printer",
  "🖨": "printer",
  "🚫": "slash",
  "🎫": "ticket",
  "🏴": "flag",
  "🏁": "flag",
  "📁": "folder",
  "📂": "folder-open",
  "🔧": "tool",
  "🌍": "globe",
  "🌏": "globe",
  "🛡️": "shield",
  "🛡": "shield",
  "📦": "package",
  "📷": "camera",
  "⬜": "square",
  "⛶": "maximize",
  "💬": "message-square",
  "🖼️": "image",
  "🖼": "image",
  "❓": "help-circle",
  "🔒": "lock",
  "📱": "smartphone",
  "💰": "dollar-sign",
  "🎯": "target",
  "🎉": "award",
  "➕": "plus",
  "🇦": "flag",
  "🇪": "flag",
  "❤️": "activity",
  "🇦🇪": "flag",
  "⏰": "clock",
  "⏱": "clock",
  "⏱️": "clock",
  "⏳": "clock",
  "⏸": "pause",
  "⏸️": "pause",
};
    const DOT_COLORS = {
  "🟢": "#22c55e",
  "🟡": "#eab308",
  "🔴": "#ef4444",
  "⚪": "#94a3b8",
  "🟠": "#f97316",
};

    function Icon({ name, size = 16, color, style, className }) {
      const inner = ICON_PATHS[name];
      if (!inner) return null;
      return React.createElement('svg', {
        className, viewBox: '0 0 24 24', width: size, height: size,
        fill: 'none', stroke: color || 'currentColor', strokeWidth: 1.8,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: '-3px', flexShrink: 0, ...style },
        dangerouslySetInnerHTML: { __html: inner },
      });
    }

    // Renders the SVG icon that corresponds to a legacy emoji character. Falls
    // back to showing the raw emoji unchanged if it isn't in the map yet, so
    // nothing silently disappears.
    function EmojiIcon({ e, size = 16, color, style }) {
      if (!e) return null;
      if (DOT_COLORS[e]) {
        return React.createElement('span', {
          style: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: DOT_COLORS[e], flexShrink: 0, ...style },
        });
      }
      const name = EMOJI_TO_ICON[e];
      if (!name) return e;
      return React.createElement(Icon, { name, size, color, style });
    }

    // Splits a leading emoji (plus any following whitespace) off a plain-text
    // label/message string, e.g. "💾 Save Candidate" -> { emoji:'💾', text:'Save Candidate' }.
    // Used to convert legacy strings that bake an emoji into the label itself.
    const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;
    function splitLeadingEmoji(str) {
      if (!str || typeof str !== 'string') return { emoji: null, text: str };
      const m = LEADING_EMOJI_RE.exec(str);
      if (!m) return { emoji: null, text: str };
      return { emoji: m[1], text: str.slice(m[0].length) };
    }
    // Renders a label string that may start with a legacy emoji as an <Icon/> + text.
    function EmojiLabel({ text, size = 14, gap = 6 }) {
      const { emoji, text: rest } = splitLeadingEmoji(text);
      if (!emoji) return text;
      return React.createElement(React.Fragment, null,
        React.createElement(EmojiIcon, { e: emoji, size }),
        rest ? React.createElement('span', { style: { marginLeft: gap } }, rest) : null);
    }

    // Status bucket for an expiry date — used by ExcelTh filter dropdowns on date columns
    const expiryStatus = (value, threshold) => {
      if (!value) return 'Not entered';
      const d = daysUntil(value);
      if (d === null) return '—';
      if (d < 0) return 'Expired';
      if (d <= 7) return 'Critical (≤7d)';
      if (d <= (threshold||30)) return 'Warning';
      return 'OK';
    };

    // ExcelTh — header cell with an Excel-style autofilter funnel + dropdown checklist
    function ExcelTh({ label, colKey, rows, getValue, filters, setColFilter, frozen, left, style, className }) {
      const [open, setOpen] = React.useState(false);
      const [search, setSearch] = React.useState('');
      const ref = React.useRef(null);
      React.useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
      }, [open]);
      const allValues = React.useMemo(() => {
        const set = new Set();
        rows.forEach(r => set.add(String(getValue(r) ?? '—')));
        return Array.from(set).sort((a,b)=>a.localeCompare(b));
      }, [rows, getValue]);
      const active = filters[colKey]; // Set or undefined
      const isActive = !!active;
      const visibleValues = search ? allValues.filter(v => v.toLowerCase().includes(search.toLowerCase())) : allValues;
      const checked = (v) => !active || active.has(v);
      const toggleVal = (v) => {
        const base = active ? new Set(active) : new Set(allValues);
        if (base.has(v)) base.delete(v); else base.add(v);
        if (base.size === allValues.length) setColFilter(colKey, null);
        else setColFilter(colKey, base);
      };
      const selectAll = () => setColFilter(colKey, null);
      const clearAll = () => setColFilter(colKey, new Set());
      return (
        <th className={(frozen ? 'xl-frozen' : '') + (className ? ' '+className : '')} style={{ ...S.th, position:'relative', ...(frozen ? { left } : {}), ...style, minWidth: style?.width, maxWidth: style?.width }}>
          <div className="xl-th-inner">
            <span className="xl-th-label" title={label}>{label}</span>
            <button type="button" className={'xl-filter-btn' + (isActive ? ' active' : '')} onClick={(e)=>{ e.stopPropagation(); setOpen(o=>!o); }} title="Filter">▼</button>
          </div>
          {open && (
            <div ref={ref} className="xl-filter-pop" onClick={e=>e.stopPropagation()} style={{ textTransform:'none', letterSpacing:'normal', fontWeight:400 }}>
              <input type="text" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
              <div className="xl-filter-list">
                {visibleValues.map(v => (
                  <label key={v}>
                    <input type="checkbox" checked={checked(v)} onChange={()=>toggleVal(v)} />
                    <span>{v || '(blank)'}</span>
                  </label>
                ))}
                {visibleValues.length === 0 && <div style={{ fontSize:'11px', color:'#94a3b8', padding:'4px' }}>No matches</div>}
              </div>
              <div className="xl-filter-actions">
                <button type="button" onClick={selectAll}>Select All</button>
                <button type="button" onClick={clearAll}>Clear</button>
                <button type="button" onClick={()=>setOpen(false)}>OK</button>
              </div>
            </div>
          )}
        </th>
      );
    }


    // ============================================================
    // SATCO LETTERHEAD ASSETS — real header/footer artwork supplied by HR.
    // Shipped as plain files (satco-letterhead-header.jpg / satco-letterhead-footer.jpg)
    // alongside index.html, fetched at PDF-generation time — NOT inlined as base64 here,
    // to keep this file small. Requires being served over http(s) (e.g. Vercel); won't
    // resolve if index.html is opened directly as a local file:// page.
    // ============================================================

    // ============================================================
    // DATA MODEL — matches your database columns (snake_case)
    // ============================================================
    const EMPLOYEE_FIELDS = [
      { key: 'employee_id', label: 'Employee ID', group: 'identity', required: true },
      { key: 'full_name', label: 'Full Name', group: 'identity', required: true },
      { key: 'visa_trade', label: 'Visa Trade', group: 'employment' },
      { key: 'department', label: 'Department', group: 'employment' },
      { key: 'nationality', label: 'Nationality', group: 'identity' },
      { key: 'position', label: 'Position', group: 'employment' },
      { key: 'work_experience', label: 'Work Experience', group: 'employment' },
      { key: 'joining_date', label: 'Joining Date', group: 'employment', type: 'date' },
      { key: 'camp_arrival_date', label: 'Date of Actual Arrival / Coming to Camp', group: 'employment', type: 'date' },
      { key: 'actual_joining_date', label: 'Date of Actual Joining (Residence Visa Issued)', group: 'employment', type: 'date' },
      { key: 'basic_salary', label: 'Basic Salary', group: 'salary', type: 'number' },
      { key: 'allowance', label: 'Allowance', group: 'salary', type: 'number' },
      { key: 'status', label: 'Status', group: 'employment' },
      { key: 'dob', label: 'Date of Birth', group: 'identity', type: 'date' },
      { key: 'passport_no', label: 'Passport No', group: 'documents' },
      { key: 'passport_expiry', label: 'Passport Expiry', group: 'documents', type: 'date', expiry: 'passport' },
      { key: 'eid_no', label: 'EID No', group: 'documents' },
      { key: 'eid_hardcopy_recv', label: 'EID Hard Copy Recv Date', group: 'documents', type: 'date' },
      { key: 'eid_expiry', label: 'Emirates ID Expiry', group: 'documents', type: 'date', expiry: 'eid' },
      { key: 'visa_expiry', label: 'Visa Expiry', group: 'documents', type: 'date', expiry: 'visa' },
      { key: 'reference_by', label: 'Reference By', group: 'contact' },
      { key: 'reference_contact', label: 'Reference Contact Number', group: 'contact' },
      { key: 'email', label: 'Email', group: 'contact' },
      { key: 'india_contact', label: 'India Contact Number', group: 'contact' },
      { key: 'uae_contact', label: 'UAE Contact Number', group: 'contact' },
      { key: 'location', label: 'Location', group: 'contact' },
      { key: 'passport_handover', label: 'Passport Handover', group: 'documents' },
      { key: 'mobile', label: 'Mobile', group: 'contact' },
      { key: 'manager_email', label: 'Manager Email', group: 'contact' },
      { key: 'insurance_id', label: 'Insurance Company', group: 'documents', type: 'insurance_company' },
      { key: 'insurance_effective', label: 'Insurance Effective Date', group: 'documents', type: 'date' },
      { key: 'insurance_expiry', label: 'Insurance Expiry', group: 'documents', type: 'date', expiry: 'insurance' },
      { key: 'cicpa_no', label: 'CICPA Gate Pass No', group: 'documents' },
      { key: 'cicpa_expiry', label: 'CICPA Expiry', group: 'documents', type: 'date', expiry: 'cicpa' },
      { key: 'cicpa_locations', label: 'CICPA Permitted Locations', group: 'documents', type: 'locations' },
      { key: 'passport_img', label: 'Passport Image URL', group: 'documents', type: 'img_url', docKey: 'passport' },
      { key: 'eid_img', label: 'EID Image URL', group: 'documents', type: 'img_url', docKey: 'eid' },
      { key: 'visa_img', label: 'Visa Image URL', group: 'documents', type: 'img_url', docKey: 'visa' },
      { key: 'insurance_img', label: 'Insurance Image URL', group: 'documents', type: 'img_url', docKey: 'insurance' },
      { key: 'cicpa_img', label: 'CICPA Image URL', group: 'documents', type: 'img_url', docKey: 'cicpa' },
  { key: 'iloe_cert_no',   label: 'ILOE Certificate No',       group: 'documents' },
  { key: 'iloe_inception', label: 'ILOE Inception Date',        group: 'documents', type: 'date' },
  { key: 'iloe_expiry',    label: 'ILOE Expiry Date',           group: 'documents', type: 'date', expiry: 'iloe' },
  { key: 'iloe_premium',   label: 'ILOE Premium (AED)',         group: 'documents', type: 'number' },
  { key: 'iloe_img',       label: 'ILOE Certificate Image URL', group: 'documents', type: 'img_url', docKey: 'iloe' },
      { key: 'evisa_no', label: 'Employment eVisa No', group: 'documents' },
      { key: 'evisa_expiry', label: 'eVisa Expiry', group: 'documents', type: 'date', expiry: 'evisa' },
      { key: 'evisa_img', label: 'eVisa Image URL', group: 'documents', type: 'img_url', docKey: 'evisa' },
      { key: 'mohre_contract_no', label: 'MOHRE Contract / Transaction No', group: 'documents' },
      { key: 'mohre_contract_start', label: 'Contract Start Date', group: 'documents', type: 'date' },
      { key: 'mohre_contract_end', label: 'Contract End Date', group: 'documents', type: 'date', expiry: 'mohre' },
      { key: 'mohre_contract_img', label: 'MOHRE Contract Image URL', group: 'documents', type: 'img_url', docKey: 'mohre' },
      { key: 'bank_name', label: 'Bank Name', group: 'contact' },
      { key: 'bank_account_no', label: 'Bank Account No', group: 'contact' },
      { key: 'bank_iban', label: 'IBAN', group: 'contact' },
      { key: 'bank_img', label: 'Bank Document Image URL', group: 'documents', type: 'img_url', docKey: 'bank' },
      { key: 'hired_from', label: 'Hired From', group: 'employment' },
      { key: 'supplier_name', label: 'Supplier / Agency Name', group: 'employment' },
      { key: 'rate_per_hour', label: 'Rate Per Hour (AED)', group: 'salary', type: 'number' },
      { key: 'emergency_name', label: 'Emergency Contact Name', group: 'emergency' },
      { key: 'emergency_relation', label: 'Emergency Contact Relationship', group: 'emergency' },
      { key: 'emergency_mobile', label: 'Emergency Contact Mobile', group: 'emergency' },
      { key: 'emergency_country', label: 'Emergency Contact Country', group: 'emergency' },
    ];

    // Pre-set CICPA locations (ADNOC oil & gas fields in UAE)
    const CICPA_LOCATIONS = ['Ruwais', 'Habshan', 'Fujairah', 'Das Island', 'Ghasha', 'Shah', 'Mender', 'Bab', 'Asab'];

    const INSURANCE_COMPANIES = [
      'Daman', 'AXA Gulf', 'Orient Insurance', 'Oman Insurance', 'MetLife', 'Neuron',
      'NAS', 'Sukoon', 'Al Sagr', 'Takaful Emarat', 'Abu Dhabi National Insurance (ADNIC)',
      'Al Ain Ahlia', 'Dubai Insurance', 'Emirates Insurance', 'GIG Gulf',
      'Watania Takaful', 'Noor Takaful', 'Salama Islamic', 'Union Insurance',
      'RAK Insurance', 'National General Insurance (NGI)', 'Other'
    ];

    const EXPIRY_TYPES = [
      { key: 'passport', label: 'Passport', col: 'passport_expiry', defaultDays: 180, color: '#dc2626' },
      { key: 'eid', label: 'Emirates ID', col: 'eid_expiry', defaultDays: 60, color: '#ea580c' },
      { key: 'visa', label: 'Visa', col: 'visa_expiry', defaultDays: 60, color: '#ca8a04' },
      { key: 'insurance', label: 'Insurance', col: 'insurance_expiry', defaultDays: 30, color: '#0891b2' },
      { key: 'cicpa', label: 'CICPA Gate Pass', col: 'cicpa_expiry', defaultDays: 15, color: '#7c3aed' },
      { key: 'iloe',  label: 'ILOE',            col: 'iloe_expiry',  defaultDays: 30, color: '#be185d' },
    ];

    const DEFAULT_THRESHOLDS = { passport: 180, eid: 60, visa: 60, insurance: 30, cicpa: 15, iloe: 30, training_cert: 30 };

    // ============================================================
    // TRAINING MATRIX — ADNOC & TAQA required trainings
    // ============================================================
    const TRAINING_CATEGORIES = [
      {
        id: 'baseline',
        label: '1 — Baseline Site Entry',
        color: '#059669',
        bg: '#ecfdf5',
        trainings: [
          { id: 'adnoc_hse', label: 'ADNOC HSE Induction & Life Saving Rules (LSR)', site: 'ADNOC' },
          { id: 'taqa_hseq', label: 'TAQA HSEQ Induction & Golden Rules', site: 'TAQA' },
          { id: 'h2s_l1', label: 'H2S Awareness — Level 1 (General site presence)', site: 'Both' },
          { id: 'h2s_l2', label: 'H2S / SCBA Competency — Level 2 (Active process zones)', site: 'Both' },
          { id: 'wah_medical', label: 'Working at Height Medical Fitness Certificate', site: 'Both' },
          { id: 'fire_warden', label: 'Basic Fire Fighting / Fire Warden (UAE Civil Defence)', site: 'Both' },
          { id: 'first_aid', label: 'First Aid / CPR (UAE Red Crescent accredited)', site: 'Both' },
        ]
      },
      {
        id: 'skilled',
        label: '2 — Skilled Trades & Labour',
        color: '#d97706',
        bg: '#fffbeb',
        trainings: [
          { id: 'rigger_1', label: 'Rigger Level 1 — TPI/LEEA', site: 'Both' },
          { id: 'rigger_2', label: 'Rigger Level 2 — TPI/LEEA', site: 'Both' },
          { id: 'rigger_3', label: 'Rigger Level 3 — TPI/LEEA', site: 'Both' },
          { id: 'lifting_sup', label: 'Lifting Supervisor / Appointed Person (ADNOC-P-HSE-007)', site: 'Both' },
          { id: 'scaffold_erector', label: 'Scaffold Erector & Inspector — STI/CITB/CISRS', site: 'Both' },
          { id: 'scaffold_sup', label: 'Scaffolding Supervisor — Advanced STI (Red/Green tagging)', site: 'Both' },
          { id: 'drops', label: 'DROPS — Dropped Objects Prevention Scheme', site: 'Both' },
          { id: 'agt', label: 'Authorized Gas Tester (AGT)', site: 'Both' },
          { id: 'cse', label: 'Confined Space Entry (CSE) — Entry Supervisor / Attendant / Standby', site: 'Both' },
        ]
      },
      {
        id: 'engineering',
        label: '3 — Engineering & Project Management',
        color: '#2563eb',
        bg: '#eff6ff',
        trainings: [
          { id: 'soe_card', label: 'UAE Society of Engineers (SOE) Card', site: 'Both' },
          { id: 'adnoc_tpa', label: 'ADNOC Technical Interview & CV Pre-Approval (TPA)', site: 'ADNOC' },
          { id: 'asme_api', label: 'ASME B31.3 / API 650 / API 570 / API 653 Code Competency', site: 'Both' },
          { id: 'loto', label: 'Energy Isolation / LOTO — Authorized Isolation Person (AIP)', site: 'Both' },
          { id: 'compex', label: 'CompEx Certification Ex01–Ex04 (E&I — Hazardous Areas)', site: 'Both' },
          { id: 'adnoc_esr', label: 'ADNOC Electrical Safety Rules (ESR) — AEP/CEP', site: 'ADNOC' },
          { id: 'taqa_ssr', label: 'TAQA System Safety Rules (SSR)', site: 'TAQA' },
          { id: 'wms_simops', label: 'ADNOC WMS / SIMOPS Training', site: 'ADNOC' },
        ]
      },
      {
        id: 'qaqc',
        label: '4 — QA/QC & Inspection',
        color: '#7c3aed',
        bg: '#f5f3ff',
        trainings: [
          { id: 'cswip31', label: 'Welding Inspection — CSWIP 3.1 or AWS-CWI', site: 'Both' },
          { id: 'ndt_l2', label: 'NDT Level II — ASNT / PCN (RT, UT, MT, PT)', site: 'Both' },
          { id: 'coating', label: 'Coating / Painting Inspection — NACE/AMPP Lvl II or BGAS-CSWIP Gr.2', site: 'Both' },
          { id: 'api510', label: 'API 510 — Pressure Vessel Inspection', site: 'Both' },
          { id: 'api570', label: 'API 570 — Piping Inspection', site: 'Both' },
          { id: 'api653', label: 'API 653 — Tank Inspection', site: 'Both' },
          { id: 'iso9001', label: 'ISO 9001:2015 Lead Auditor (QC Managers)', site: 'Both' },
        ]
      },
      {
        id: 'commissioning',
        label: '5 — Pre-commissioning & Commissioning',
        color: '#0891b2',
        bg: '#ecfeff',
        trainings: [
          { id: 'ptw_jp', label: 'Advanced Job Performer (JP) / PTW Sign-off Authority', site: 'ADNOC' },
          { id: 'chemical_n2', label: 'Chemical Handling & Nitrogen Purging Safety', site: 'Both' },
          { id: 'esd', label: 'Emergency Response & ESD Awareness / Bypass Protocols', site: 'Both' },
          { id: 'pressure_test', label: 'Hydrostatic / Pneumatic Pressure Test Safety', site: 'Both' },
        ]
      },
      {
        id: 'hse_supervisory',
        label: '6 — Corporate / HSE Supervisory',
        color: '#dc2626',
        bg: '#fef2f2',
        trainings: [
          { id: 'bbs', label: 'Behavior-Based Safety (BBS) — Supervisors & Engineers', site: 'Both' },
          { id: 'iso_corp', label: 'Company ISO 9001 / 14001 / 45001 (Corporate Level)', site: 'Both' },
        ]
      },
    ];

    // Flat list for quick lookup
    const ALL_STANDARD_TRAININGS = TRAINING_CATEGORIES.flatMap(c => c.trainings.map(t => ({ ...t, categoryId: c.id, categoryLabel: c.label })));

    const isStrictEmployed = (s) => {
      if (!s) return false;
      const l = String(s).toLowerCase().trim();
      return l === 'employee' || l === 'employed';
    };
    const isBroadEmployed = (s) => {
      if (!s) return false;
      const l = String(s).toLowerCase().trim();
      return ['employee','employed','work permit','workpermit','employment visa issued'].some(x => l === x || l.includes(x));
    };

    // ============ DATE HELPERS ============
    const parseDate = (v) => {
      if (!v) return null;
      if (v instanceof Date) return v;
      if (typeof v === 'number') { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return isNaN(d) ? null : d; }
      const s = String(v).trim();
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) { const d = new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1])); return isNaN(d) ? null : d; }
      const d = new Date(s); return isNaN(d) ? null : d;
    };
    const fmtDateISO = (v) => { const d = parseDate(v); return d ? d.toISOString().slice(0, 10) : ''; };
    const fmtDateDisplay = (v) => { const d = parseDate(v); return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; };
    const daysUntil = (v) => {
      const d = parseDate(v); if (!d) return null;
      const t = new Date(); t.setHours(0,0,0,0); d.setHours(0,0,0,0);
      return Math.round((d - t) / 86400000);
    };

    // ============================================================
    // LOGIN SCREEN
    // ============================================================
    function Login({ onLogin }) {
      const [email, setEmail] = useState('');
      const [password, setPassword] = useState('');
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);

      const submit = async () => {
        setError(''); setBusy(true);
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) { setError(error.message); return; }
        onLogin(data.user);
      };

      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', width: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#2563eb', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}><EmojiIcon e="🏢" /></div>
              <h1 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>SATCO Arabia</h1>
              <div style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>HR Compliance Portal</div>
            </div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="you@satcoarabia.com"
              style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--bd2)', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }} />
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••"
              style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--bd2)', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }} />
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
            <button className="hr-btn" onClick={submit} disabled={busy}
              style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize:'17px', fontWeight:700, cursor: 'pointer' }}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
            <div style={{ marginTop: '20px', fontSize: '12px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>
              Access is managed by your HR administrator.<br/>Contact them if you need an account.
            </div>
          </div>
        </div>
      );
    }

    // ============================================================
    // MAIN APP
    // ============================================================
    // Isolated so the once-a-second tick only re-renders this small text node,
    // instead of the entire HRApp tree (and every view mounted under it). This
    // used to live as `now` state directly inside HRApp, which meant EVERY
    // open screen re-rendered every second regardless of whether it showed
    // any time-sensitive data — a cost that grows as more modules are added.
    function LiveClock() {
      const [now, setNow] = useState(() => new Date());
      useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
      }, []);
      return (
        <>{now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Dubai'})}</>
      );
    }

    function HRApp({ user, onLogout }) {
      const [view, setView] = useState('dashboard');
      const [employees, setEmployees] = useState([]);
      const [mobDemob, setMobDemob] = useState([]);
      const [recipients, setRecipients] = useState([]);
      const [contacts, setContacts] = useState([]);
      const [trainings, setTrainings] = useState([]);
      const [editingContact, setEditingContact] = useState(null);
      const [hiring, setHiring] = useState([]);
      const [editingHiring, setEditingHiring] = useState(null);
      const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
      const [dashFilter, setDashFilter] = useState('all');
      const [loading, setLoading] = useState(true);
      const [editingEmp, setEditingEmp] = useState(null);
      const [editingMob, setEditingMob] = useState(null);
      const [selectedMobEmp, setSelectedMobEmp] = useState(null); // null = list view, emp obj = detail view
      const [interviewSheetCandidate, setInterviewSheetCandidate] = useState(null); // null = closed, {} = blank, {id,...} = pre-filled
      const [search, setSearch] = useState('');
      const [statusFilter, setStatusFilter] = useState('all');
      const [toast, setToast] = useState(null);
      const [darkMode, setDarkMode] = useState(() => {
        try { return localStorage.getItem('satco_dark_mode') === '1'; } catch (e) { return false; }
      });
      // Lightweight badge count for the Supplier Manpower nav item — the module itself is
      // fully self-contained (own data load/CRUD), so this is a separate head-count query
      // rather than wiring suppliers/supplierEmployees into the main loadAll(). Re-runs on
      // every navigation so the badge stays current after adding/removing supplier employees.
      const [supplierManpowerCount, setSupplierManpowerCount] = useState(0);
      // Trade-license expiry alert — separate lightweight query so the nav badge can turn red
      // the moment a supplier's license is within 30 days of expiring or already expired,
      // without needing to open the Supplier Manpower module first.
      const [supplierLicenseAlertCount, setSupplierLicenseAlertCount] = useState(0);
      useEffect(() => {
        (async () => {
          try {
            const { count } = await db.from('supplier_employees').select('id', { count:'exact', head:true }).is('deleted_at', null);
            setSupplierManpowerCount(count || 0);
          } catch (e) { /* table not created yet — badge just stays 0 */ }
          try {
            const { data } = await db.from('suppliers').select('trade_license_expiry').is('deleted_at', null);
            const expiring = (data || []).filter(s => { const d = daysUntil(s.trade_license_expiry); return d !== null && d <= 30; }).length;
            setSupplierLicenseAlertCount(expiring);
          } catch (e) { /* table not created yet — alert just stays 0 */ }
        })();
      }, [view]);
      useEffect(() => {
        try { localStorage.setItem('satco_dark_mode', darkMode ? '1' : '0'); } catch (e) {}
      }, [darkMode]);

      // The live header clock now lives in its own <LiveClock /> component (see
      // above) so its once-a-second tick doesn't re-render all of HRApp.

      const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

      // NOTE: Storage bucket 'hr-documents' is pre-created in Supabase dashboard.
      // Do NOT call createBucket here — the anon key lacks permission and it causes a 400 error.

      const splitActive = (rows) => (rows || []).filter(x => !x.deleted_at);

      const loadAll = async () => {
        const [e, m, r, c, tr, hi] = await Promise.all([
          db.from('employees').select('*').order('employee_id'),
          db.from('mob_demob').select('*').order('employee_id'),
          db.from('recipients').select('*'),
          db.from('employee_contacts').select('*').order('employee_number'),
          db.from('employee_trainings').select('*').order('employee_id'),
          db.from('hiring_pipeline').select('*').order('created_at', { ascending: false }),
        ]);
        // splitActive() filters out soft-deleted rows (Recycle Bin items) so every existing
        // view keeps working exactly as before — the Recycle Bin / Activity Log views fetch
        // their own data independently (see RecycleBinView / ActivityLogView below).
        if (e.data) setEmployees(splitActive(e.data));
        if (m.data) setMobDemob(splitActive(m.data));
        if (r.data) setRecipients(splitActive(r.data));
        if (c.data) setContacts(splitActive(c.data));
        if (tr.data) setTrainings(splitActive(tr.data));
        // NOTE: the previous "self-heal" here silently force-wrote step='interview' and
        // interview_date on every load for any candidate with a score/salary/verdict present —
        // this was the main cause of cards jumping stages with no user action. Removed.
        // Stage now only changes via an explicit "Move to next stage" action (manual_stage).
        if (hi.data) setHiring(splitActive(hi.data));
        setLoading(false);
      };
      useEffect(() => { loadAll(); }, []);

      const dashboardEmployees = useMemo(() => employees.filter(e => {
        if (!e.employee_id) return false;
        if (dashFilter === 'all') return true;
        if (dashFilter === 'employed_broad') return isBroadEmployed(e.status);
        return isStrictEmployed(e.status);
      }), [employees, dashFilter]);

      // Alerts always cover ALL employees regardless of dashboard filter
      const allActiveEmployees = useMemo(() => employees.filter(e => e.employee_id), [employees]);

      const alerts = useMemo(() => {
        const out = [];
        allActiveEmployees.forEach(emp => {
          EXPIRY_TYPES.forEach(et => {
            const d = daysUntil(emp[et.col]);
            if (d === null) return;
            const th = thresholds[et.key] || et.defaultDays;
            if (d <= th) out.push({
              employee_id: emp.employee_id, full_name: emp.full_name, email: emp.email,
              mobile: emp.uae_contact || emp.mobile || emp.india_contact, manager_email: emp.manager_email,
              type: et.key, typeLabel: et.label, color: et.color, expiryDate: emp[et.col], daysLeft: d,
              severity: d < 0 ? 'expired' : d <= 7 ? 'critical' : d <= 30 ? 'urgent' : 'warning',
            });
          });
        });
        // Training certificate expiry alerts (30 days threshold)
        const TRAINING_CERT_THRESHOLD = thresholds.training_cert || 30;
        trainings.forEach(tr => {
          const emp = allActiveEmployees.find(e => e.employee_id === tr.employee_id);
          if (!emp) return;
          let parsed = {};
          try { parsed = JSON.parse(tr.training_records || '{}'); } catch {}
          // Standard trainings
          ALL_STANDARD_TRAININGS.forEach(t => {
            const rec = parsed[t.id];
            if (!rec?.expiry) return;
            const d = daysUntil(rec.expiry);
            if (d === null || d > TRAINING_CERT_THRESHOLD) return;
            out.push({
              employee_id: tr.employee_id, full_name: tr.full_name, email: emp.email,
              mobile: emp.uae_contact || emp.mobile || emp.india_contact,
              type: 'training_cert',
              typeLabel: rec.courseName || t.label,
              issuingCompany: rec.issuingCompany || '',
              certNo: rec.certNo || '',
              color: '#0f766e',
              expiryDate: rec.expiry, daysLeft: d,
              severity: d < 0 ? 'expired' : d <= 7 ? 'critical' : d <= 30 ? 'urgent' : 'warning',
            });
          });
          // Other / custom trainings
          (parsed.__other || []).forEach(ot => {
            if (!ot.expiry) return;
            const d = daysUntil(ot.expiry);
            if (d === null || d > TRAINING_CERT_THRESHOLD) return;
            out.push({
              employee_id: tr.employee_id, full_name: tr.full_name, email: emp.email,
              mobile: emp.uae_contact || emp.mobile || emp.india_contact,
              type: 'training_cert',
              typeLabel: ot.courseName || ot.label || 'Training Certificate',
              issuingCompany: ot.issuingCompany || '',
              certNo: ot.certNo || '',
              color: '#0f766e',
              expiryDate: ot.expiry, daysLeft: d,
              severity: d < 0 ? 'expired' : d <= 7 ? 'critical' : d <= 30 ? 'urgent' : 'warning',
            });
          });
        });
        return out.sort((a, b) => a.daysLeft - b.daysLeft);
      }, [allActiveEmployees, thresholds, trainings]);

      const stats = useMemo(() => ({
        total: dashboardEmployees.length,
        totalAll: employees.length,
        expired: alerts.filter(a => a.severity === 'expired').length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        departments: [...new Set(dashboardEmployees.map(e => e.department).filter(Boolean))].length,
        passportCount: alerts.filter(a => a.type === 'passport').length,
        passportExpired: alerts.filter(a => a.type === 'passport' && a.severity === 'expired').length,
        eidCount: alerts.filter(a => a.type === 'eid').length,
        eidExpired: alerts.filter(a => a.type === 'eid' && a.severity === 'expired').length,
        cicpaCount: alerts.filter(a => a.type === 'cicpa').length,
        cicpaExpired: alerts.filter(a => a.type === 'cicpa' && a.severity === 'expired').length,
        iloeCount: alerts.filter(a => a.type === 'iloe').length,
        iloeExpired: alerts.filter(a => a.type === 'iloe' && a.severity === 'expired').length,
        trainingCertCount: alerts.filter(a => a.type === 'training_cert').length,
        trainingCertExpired: alerts.filter(a => a.type === 'training_cert' && a.severity === 'expired').length,
        alertEmployeeCount: allActiveEmployees.length,
      }), [dashboardEmployees, employees, allActiveEmployees, alerts]);

      // ===== CRUD =====
      const saveEmployee = async (emp) => {
        try {

        const clean = {};
        EMPLOYEE_FIELDS.forEach(f => {
          let v = emp[f.key];
          if (v === '' || v === undefined) v = null;
          if (f.type === 'number' && v != null) v = parseFloat(v) || null;
          clean[f.key] = v;
        });
        if (emp.id) {
          const { data: updatedRows, error } = await db.from('employees').update(clean).eq('id', emp.id).select('id'); if (!error && (!updatedRows || updatedRows.length === 0)) return showToast('Save did not apply, no employee row matched this ID. Nothing was changed, please reload and try again.', 'error');
          if (error) return showToast(error.message, 'error');
        } else {
          const { error } = await db.from('employees').insert(clean);
          if (error) return showToast(error.message, 'error');
        }

        // Auto-sync name/position into Contact Directory, Mob/Demob, and Trainings
        if (clean.employee_id && clean.full_name) {
          const { data: existingArr } = await db.from('employee_contacts')
            .select('id').eq('employee_number', clean.employee_id).limit(1);
          if (existingArr && existingArr.length > 0) {
            await db.from('employee_contacts').update({ full_name: clean.full_name }).eq('employee_number', clean.employee_id);
          } else {
            await db.from('employee_contacts').insert({ employee_number: clean.employee_id, full_name: clean.full_name });
          }
          await db.from('mob_demob').update({ full_name: clean.full_name }).eq('employee_id', clean.employee_id);
          // Sync name/position to training row — preserve existing training_records
          const { data: trExist } = await db.from('employee_trainings')
            .select('id').eq('employee_id', clean.employee_id).limit(1);
          if (!trExist || trExist.length === 0) {
            await db.from('employee_trainings').insert({
              employee_id: clean.employee_id,
              full_name: clean.full_name,
              position: clean.position_selected || clean.position || null,
              cicpa_locations: clean.cicpa_locations || null,
              training_records: '{}',
            });
          } else {
            await db.from('employee_trainings').update({
              full_name: clean.full_name,
              position: clean.position || null,
              cicpa_locations: clean.cicpa_locations || null,
            }).eq('employee_id', clean.employee_id);
          }
        }

        await logAudit(user, 'employees', emp.id, clean.full_name, emp.id ? 'update' : 'create', emp.id ? 'Employee record updated' : 'Employee record created');
        await loadAll(); setEditingEmp(null); showToast('Employee saved — all tabs synced');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      const deleteEmployee = async (id) => {
        try {

        if (!window.confirm('Delete this employee? It will be moved to the Recycle Bin for 30 days before being permanently removed.')) return;
        const emp = employees.find(e => e.id === id);
        const mode = await softDeleteRow(user, 'employees', id, emp && emp.full_name);
        await loadAll(); showToast(mode === 'soft' ? 'Employee moved to Recycle Bin' : 'Employee deleted');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      const saveMob = async (rec) => {
        try {

        const clean = { employee_id: rec.employee_id || null, full_name: rec.full_name || null, position: rec.position || null,
          eid_no: rec.eid_no || null, mobilization_date: rec.mobilization_date || null,
          demobilization_date: rec.demobilization_date || null,
          supply: rec.supply || null, location: rec.location || null, remarks: rec.remarks || null };
        if (rec.id) { const { error } = await db.from('mob_demob').update(clean).eq('id', rec.id); if (error) return showToast(error.message, 'error'); }
        else { const { error } = await db.from('mob_demob').insert(clean); if (error) return showToast(error.message, 'error'); }
        await logAudit(user, 'mob_demob', rec.id, clean.full_name, rec.id ? 'update' : 'create', 'Mob/Demob record ' + (rec.id ? 'updated' : 'created'));
        await loadAll(); setEditingMob(null); showToast('Record saved');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      const redeployMob = async (oldRec, demobDate) => {
        try {

        if (!demobDate) return;
        const { error } = await db.from('mob_demob').update({ demobilization_date: demobDate }).eq('id', oldRec.id);
        if (error) return showToast(error.message, 'error');
        await loadAll();
        setEditingMob({ employee_id: oldRec.employee_id, full_name: oldRec.full_name, position: oldRec.position, eid_no: oldRec.eid_no, mobilization_date: demobDate,
          _previous: { mobilization_date: oldRec.mobilization_date, demobilization_date: demobDate, supply: oldRec.supply, location: oldRec.location } });
        showToast('Previous assignment closed — enter new assignment details');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      const deleteMob = async (id) => {
        try {

        if (!window.confirm('Delete this record? It will be moved to the Recycle Bin for 30 days before being permanently removed.')) return;
        const rec = mobDemob.find(m => m.id === id);
        const mode = await softDeleteRow(user, 'mob_demob', id, rec && rec.full_name);
        await loadAll(); showToast(mode === 'soft' ? 'Record moved to Recycle Bin' : 'Record deleted');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      const saveRecipient = async (recip) => {
        try {

        const { error } = await db.from('recipients').insert({ email: recip.email, name: recip.name || null, role: recip.role || 'hr' });
        if (error) return showToast(error.message, 'error');
        await logAudit(user, 'recipients', null, recip.name || recip.email, 'create', 'Alert recipient added');
        await loadAll(); showToast('Recipient added');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      const saveContact = async (rec) => {
        try {

        const clean = {
          employee_number: rec.employee_number || null,
          full_name: rec.full_name || null,
          mobile_uae: rec.mobile_uae || null,
          mobile_home: rec.mobile_home || null,
          email: rec.email || null,
          whatsapp: rec.whatsapp || null,
          home_address: rec.home_address || null,
          uae_address: rec.uae_address || null,
          emergency_name: rec.emergency_name || null,
          emergency_relation: rec.emergency_relation || null,
          emergency_country: rec.emergency_country || null,
          emergency_mobile: rec.emergency_mobile || null,
          notes: rec.notes || null,
        };
        if (rec.id) {
          const { error } = await db.from('employee_contacts').update(clean).eq('id', rec.id);
          if (error) return showToast(error.message, 'error');
        } else {
          const { error } = await db.from('employee_contacts').insert(clean);
          if (error) return showToast(error.message, 'error');
        }
        await logAudit(user, 'employee_contacts', rec.id, clean.full_name, rec.id ? 'update' : 'create', 'Contact record ' + (rec.id ? 'updated' : 'created'));
        await loadAll(); setEditingContact(null); showToast('Contact saved');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      const deleteContact = async (id) => {
        try {

        if (!window.confirm('Delete this contact record? It will be moved to the Recycle Bin for 30 days before being permanently removed.')) return;
        const rec = contacts.find(c => c.id === id);
        const mode = await softDeleteRow(user, 'employee_contacts', id, rec && rec.full_name);
        await loadAll(); showToast(mode === 'soft' ? 'Contact moved to Recycle Bin' : 'Contact deleted');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };

      // ===== HIRING PIPELINE CRUD =====
      // Columns that may not exist yet if the SQL migration hasn't been run on this Supabase
      // project. Save retries progressively without them so the rest of the record still saves.
      const OPTIONAL_HIRING_COLUMNS = ['manual_stage', 'step_confirmations', 'pipeline_location', 'temp_employee_id'];
      // Pulls the column name straight out of Postgrest's "missing column" error (PGRST204), e.g.
      // "Could not find the 'pickup_alert_sent' column of 'hiring_pipeline' in the schema cache".
      // BUG FIX: previously only the 4 OPTIONAL_HIRING_COLUMNS above were retried-without — any
      // OTHER column that hadn't been migrated yet on this Supabase project (pickup_alert_sent,
      // visa_expiry_alert_sent, ticket_reminder_sent, post_arrival_alert_sent, date_of_arrival,
      // etc. — the whole "Transport arrangement" migration block) made the ENTIRE save fail with
      // a 400, silently dropping the whole candidate record — name, dates, everything — not just
      // that one field. This generic fallback drops whatever column Postgrest actually reports
      // missing so an out-of-date schema never blocks the rest of the save.
      const extractMissingColumn = (error) => {
        const msg = (error && (error.message || error.details || '')) || '';
        const m = msg.match(/find the '([^']+)' column/i) || msg.match(/column '?"?([a-z0-9_]+)"?'? .*does not exist/i);
        return m ? m[1] : null;
      };
      const trySaveHiringRow = async (clean, recId) => {
        let payload = { ...clean };
        const warnings = [];
        const maxAttempts = Object.keys(payload).length + 1;
        for (let attempt = 0; attempt <= maxAttempts; attempt++) {
          const { data, error } = recId
            ? await db.from('hiring_pipeline').update(payload).eq('id', recId).select()
            : await db.from('hiring_pipeline').insert(payload).select();
          if (!error) return { data, error: null, warnings };
          let missingCol = OPTIONAL_HIRING_COLUMNS.find(col => col in payload && isMissingColumnError(error, col));
          if (!missingCol) {
            const detected = extractMissingColumn(error);
            if (detected && detected in payload) missingCol = detected;
          }
          if (!missingCol) return { data, error, warnings };
          delete payload[missingCol];
          warnings.push(missingCol);
        }
        return { data: null, error: { message: 'Save failed after retries' }, warnings };
      };
      const HIRING_COLUMN_WARNING_TEXT = {
        manual_stage: "couldn't set pipeline stage — run the 'manual_stage' SQL migration in Supabase to enable stage moves.",
        step_confirmations: "couldn't store step completion flags — run the 'step_confirmations' SQL migration in Supabase to enable the no-date complete shortcut.",
        pipeline_location: "couldn't save Resume Database status — run the 'pipeline_location' SQL migration in Supabase to enable moving candidates between Hiring Pipeline and Resume Database.",
        temp_employee_id: "couldn't save Temp Employee ID — run the migration in Supabase to enable visa-processing temp IDs.",
      };
      const saveHiring = async (rec) => {
        try {

        const HIRING_FIELDS = [
          // Personal
          'candidate_name','passport_no','passport_expiry_candidate','place_of_issue',
          'nationality','dob_candidate','marital_status','religion','languages','home_address',
          // Contact
          'phone','whatsapp','email','current_location','referred_by','referred_contact',
          // Professional
          'position','position_selected','department','experience','current_employer','current_designation',
          'skills','education','work_history',
          // Middle East Experience
          'me_experience','me_history','me_notes',
          // Interview Assessment
          'interview_date','interview_type','interviewed_by','interview_score',
          'interview_score_technical','interview_score_comm','interview_score_safety',
          'interview_score_exp','interview_score_attitude','interview_score_docs',
          'interview_notes','interview_qa','interview_mode','interview_verdict','verdict_reason',
          // Offer & Salary
          'basic_salary','allowance','total_salary',
          'accommodation_by','transport_by','food_by','air_ticket',
          'deployment_site','available_from',
          'offer_letter_date','offer_accepted_date','offer_status',
          // Medical & Health
          'medical_conditions','on_medication','colour_blindness','vision_aids',
          'fit_for_height','fit_for_cse','medical_notes','gamka_result','gamka_date',
          // Family
          'dependants_count','children_count','family_in_uae','family_details','emergency_contact',
          // Certifications
          'certifications_held','other_certifications',
          // Pipeline
          'hiring_scenario','status','step','step_due_date','manual_stage','step_confirmations','pipeline_location',
          'temp_employee_id',
          'visa_arranged_date','status_change_date',
          'visa_medical_date','visa_documents_sent_date','visa_stamped_date','expected_arrival_date','visa_cancel_date','residence_visa_date','work_permit_date','work_permit_ref','contract_draft_date','evisa_received_date','entry_permit_date','entry_permit_expiry','entry_permit_ref','insurance_arranged_date','insurance_policy_no','entry_permit_sent_date','arrival_date','medical_fitness_date','medical_fitness_result','eid_biometric_date','eid_application_ref','contract_registered_date','wps_enrolled_date','visa_stamp_applied_date','visa_stamped_in_passport_date','passport_returned_date','eid_issued_date','labour_card_date','labour_card_ref','visa_total_cost',
          'remarks',
          // Documents
          'resume_url','passport_img_url','offer_signed_url','certificates_url','interview_sheet_url',
          'offer_letter_url','visa_medical_url','visa_docs_url','visa_stamped_url','travel_doc_url','joining_doc_url','onward_ticket_url',
          // Ticket transport fields (index210)
          'ticket_pnr','ticket_airline','ticket_flight_no','ticket_from_city','ticket_from_airport','ticket_from_terminal',
          'ticket_to_city','ticket_to_airport','ticket_to_terminal','ticket_depart_datetime','ticket_arrive_datetime',
          'ticket_seat','ticket_class','ticket_data_json',
          // Transport arrangement fields (index211)
          'visit_visa_url','visit_visa_issue_date','visit_visa_expiry_date','visit_visa_permit_no','visit_visa_type',
          'd_return_ticket_url','d_return_ticket_sent_date','d_hotel_booking_url','d_hotel_booking_sent_date',
          'date_of_arrival','arrival_manually_set',
          'visa_expiry_alert_sent','ticket_reminder_sent','pickup_alert_sent','post_arrival_alert_sent',
          // Supplier
          'is_supplier_hire','supplier_name','supplier_contact_name','supplier_phone',
          'supplier_whatsapp','supplier_email','supplier_address',
          'rate_per_hour','supplier_notes',
        ];
        const clean = {};
        HIRING_FIELDS.forEach(k => { let v = rec[k]; if (v === '' || v === undefined) v = null; clean[k] = v; });
        if (rec.id) {
          const { data: savedRec, error, warnings } = await trySaveHiringRow(clean, rec.id);
          warnings.forEach(col => showToast('⚠️ Saved, but ' + (HIRING_COLUMN_WARNING_TEXT[col] || ("couldn't save '" + col + "' — run the pending SQL migration in Supabase to add this column.")), 'error'));
          if (error) return showToast(error.message, 'error');
          if (!savedRec || savedRec.length === 0) return showToast('❌ Save affected 0 rows — check Supabase RLS policy (WITH CHECK) on hiring_pipeline UPDATE.', 'error');
        } else {
          const { error, warnings } = await trySaveHiringRow(clean, null);
          warnings.forEach(col => showToast('⚠️ Saved, but ' + (HIRING_COLUMN_WARNING_TEXT[col] || ("couldn't save '" + col + "' — run the pending SQL migration in Supabase to add this column.")), 'error'));
          if (error) return showToast(error.message, 'error');
        }
        // ── AUTO-TRANSFER TO EMPLOYEES when status = Joined ──
        if ((clean.status === 'Joined' || clean.manual_stage === 'joined') && rec.id) {
          // Check if already transferred (employee with this name+passport exists)
          const { data: existing } = await db.from('employees')
            .select('id,employee_id').eq('passport_no', clean.passport_no || '__none__').limit(1);

          if (!existing || existing.length === 0) {
            // If this candidate was assigned a Temp Employee ID during Visa Processing
            // (e.g. SA1010T), promote it to the real ID by dropping the trailing "T" —
            // keeps any deposit/advance logged in Finance against SA1010T matching up
            // with the permanent employee record. Otherwise fall back to the next free
            // SA-number, same as before.
            let nextId;
            const tempId = (clean.temp_employee_id || '').trim();
            if (/^SA\d+T$/i.test(tempId)) {
              nextId = tempId.slice(0, -1).toUpperCase();
            } else {
              // Generate next Employee ID: find highest SA-number
              const { data: empRows } = await db.from('employees').select('employee_id');
              let maxNum = 1000;
              (empRows || []).forEach(e => {
                const m = (e.employee_id || '').match(/SA(\d+)/i);
                if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
              });
              nextId = 'SA' + (maxNum + 1);
            }

            const joiningDate = clean.expected_arrival_date || clean.available_from || new Date().toISOString().slice(0,10);

            const newEmp = {
              employee_id:   nextId,
              full_name:     clean.candidate_name || null,
              position:      clean.position || null,
              department:    clean.department || null,
              nationality:   clean.nationality || null,
              passport_no:   clean.passport_no || null,
              email:         clean.email || null,
              mobile:        clean.phone || null,
              uae_contact:   clean.phone || null,
              basic_salary:  clean.basic_salary ? parseFloat(clean.basic_salary) : null,
              allowance:     clean.allowance ? parseFloat(clean.allowance) : null,
              joining_date:  joiningDate,
              status:        'Employee',
              reference_by:  clean.referred_by || null,
              reference_contact: clean.referred_contact || null,
              hired_from:    clean.is_supplier_hire === 'yes' ? 'Supplier' : 'Direct',
              supplier_name: clean.is_supplier_hire === 'yes' ? (clean.supplier_name || null) : null,
              rate_per_hour: clean.rate_per_hour ? parseFloat(clean.rate_per_hour) : null,
            };
            const { error: empErr } = await db.from('employees').insert(newEmp);
            if (empErr) {
              showToast('Saved hiring record but employee creation failed: ' + empErr.message, 'error');
            } else {
              // Also sync to contacts & trainings
              await db.from('employee_contacts').insert({ employee_number: nextId, full_name: newEmp.full_name });
              await db.from('employee_trainings').insert({ employee_id: nextId, full_name: newEmp.full_name, position: newEmp.position, training_records: '{}' });
              showToast('✅ ' + (clean.candidate_name||'Candidate') + ' joined! Employee ID ' + nextId + ' created automatically.');
              await db.from('hiring_pipeline').update({ status: 'Joined', temp_employee_id: nextId }).eq('id', rec.id);
            await loadAll(); setEditingHiring(null); return;
            }
          } else {
            await db.from('hiring_pipeline').update({ status: 'Joined', temp_employee_id: existing[0].employee_id || clean.temp_employee_id }).eq('id', rec.id);
            showToast('Employee record already exists for this candidate (ID: ' + (existing[0].employee_id||'?') + ')');
          }
        }

        await logAudit(user, 'hiring_pipeline', rec.id, clean.candidate_name, rec.id ? 'update' : 'create', 'Hiring/candidate record ' + (rec.id ? 'updated' : 'created'));
        await loadAll(); setEditingHiring(null); showToast('Hiring record saved');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      const saveHiringDoc = async (id, updates) => {
        try {

        // updates: { docKey: dataUrl, ... } or { manual_stage: ... } for stage moves
        const { data, error } = await db.from('hiring_pipeline').update(updates).eq('id', id).select();
        if (error) {
          if (isMissingManualStageError(error)) {
            throw new Error("The 'manual_stage' column doesn't exist in Supabase yet. Run this in your Supabase SQL Editor, then try again: ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS manual_stage text;");
          }
          throw new Error(error.message);
        }
        if (!data || data.length === 0) throw new Error('Update affected 0 rows — check Supabase RLS policy (WITH CHECK) on hiring_pipeline UPDATE.');
        await loadAll();
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      // ===== TEMP EMPLOYEE ID (assigned when Visa Processing starts) =====
      // Format: SA<n>T — same numbering pool as real employee_ids so it can be promoted by
      // simply dropping the "T" once the candidate joins. Checks both `employees` (real IDs
      // already issued) and `hiring_pipeline.temp_employee_id` (temp IDs already in flight for
      // candidates still mid-process) so two candidates never collide on the same number.
      const nextTempEmployeeId = async () => {
        const [{ data: empRows }, { data: hireRows }] = await Promise.all([
          db.from('employees').select('employee_id'),
          db.from('hiring_pipeline').select('temp_employee_id'),
        ]);
        let maxNum = 1000;
        (empRows || []).forEach(e => {
          const m = (e.employee_id || '').match(/SA(\d+)/i);
          if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
        });
        (hireRows || []).forEach(h => {
          const m = (h.temp_employee_id || '').match(/SA(\d+)T/i);
          if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
        });
        return 'SA' + (maxNum + 1) + 'T';
      };
      // Starts visa processing: moves the kanban card to "Visa Process Started" and assigns
      // a Temp Employee ID (if one isn't already set) so Finance can log a deposit/advance
      // against this candidate before they have a real employee_id. Deposit fields themselves
      // are filled in separately (optional, management's discretion) — this just unlocks the ID.
      const startVisaProcessing = async (rec) => {
        const patch = { manual_stage: 'visa_processing' };
        if (!rec.temp_employee_id) {
          patch.temp_employee_id = await nextTempEmployeeId();
        }
        await saveHiringDoc(rec.id, patch);
        return patch.temp_employee_id || rec.temp_employee_id;
      };
      // ===== MOVE BETWEEN HIRING PIPELINE <-> RESUME DATABASE =====
      // pipeline_location: 'pipeline' (default/active, counted in Total Active) or 'resume_db'
      // (archived/parked — On Hold, Not Suitable, or just stored for future use). Moving a
      // candidate is just flipping this flag; nothing is duplicated or re-entered. Moving back
      // INTO the pipeline resets the stage to "1 · New Resumes" and clears any prior interview
      // verdict (so the Decision tab isn't stuck showing the old Hold/Reject state) — the old
      // verdict is preserved as a dated note in Remarks instead of being lost.
      // Patch a single hiring record in local state without refetching everything —
      // used by HiringModal's immediate-save actions (visa step dates, scenario switch)
      // so that closing and reopening the same candidate shows the value that was just
      // saved, instead of the stale pre-edit copy still sitting in the `hiring` list.
      const onHiringRecordPatch = (patch) => {
        if (!patch || !patch.id) return;
        setHiring(prev => prev.map(r => r.id === patch.id ? { ...r, ...patch } : r));
      };
      const moveHiringLocation = async (id, location) => {
        try {

        const rec = hiring.find(h => h.id === id) || {};
        const patch = { pipeline_location: location };
        if (location === 'pipeline') {
          patch.manual_stage = 'resume';
          if (rec.interview_verdict) {
            const verdictLabel = rec.interview_verdict === 'selected' ? 'Selected' : rec.interview_verdict === 'onhold' ? 'On Hold' : 'Not Suitable';
            const note = `[Moved back from Resume Database ${new Date().toLocaleDateString('en-GB')}] Previous verdict: ${verdictLabel}${rec.verdict_reason ? ' — ' + rec.verdict_reason : ''}`;
            patch.remarks = rec.remarks ? `${rec.remarks}\n${note}` : note;
            patch.interview_verdict = null;
          }
        }
        const { data, error } = await db.from('hiring_pipeline').update(patch).eq('id', id).select();
        if (error) {
          if (isMissingColumnError(error, 'pipeline_location')) {
            throw new Error("The 'pipeline_location' column doesn't exist in Supabase yet. Run this in your Supabase SQL Editor, then try again: ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS pipeline_location text DEFAULT 'pipeline';");
          }
          throw new Error(error.message);
        }
        if (!data || data.length === 0) throw new Error('Update affected 0 rows — check Supabase RLS policy (WITH CHECK) on hiring_pipeline UPDATE.');
        await loadAll();
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };
      // Confirmation happens at the call site (so the dialog can name the candidate) —
      // deleteHiring itself just performs the delete.
      const deleteHiring = async (id) => {
        try {

        const rec = hiring.find(h => h.id === id);
        const mode = await softDeleteRow(user, 'hiring_pipeline', id, (rec && (rec.full_name || rec.candidate_name)));
        await loadAll(); showToast(mode === 'soft' ? 'Candidate moved to Recycle Bin' : 'Hiring record deleted');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };

      const syncAllContacts = async () => {
        if (!employees.length) return showToast('No employees found to sync', 'error');
        showToast('Syncing contacts...');
        // Fetch current state
        const { data: existingRows, error: fetchErr } = await db.from('employee_contacts').select('employee_number, id');
        if (fetchErr) return showToast('Fetch error: ' + fetchErr.message, 'error');
        const existingMap = {};
        (existingRows || []).forEach(r => { existingMap[r.employee_number] = r.id; });
        let created = 0, updated = 0, errors = 0;
        for (const emp of employees) {
          if (!emp.employee_id || !emp.full_name) continue;
          if (existingMap[emp.employee_id]) {
            // Update name only — don't overwrite phone/address fields
            const { error } = await db.from('employee_contacts')
              .update({ full_name: emp.full_name })
              .eq('id', existingMap[emp.employee_id]);
            if (error) errors++; else updated++;
          } else {
            const { error } = await db.from('employee_contacts')
              .insert({ employee_number: emp.employee_id, full_name: emp.full_name });
            if (error) errors++; else created++;
          }
        }
        await loadAll();
        if (errors > 0) showToast(errors + ' errors — check DB Setup SQL in Settings', 'error');
        else showToast('Contact Directory: ' + created + ' added, ' + updated + ' updated');
      };

      const syncAllMobDemob = async () => {
        if (!employees.length) return showToast('No employees found to sync', 'error');
        showToast('Syncing Mob/Demob...');
        // Fetch current state
        const { data: existingRows, error: fetchErr } = await db.from('mob_demob').select('employee_id, id');
        if (fetchErr) return showToast('Fetch error: ' + fetchErr.message, 'error');
        const existingMap = {};
        (existingRows || []).forEach(r => { existingMap[r.employee_id] = r.id; });
        let created = 0, updated = 0, errors = 0;
        for (const emp of employees) {
          if (!emp.employee_id || !emp.full_name) continue;
          if (existingMap[emp.employee_id]) {
            // Update name only
            const { error } = await db.from('mob_demob')
              .update({ full_name: emp.full_name })
              .eq('id', existingMap[emp.employee_id]);
            if (error) errors++; else updated++;
          } else {
            const { error } = await db.from('mob_demob')
              .insert({ employee_id: emp.employee_id, full_name: emp.full_name, position: emp.position || null, eid_no: emp.eid_no || null });
            if (error) errors++; else created++;
          }
        }
        await loadAll();
        if (errors > 0) showToast(errors + ' errors occurred during sync', 'error');
        else showToast('Mob/Demob: ' + created + ' added, ' + updated + ' updated');
      };

      const saveTraining = async (rec) => {
        try {

        const clean = {
          employee_id: rec.employee_id || null,
          full_name: rec.full_name || null,
          position: rec.position || null,
          cicpa_locations: rec.cicpa_locations || null,
          training_records: rec.training_records || null,
          notes: rec.notes || null,
        };
        if (rec.id) {
          const { error } = await db.from('employee_trainings').update(clean).eq('id', rec.id);
          if (error) return showToast(error.message, 'error');
        } else {
          const { error } = await db.from('employee_trainings').insert(clean);
          if (error) return showToast(error.message, 'error');
        }
        await logAudit(user, 'employee_trainings', rec.id, clean.full_name, rec.id ? 'update' : 'create', 'Training record ' + (rec.id ? 'updated' : 'created'));
        await loadAll(); showToast('Training record saved');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };

      const deleteTraining = async (id, empName) => {
        try {

        if (!window.confirm('Delete training record for ' + (empName || 'this employee') + '? It will be moved to the Recycle Bin for 30 days before being permanently removed.')) return;
        const mode = await softDeleteRow(user, 'employee_trainings', id, empName);
        await loadAll(); showToast(mode === 'soft' ? 'Training record moved to Recycle Bin' : 'Training record deleted');
      
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };

      const syncAllTrainings = async () => {
        if (!employees.length) return showToast('No employees found to sync', 'error');
        showToast('Syncing Training records...');
        const { data: existingRows, error: fetchErr } = await db.from('employee_trainings').select('employee_id, id, full_name, position, cicpa_locations');
        if (fetchErr) return showToast('Fetch error: ' + fetchErr.message, 'error');
        const existingMap = {};
        (existingRows || []).forEach(r => { existingMap[r.employee_id] = r; });
        let created = 0, updated = 0, errors = 0;
        for (const emp of employees) {
          if (!emp.employee_id || !emp.full_name) continue;
          if (existingMap[emp.employee_id]) {
            const { error } = await db.from('employee_trainings')
              .update({ full_name: emp.full_name, position: emp.position || null, cicpa_locations: emp.cicpa_locations || null })
              .eq('id', existingMap[emp.employee_id].id);
            if (error) errors++; else updated++;
          } else {
            const { error } = await db.from('employee_trainings')
              .insert({ employee_id: emp.employee_id, full_name: emp.full_name, position: emp.position || null, cicpa_locations: emp.cicpa_locations || null });
            if (error) errors++; else created++;
          }
        }
        await loadAll();
        if (errors > 0) showToast(errors + ' errors occurred during sync', 'error');
        else showToast('Training: ' + created + ' added, ' + updated + ' updated');
      };

      const deleteRecipient = async (id) => {
        try {
          const rec = recipients.find(r => r.id === id);
          const mode = await softDeleteRow(user, 'recipients', id, rec && (rec.name || rec.email));
          await loadAll();
          showToast(mode === 'soft' ? 'Recipient moved to Recycle Bin' : 'Recipient deleted');
        } catch (e) { showToast('❌ Unexpected error: ' + e.message, 'error'); }
      };

      // ===== Excel export — screen-aware =====
      const exportExcel = () => {
        const wb = XLSX.utils.book_new();
        const today = new Date().toISOString().slice(0,10);

        if (view === 'resume_db') {
          // Export Resume Database candidates
          const rows = resumeDbHiring.map(c => ({
            'Name': c.candidate_name || '',
            'Status': c.interview_verdict || 'Stored',
            'Position': c.position || '',
            'Experience (yrs)': c.experience || '',
            'Nationality': c.nationality || '',
            'Current Location': c.current_location || '',
            'Current Designation': c.current_designation || '',
            'Current Employer': c.current_employer || '',
            'Email': c.email || '',
            'Phone': c.phone || '',
            'Passport No': c.passport_no || '',
            'Passport Expiry': c.passport_expiry_candidate || '',
            'Skills': c.skills || '',
            'Work History': c.work_history || '',
            'Referred By': c.referred_by || '',
            'Verdict Reason': c.verdict_reason || '',
            'Added': c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '',
          }));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'Resume Database');
          XLSX.writeFile(wb, `SATCO_ResumeDB_${today}.xlsx`);
          showToast('✅ Resume Database exported to Excel');
          return;
        }

        if (view === 'job_vacancies') {
          // Job Vacancies view handles its own export — signal via custom event
          window.dispatchEvent(new CustomEvent('satco-export-job-vacancies'));
          return;
        }

        if (view === 'training') {
          // Export training records
          const rows = trainings.map(rec => {
            const row = { 'Emp ID': rec.employee_id, 'Full Name': rec.full_name, 'Position': rec.position || '', 'CICPA Locations': rec.cicpa_locations || '', 'Notes': rec.notes || '' };
            try {
              const p = JSON.parse(rec.training_records || '{}');
              ALL_STANDARD_TRAININGS.forEach(t => {
                const r = p[t.id] || {};
                row[t.label + ' — Status'] = r.status || '';
                row[t.label + ' — Course'] = r.courseName || '';
                row[t.label + ' — Issuer'] = r.issuingCompany || '';
                row[t.label + ' — Cert No'] = r.certNo || '';
                row[t.label + ' — Expiry'] = r.expiry ? fmtDateDisplay(r.expiry) : '';
              });
            } catch {}
            return row;
          });
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'Training');
          XLSX.writeFile(wb, `SATCO_Training_${today}.xlsx`);
          showToast('✅ Training records exported to Excel');
          return;
        }

        if (view === 'mobdemob') {
          const md = mobDemob.map(r => {
            const mob = r.mobilization_date ? new Date(r.mobilization_date) : null;
            const demob = r.demobilization_date ? new Date(r.demobilization_date) : null;
            const daysWorked = mob && demob ? Math.round((demob - mob) / 86400000) : mob ? Math.round((new Date() - mob) / 86400000) + ' (ongoing)' : '—';
            return { 'Employee ID': r.employee_id, 'Full Name': r.full_name, Position: r.position, 'EID NO': r.eid_no,
              'Mobilization Date': r.mobilization_date, 'Demobilization Date': r.demobilization_date || '',
              'Days Worked': daysWorked, Supply: r.supply, Location: r.location, Remarks: r.remarks };
          });
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(md.length ? md : [{}]), 'Mob-Demob');
          XLSX.writeFile(wb, `SATCO_MobDemob_${today}.xlsx`);
          showToast('✅ Mob/Demob exported to Excel');
          return;
        }

        if (view === 'hiring') {
          const rows = pipelineHiring.map(c => ({
            'Name': c.candidate_name || '', 'Position': c.position || '', 'Status': c.status || '', 'Step': c.step || '',
            'Nationality': c.nationality || '', 'Experience': c.experience || '', 'Email': c.email || '', 'Phone': c.phone || '',
            'Passport No': c.passport_no || '', 'Current Location': c.current_location || '', 'Scenario': c.hiring_scenario || '',
            'Skills': c.skills || '', 'Remarks': c.remarks || '',
          }));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'Hiring Pipeline');
          XLSX.writeFile(wb, `SATCO_HiringPipeline_${today}.xlsx`);
          showToast('✅ Hiring Pipeline exported to Excel');
          return;
        }

        // Default: employees + mob-demob (Employee Directory and other views)
        const rows = employees.map(e => { const r = {}; EMPLOYEE_FIELDS.forEach(f => r[f.label] = e[f.key] || ''); return r; });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Employees');
        const md = mobDemob.map(r => {
          const mob = r.mobilization_date ? new Date(r.mobilization_date) : null;
          const demob = r.demobilization_date ? new Date(r.demobilization_date) : null;
          const daysWorked = mob && demob ? Math.round((demob - mob) / 86400000) : mob ? Math.round((new Date() - mob) / 86400000) + ' (ongoing)' : '—';
          return { 'Employee ID': r.employee_id, 'Full Name': r.full_name, Position: r.position, 'EID NO': r.eid_no,
            'Mobilization Date': r.mobilization_date, 'Demobilization Date': r.demobilization_date || '',
            'Days Worked': daysWorked, Supply: r.supply, Location: r.location, Remarks: r.remarks };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(md), 'Mob-Demob');
        XLSX.writeFile(wb, `SATCO_Employees_${today}.xlsx`);
        showToast('✅ Exported to Excel');
      };

      // ===== Excel import =====
      const importExcel = async (file) => {
        try {
          const data = await file.arrayBuffer();
          const wb = XLSX.read(data, { cellDates: true });
          const sheetName = wb.SheetNames.find(n => /^employee/i.test(n)) || wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
          let headerRow = 0;
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const r = (rows[i] || []).map(c => String(c || '').toLowerCase());
            if (r.some(c => c.includes('employeeid') || c.includes('fullname') || c.includes('full name'))) { headerRow = i; break; }
          }
          const headers = (rows[headerRow] || []).map(h => String(h || '').trim());
          const colMap = {
            'employeeid':'employee_id','fullname':'full_name','visa trade':'visa_trade','department':'department',
            'nationality':'nationality','position':'position','work experiance':'work_experience','work experience':'work_experience',
            'joining date':'joining_date','basic salary':'basic_salary','allowance':'allowance','status':'status',
            'date of birth':'dob','passport no':'passport_no','passportexpiry':'passport_expiry','passport expiry':'passport_expiry',
            'eid no':'eid_no','eidhardcopyrecv date':'eid_hardcopy_recv','emiratesidexpiry':'eid_expiry','emirates id expiry':'eid_expiry',
            'visaexpiry':'visa_expiry','visa expiry':'visa_expiry','reference by':'reference_by','reference contact number':'reference_contact',
            'email':'email','india contact number':'india_contact','uae contact number':'uae_contact','location':'location',
            'passport handover':'passport_handover','mobile':'mobile','manageremail':'manager_email','manager email':'manager_email',
            'insurance id no':'insurance_id','insurance efective date':'insurance_effective','insurance effective date':'insurance_effective',
            'insuranceexpiry':'insurance_expiry','insurance expiry':'insurance_expiry',
            'cicpa':'cicpa_no','cicpa no':'cicpa_no','cicpa number':'cicpa_no','cicpa gate pass':'cicpa_no','cicpa gate pass no':'cicpa_no','gate pass no':'cicpa_no','gate pass':'cicpa_no',
            'cicpaexpiry':'cicpa_expiry','cicpa expiry':'cicpa_expiry','cicpa expiry date':'cicpa_expiry','gate pass expiry':'cicpa_expiry',
            'cicpa locations':'cicpa_locations','cicpa permitted locations':'cicpa_locations','permitted locations':'cicpa_locations','gate pass locations':'cicpa_locations','locations':'cicpa_locations',
            'iloe cert no':'iloe_cert_no','iloe certificate no':'iloe_cert_no','iloe no':'iloe_cert_no',
            'iloe inception':'iloe_inception','iloe inception date':'iloe_inception',
            'iloe expiry':'iloe_expiry','iloe expiry date':'iloe_expiry',
            'iloe premium':'iloe_premium','iloe premium aed':'iloe_premium',
          };
          const idxToCol = {};
          headers.forEach((h, i) => { const k = colMap[h.toLowerCase().replace(/\s+/g, ' ').trim()]; if (k) idxToCol[i] = k; });
          const dateFields = new Set(EMPLOYEE_FIELDS.filter(f => f.type === 'date').map(f => f.key));
          const numFields = new Set(EMPLOYEE_FIELDS.filter(f => f.type === 'number').map(f => f.key));
          const toUpsert = [];
          for (let i = headerRow + 1; i < rows.length; i++) {
            const row = rows[i] || []; if (!row.some(c => c != null && c !== '')) continue;
            const emp = {};
            row.forEach((val, idx) => {
              const col = idxToCol[idx]; if (!col || val == null || val === '') return;
              if (dateFields.has(col)) emp[col] = fmtDateISO(val) || null;
              else if (numFields.has(col)) emp[col] = parseFloat(val) || null;
              else emp[col] = String(val).trim();
            });
            if (emp.employee_id || emp.full_name) toUpsert.push(emp);
          }
          // Upsert by employee_id
          const withId = toUpsert.filter(e => e.employee_id);
          const withoutId = toUpsert.filter(e => !e.employee_id);
          if (withId.length) { const { error } = await db.from('employees').upsert(withId, { onConflict: 'employee_id' }); if (error) throw error; }
          if (withoutId.length) { const { error } = await db.from('employees').insert(withoutId); if (error) throw error; }
          await loadAll();
          showToast(`Imported ${toUpsert.length} employees`);
        } catch (e) { showToast('Import failed: ' + e.message, 'error'); }
      };

      const filteredEmps = useMemo(() => {
        let r = employees;
        if (search) { const s = search.toLowerCase(); r = r.filter(e => Object.values(e).some(v => String(v || '').toLowerCase().includes(s))); }
        if (statusFilter === 'employed_only') r = r.filter(e => e.employee_id && isStrictEmployed(e.status));
        else if (statusFilter === 'with_id') r = r.filter(e => e.employee_id);
        else if (statusFilter === 'pending') r = r.filter(e => !isStrictEmployed(e.status));
        return r;
      }, [employees, search, statusFilter]);

      // Hiring Pipeline vs Resume Database — same table, split by pipeline_location.
      // Anything not explicitly 'resume_db' (null, undefined, 'pipeline', or any legacy value)
      // is treated as active pipeline, so existing rows behave exactly as before until
      // someone deliberately moves them.
      const pipelineHiring = useMemo(() => hiring.filter(h => h.pipeline_location !== 'resume_db'), [hiring]);
      const resumeDbHiring  = useMemo(() => hiring.filter(h => h.pipeline_location === 'resume_db'), [hiring]);

      // Mobile nav state
      const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
      // Detect mobile viewport — matchMedia is reliable across all mobile browsers
      const [isMobile, setIsMobile] = React.useState(() => {
        try { return window.matchMedia('(max-width: 900px)').matches; } catch(e) { return false; }
      });
      React.useEffect(() => {
        let mq;
        try { mq = window.matchMedia('(max-width: 900px)'); } catch(e) { return; }
        const handler = (e) => setIsMobile(e.matches);
        setIsMobile(mq.matches); // re-check after mount
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else mq.addListener(handler);
        return () => {
          if (mq.removeEventListener) mq.removeEventListener('change', handler);
          else mq.removeListener(handler);
        };
      }, []);
      const [moreSheetOpen, setMoreSheetOpen] = React.useState(false);
      // Close more sheet when switching to desktop
      React.useEffect(() => { if (!isMobile) setMoreSheetOpen(false); }, [isMobile]);

      // SVG icons for mobile nav (inline, no emoji)
      const MOB_ICONS = {
        dashboard:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
        employees:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
        alerts:          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
        contacts:        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.4 19.79 19.79 0 0 1 1.61 4.82 2 2 0 0 1 3.6 2.61h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10.1a16 16 0 0 0 6 6l.9-.9a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
        mobdemob:        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
        training:        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
        hiring:          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
        resume_db:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
        job_vacancies:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
        sop_guides:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
        interview_sheet: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
        reports:         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
        recycle_bin:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
        activity_log:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
        settings:        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
        more:            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>,
        supplier_manpower: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="9" width="8" height="12" rx="1"/><path d="M9 21V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14"/><rect x="15" y="13" width="8" height="8" rx="1"/></svg>,
      };

      // Bottom tab bar — 5 pinned items
      const MOBILE_TABS = [
        { k:'dashboard',    l:'Home',    ic:'dashboard' },
        { k:'employees',    l:'Staff',   ic:'employees', badge: employees.length },
        { k:'alerts',       l:'Alerts',  ic:'alerts',    red: alerts.some(a=>a.severity==='expired'||a.severity==='critical'), badge: alerts.filter(a=>a.severity==='expired'||a.severity==='critical').length },
        { k:'hiring',       l:'Hiring',  ic:'hiring',    badge: pipelineHiring.filter(h=>h.status!=='Joined'&&h.status!=='Withdrawn').length },
        { k:'job_vacancies',l:'Jobs',    ic:'job_vacancies' },
      ];

      // More sheet items (all remaining nav items)
      const MORE_ITEMS = [
        { k:'contacts',        l:'Contacts',   ic:'contacts',        badge: contacts.length },
        { k:'mobdemob',        l:'Mob/Demob',  ic:'mobdemob',        badge: mobDemob.length },
        { k:'training',        l:'Training',   ic:'training',        badge: trainings.length },
        { k:'resume_db',       l:'Resume DB',  ic:'resume_db',       badge: resumeDbHiring.length },
        { k:'sop_guides',      l:'Guides',     ic:'sop_guides' },
        { k:'interview_sheet', l:'Interview',  ic:'interview_sheet' },
        { k:'reports',         l:'Reports',    ic:'reports' },
        { k:'recycle_bin',     l:'Recycle Bin',ic:'recycle_bin' },
        { k:'activity_log',    l:'Activity Log',ic:'activity_log' },
        { k:'settings',        l:'Settings',   ic:'settings' },
        { k:'supplier_manpower', l:'Suppliers', ic:'supplier_manpower', badge: supplierManpowerCount, red: supplierLicenseAlertCount > 0 },
      ];

      const PAGE_NAV_ITEMS = [
        { k:'dashboard',      l:'Dashboard' },
        { k:'employees',      l:'Staff' },
        { k:'alerts',         l:'Alerts' },
        { k:'contacts',       l:'Contacts' },
        { k:'mobdemob',       l:'Mob/Demob' },
        { k:'training',       l:'Training' },
        { k:'hiring',         l:'Hiring' },
        { k:'resume_db',      l:'Resume DB' },
        { k:'job_vacancies',  l:'Jobs' },
        { k:'sop_guides',     l:'Guides' },
        { k:'interview_sheet',l:'Interview' },
        { k:'reports',        l:'Reports' },
        { k:'recycle_bin',    l:'Recycle Bin' },
        { k:'activity_log',   l:'Activity Log' },
        { k:'settings',       l:'Settings' },
        { k:'supplier_manpower', l:'Supplier Manpower' },
      ];


      const viewLabels = { dashboard:'Dashboard', employees:'All Employees', alerts:'Expiry Alerts', contacts:'Contact Directory', mobdemob:'Mob / Demob', training:'Training', hiring:'Hiring Pipeline', resume_db:'Resume Database', job_vacancies:'Job Vacancies', sop_guides:'Workflow Guides', interview_sheet:'Interview Sheet', reports:'Reports & Email', recycle_bin:'Recycle Bin', activity_log:'Activity Log', settings:'Settings', supplier_manpower:'Supplier Manpower' };

      if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:'16px' }}><div className="spinner"></div><div style={{ color:'#64748b' }}>Loading your HR data…</div></div>;

      return (
        <div className={darkMode?'satco-dark-mode':''} style={{display:'flex',height:'100vh',overflow:'hidden',background:darkMode?'#07111f':'#f6f7f9'}}>
          <div style={{width:'240px',background:darkMode?'#0a1628':'#111d2e',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto',height:'100vh'}}>
            <div style={{display:'flex',alignItems:'center',gap:'9px',padding:'16px 14px 12px',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
              <div style={{width:32,height:32,background:'#c9a227',borderRadius:'7px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontWeight:800,fontSize:'12px',color:'#111d2e'}}>SA</div>
              <span style={{color:'#fff',fontSize:'14px',fontWeight:700}}>SATCO HR</span>
            </div>
            {[
              {section:'Main'},
              {k:'dashboard',l:'Dashboard',ico:'D',badge:null},
              {k:'employees',l:'Staff',ico:'St',badge:()=>employees.length},
              {k:'contacts',l:'Contacts',ico:'Co',badge:()=>contacts.length},
              {k:'mobdemob',l:'Mob / Demob',ico:'Mb',badge:()=>mobDemob.length},
              {k:'training',l:'Training',ico:'Tr',badge:()=>trainings.length},
              {section:'Hiring'},
              {k:'hiring',l:'Hiring',ico:'Hi',badge:()=>pipelineHiring.filter(h=>h.status!=='Joined'&&h.status!=='Withdrawn').length},
              {k:'resume_db',l:'Resume DB',ico:'RD',badge:()=>resumeDbHiring.length},
              {k:'job_vacancies',l:'Jobs',ico:'Jo',badge:null},
              {k:'interview_sheet',l:'Interview',ico:'In',badge:null},
              {section:'System'},
              {k:'alerts',l:'Alerts',ico:'Al',badge:()=>alerts.length,red:()=>alerts.some(a=>a.severity==='expired'||a.severity==='critical')},
              {k:'sop_guides',l:'Guides',ico:'Gu',badge:null},
              {k:'reports',l:'Reports',ico:'Re',badge:null},
              {k:'recycle_bin',l:'Recycle Bin',ico:'Rb',badge:null},
              {k:'activity_log',l:'Activity Log',ico:'Ac',badge:null},
              {k:'settings',l:'Settings',ico:'Se',badge:null},
              {k:'supplier_manpower',l:'Suppliers',ico:'Su',badge:()=>supplierManpowerCount,red:()=>supplierLicenseAlertCount>0},
            ].map((item,idx)=>{
              if(item.section) return <div key={idx} style={{padding:'12px 12px 3px',fontSize:'9px',fontWeight:700,color:'rgba(255,255,255,0.28)',letterSpacing:'1.2px',textTransform:'uppercase'}}>{item.section}</div>;
              const active=view===item.k;
              const badge=typeof item.badge==='function'?item.badge():item.badge;
              const isRed=typeof item.red==='function'?item.red():false;
              return (
                <button key={item.k} onClick={()=>{setView(item.k);if(item.k!=='mobdemob')setSelectedMobEmp(null);}}
                  style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px',margin:'1px 7px',borderRadius:'6px',cursor:'pointer',color:active?'#fff':isRed?'#fca5a5':'rgba(255,255,255,0.55)',fontSize:'12px',fontFamily:'inherit',background:active?(darkMode?'#1e3a5f':'#1e3358'):'transparent',border:'none',width:'calc(100% - 14px)',textAlign:'left'}}>
                  <span style={{fontSize:'11px',width:'22px',textAlign:'center',flexShrink:0,opacity:0.7}}>{item.ico}</span>
                  <span style={{flex:1}}>{item.l}</span>
                  {badge>0&&<span style={{marginLeft:'auto',background:isRed?'#dc2626':'#c9a227',color:isRed?'#fff':'#111d2e',fontSize:'9px',fontWeight:800,padding:'2px 6px',borderRadius:'12px',minWidth:'20px',textAlign:'center'}}>{badge>99?'99+':badge}</span>}
                </button>
              );
            })}
            <div style={{marginTop:'auto',padding:'12px 14px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:'6px',fontSize:'11px',color:'rgba(255,255,255,0.3)',flexShrink:0}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',flexShrink:0}}></div>
              <span>{employees.filter(e=>e.status==='active').length} active employees</span>
            </div>
          </div>
          <div style={{flex:1,display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 22px',background:darkMode?'#0f1f38':'#fff',borderBottom:darkMode?'1px solid rgba(255,255,255,0.08)':'1px solid #e8eaf0',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'baseline',gap:'7px'}}>
                <h1 style={{margin:0,fontSize:'18px',fontWeight:700,color:darkMode?'#fff':'#111d2e'}}>{({dashboard:'Dashboard',employees:'Staff',alerts:'Alerts',contacts:'Contacts',mobdemob:'Mob / Demob',training:'Training',hiring:'Hiring',resume_db:'Resume DB',job_vacancies:'Jobs',sop_guides:'Guides',interview_sheet:'Interview',reports:'Reports',recycle_bin:'Recycle Bin',activity_log:'Activity Log',settings:'Settings',supplier_manpower:'Suppliers'})[view]||'Dashboard'}</h1>
                <span style={{fontSize:'12px',color:darkMode?'rgba(255,255,255,0.4)':'#888'}}><LiveClock /></span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <label style={{display:'flex',alignItems:'center',gap:'5px',background:'#059669',border:'none',color:'#fff',padding:'7px 14px',borderRadius:'7px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>Import<input type='file' accept='.xlsx,.xls' style={{display:'none'}} onChange={e=>e.target.files[0]&&importExcel(e.target.files[0])} /></label>
                <button onClick={exportExcel} style={{background:'#475569',border:'none',color:'#fff',padding:'7px 14px',borderRadius:'7px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>Export</button>
                <div onClick={()=>setDarkMode(d=>!d)} style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',userSelect:'none'}}>
                  <span style={{fontSize:'12px',color:darkMode?'#94a3b8':'#475569',fontWeight:600}}>Dark mode</span>
                  <div className={`dm-toggle-track${darkMode?' on':''}`}><div className='dm-toggle-thumb' /></div>
                </div>
                <button onClick={onLogout} style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#b91c1c',padding:'6px 12px',borderRadius:'7px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>Sign Out</button>
              </div>
            </div>
            <main style={{flex:1,overflowY:'auto',padding:'18px 22px'}} className='hr-content-area'>
            {view === 'dashboard' && <Dashboard stats={stats} dashboardEmployees={dashboardEmployees} allEmployees={employees} alerts={alerts} thresholds={thresholds} dashFilter={dashFilter} setDashFilter={setDashFilter} onJump={setView} hiring={hiring} />}
            {view === 'employees' && <EmployeeList employees={filteredEmps} total={employees.length} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} thresholds={thresholds} onEdit={(emp) => { const tr = trainings.find(t=>t.employee_id===emp.employee_id); setEditingEmp(tr ? {...emp, _trainings:tr} : emp); }} onDelete={deleteEmployee} onAdd={() => setEditingEmp({})} showToast={showToast} onQuickSave={saveEmployee} />}
            {view === 'alerts' && <AlertsView alerts={alerts} thresholds={thresholds} dashboardEmployees={allActiveEmployees} />}
            {view === 'contacts' && <ContactsView contacts={contacts} employees={employees} onAdd={() => setEditingContact({})} onEdit={setEditingContact} onDelete={deleteContact} onSyncAll={syncAllContacts} />}
            {view === 'mobdemob' && <MobDemobView records={mobDemob} employees={employees} onAdd={(prefill) => setEditingMob(prefill||{})} onEdit={setEditingMob} onDelete={deleteMob} onSyncAll={syncAllMobDemob} onRedeploy={redeployMob} selectedMobEmp={selectedMobEmp} setSelectedMobEmp={setSelectedMobEmp} />}
            {view === 'training' && <TrainingView records={trainings} employees={employees} onSave={saveTraining} onDelete={deleteTraining} onSyncAll={syncAllTrainings} showToast={showToast} loadAll={loadAll} />}
            {view === 'hiring' && <HiringView records={pipelineHiring} crossRecords={resumeDbHiring} onAdd={() => setEditingHiring({})} onEdit={setEditingHiring} onDelete={deleteHiring} onSaveDoc={saveHiringDoc} onStartVisaProcessing={startVisaProcessing} onMoveLocation={moveHiringLocation} showToast={showToast} onOpenSheet={setInterviewSheetCandidate} />}
            {view === 'resume_db' && <ResumeDatabaseView records={resumeDbHiring} crossRecords={pipelineHiring} onAdd={() => setEditingHiring({ pipeline_location:'resume_db' })} onEdit={setEditingHiring} onDelete={deleteHiring} onMoveLocation={moveHiringLocation} showToast={showToast} db={db} />}
            {view === 'sop_guides' && <SopGuidesView />}
            {view === 'job_vacancies' && <JobVacanciesView showToast={showToast} db={db} user={user} />}
            {view === 'interview_sheet' && <InterviewSheetView hiring={hiring} showToast={showToast} onOpenSheet={setInterviewSheetCandidate} />}
            {view === 'reports' && <ReportsView alerts={alerts} dashboardEmployees={allActiveEmployees} recipients={recipients} />}
            {view === 'recycle_bin' && <RecycleBinView user={user} showToast={showToast} />}
            {view === 'activity_log' && <ActivityLogView />}
            {view === 'settings' && <SettingsView thresholds={thresholds} setThresholds={setThresholds} recipients={recipients} onAddRecipient={saveRecipient} onDeleteRecipient={deleteRecipient} employeeCount={employees.length} />}
            {view === 'supplier_manpower' && <SupplierManpowerView user={user} showToast={showToast} />}
            </main>
          </div>
          {editingEmp && <EmployeeModal employee={editingEmp} onSave={saveEmployee} onClose={() => setEditingEmp(null)} showToast={showToast} />}
          {editingMob && <MobDemobModal record={editingMob} employees={employees} onSave={saveMob} onClose={() => setEditingMob(null)} showToast={showToast} />}
          {editingContact && <ContactModal record={editingContact} employees={employees} onSave={saveContact} onClose={() => setEditingContact(null)} showToast={showToast} />}
          {editingHiring && <HiringModal record={editingHiring} onSave={saveHiring} onDelete={deleteHiring} onClose={() => setEditingHiring(null)} showToast={showToast} onOpenSheet={setInterviewSheetCandidate} onMoveLocation={moveHiringLocation} onHiringUpdate={onHiringRecordPatch} onStartVisaProcessing={startVisaProcessing} />}
          {interviewSheetCandidate !== null && <InterviewSheetOverlay candidate={interviewSheetCandidate} onClose={() => { setInterviewSheetCandidate(null); loadAll(); }} showToast={showToast}
            onReload={() => loadAll()}
            onHiringUpdate={(patch) => { if (patch && patch.id) setHiring(prev => prev.map(r => r.id === patch.id ? {...r, ...patch} : r)); }}
            onAfterSave={(patch) => {
              if (patch && patch.id) setHiring(prev => prev.map(r => r.id === patch.id ? {...r, ...patch} : r));
              setInterviewSheetCandidate(prev => ({...prev, ...patch}));
            }} />}
          {toast && <div style={{ position:'fixed', bottom:'24px', right:'24px', background: toast.type==='error' ? '#dc2626' : '#0f172a', color:'#fff', padding:'12px 20px', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.25)', animation:'slideIn 0.2s', fontSize:'13px', zIndex:300 }}>{splitLeadingEmoji(toast.msg).text}</div>}
        </div>
      );
    }
    function Dashboard({ stats, dashboardEmployees, allEmployees, alerts, thresholds, dashFilter, setDashFilter, onJump, hiring }) {
      const natCounts = useMemo(() => { const m={}; dashboardEmployees.forEach(e=>{const d=e.nationality||'Unknown'; m[d]=(m[d]||0)+1;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8); }, [dashboardEmployees]);
      const travelling = useMemo(() => {
        if (!hiring) return [];
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1); yesterday.setHours(0,0,0,0);
        return hiring.filter(c=>c.ticket_depart_datetime&&!c.deleted_at&&new Date(c.ticket_depart_datetime)>=yesterday).sort((a,b)=>new Date(a.ticket_depart_datetime)-new Date(b.ticket_depart_datetime));
      }, [hiring]);
      const activePipeline = useMemo(() => { if (!hiring) return []; return hiring.filter(h=>h.pipeline_location!=='resume_db'&&h.status!=='Joined'&&h.status!=='Withdrawn').slice(0,6); }, [hiring]);
      const fmtDT = (dtStr,mode) => { if(!dtStr) return '—'; const d=new Date(dtStr); if(mode==='time') return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'}); return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'}); };
      const daysUntil = (dtStr) => { if(!dtStr) return null; return Math.ceil((new Date(dtStr.split('T')[0])-new Date(new Date().toISOString().split('T')[0]))/86400000); };
      const initials = (name) => (name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
      const stageColor = (s) => { if(!s) return {bg:'#fef3c7',c:'#92400e'}; const sl=s.toLowerCase(); if(sl.includes('visa')) return {bg:'#eef3ff',c:'#3b5bdb'}; if(sl.includes('offer')) return {bg:'#f0fdf4',c:'#166534'}; if(sl.includes('travel')) return {bg:'#ecfdf5',c:'#065f46'}; if(sl.includes('arrived')||sl.includes('join')) return {bg:'#eff6ff',c:'#1d4ed8'}; return {bg:'#fef3c7',c:'#92400e'}; };
      const todayISO = new Date().toISOString().split('T')[0];
      const flagMap = {'India':'🇮🇳','Pakistan':'🇵🇰','Philippines':'🇵🇭','Egypt':'🇪🇬','Bangladesh':'🇧🇩','Nepal':'🇳🇵','Sri Lanka':'🇱🇰','UAE':'🇦🇪','Kenya':'🇰🇪','Ghana':'🇬🇭'};
      const cS = {background:'#fff',border:'1px solid var(--bd1)',borderRadius:'10px',overflow:'hidden'};
      const hS = {display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:'1px solid #f0f2f5'};
      if (allEmployees.length===0) return <div style={{background:'#fff',border:'1px solid var(--bd1)',borderRadius:'12px',padding:'60px',textAlign:'center'}}><h2 style={{margin:'0 0 8px'}}>No employees yet</h2><p style={{color:'#64748b'}}>Click <strong>Import</strong> top-right to load your data.</p></div>;
      return (
        <div>
          <div className="dash-kpi-grid" style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:'9px',marginBottom:'14px'}}>
            <Kpi label="Active Employees" value={stats.total} color="#059669" icon="✅" />
            <Kpi label="Departments" value={stats.departments} color="#2563eb" icon="🏢" />
            <Kpi label="Passport Expiring" value={stats.passportCount} color="#dc2626" icon="📕" alert={stats.passportCount>0} sub={stats.passportExpired>0?`${stats.passportExpired} expired`:`≤${thresholds.passport}d`} onClick={()=>onJump('alerts')} />
            <Kpi label="Emirates ID Expiring" value={stats.eidCount} color="#ea580c" icon="🪪" alert={stats.eidCount>0} sub={stats.eidExpired>0?`${stats.eidExpired} expired`:`≤${thresholds.eid}d`} onClick={()=>onJump('alerts')} />
            <Kpi label="CICPA Expiring" value={stats.cicpaCount} color="#7c3aed" icon="🛢️" alert={stats.cicpaCount>0} sub={stats.cicpaExpired>0?`${stats.cicpaExpired} expired`:`≤${thresholds.cicpa}d`} onClick={()=>onJump('alerts')} />
            <Kpi label="Training Expiring" value={stats.trainingCertCount} color="#0f766e" icon="🎓" alert={stats.trainingCertCount>0} sub={stats.trainingCertExpired>0?`${stats.trainingCertExpired} expired`:`≤${thresholds.training_cert||30}d`} onClick={()=>onJump('alerts')} />
            <Kpi label="Expired Docs" value={stats.expired} color="#dc2626" icon="⚠️" alert={stats.expired>0} onClick={()=>onJump('alerts')} />
            <Kpi label="Critical ≤7d" value={stats.critical} color="#ea580c" icon="🔴" alert={stats.critical>0} onClick={()=>onJump('alerts')} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'13px',marginBottom:'14px'}}>
            <div style={cS}>
              <div style={hS}><span style={{fontWeight:700,fontSize:'13px'}}>✈️ Candidates Travelling</span><span style={{fontSize:'11px',color:'#888',background:'#f6f7f9',padding:'3px 9px',borderRadius:'16px'}}>{travelling.length} candidate{travelling.length!==1?'s':''}</span></div>
              {travelling.length===0 ? <div style={{padding:'28px',textAlign:'center',color:'#94a3b8',fontSize:'12px'}}>No upcoming flights booked</div> :
                <div style={{padding:'4px 0 0'}}>{travelling.map((c,i)=>{
                  const days=daysUntil(c.ticket_depart_datetime);
                  let pill='',pBg='#f6f7f9',pC='#5a6272';
                  if(days===0){pill='Departing today';pBg='#fef3c7';pC='#92400e';}
                  else if(days===1){pill='Tomorrow';pBg='#fff8e6';pC='#8a5e00';}
                  else if(days>0){pill='In '+days+' day'+(days!==1?'s':'');pBg='#eff6ff';pC='#1d4ed8';}
                  else{pill='Departed';}
                  const fC=c.ticket_from_city||'—',fA=c.ticket_from_airport||'',fT=c.ticket_from_terminal||'';
                  const tC=c.ticket_to_city||'—',tA=c.ticket_to_airport||'',tT=c.ticket_to_terminal||'';
                  const fno=c.ticket_flight_no||'—',pnr=c.ticket_pnr||'',air=c.ticket_airline||'',seat=c.ticket_seat||'',cls=c.ticket_class||'';
                  return <div key={c.id||i} style={{border:'1px solid #e8eaf0',borderRadius:'8px',margin:'0 14px 10px',overflow:'hidden'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 13px',background:'#f8f9fb',borderBottom:'1px solid #e8eaf0'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:26,height:26,borderRadius:'50%',background:'#1a2f4e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:800,color:'#c9a227',flexShrink:0}}>{initials(c.candidate_name)}</div>
                        <div><div style={{fontSize:'12px',fontWeight:700}}>{c.candidate_name||'—'}</div><div style={{fontSize:'10px',color:'#888'}}>{c.position||''}{c.nationality?' · '+c.nationality:''}</div></div>
                      </div>
                      <span style={{fontSize:'10px',fontWeight:700,padding:'3px 9px',borderRadius:'14px',background:pBg,color:pC}}>{pill}</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',padding:'9px 13px'}}>
                      <div>
                        <div style={{fontSize:'17px',fontWeight:800,lineHeight:1}}>{fmtDT(c.ticket_depart_datetime,'time')}</div>
                        <div style={{fontSize:'10px',color:'#888',marginTop:1}}>{fmtDT(c.ticket_depart_datetime,'date')}</div>
                        <div style={{fontSize:'11px',fontWeight:700,color:'#1a2f4e',marginTop:3}}>{fC}{fA?' ('+fA+')':''}</div>
                        {fT&&<div style={{fontSize:'10px',color:'#888'}}>Terminal {fT}</div>}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'0 10px'}}>
                        <span style={{fontSize:'10px',fontWeight:800,background:'#f0f4ff',padding:'2px 8px',borderRadius:'14px',border:'1px solid #dce4ff'}}>✈ {fno}</span>
                        <div style={{display:'flex',alignItems:'center',width:60}}><div style={{flex:1,height:1,background:'#e8eaf0'}}></div><span style={{fontSize:11,padding:'0 3px',color:'#1a2f4e'}}>›</span><div style={{flex:1,height:1,background:'#e8eaf0'}}></div></div>
                        {pnr&&<div style={{fontSize:'9px',color:'#888'}}>PNR: {pnr}</div>}
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:'17px',fontWeight:800,lineHeight:1}}>{fmtDT(c.ticket_arrive_datetime,'time')}</div>
                        <div style={{fontSize:'10px',color:'#888',marginTop:1}}>{fmtDT(c.ticket_arrive_datetime,'date')}</div>
                        <div style={{fontSize:'11px',fontWeight:700,color:'#1a2f4e',marginTop:3}}>{tC}{tA?' ('+tA+')':''}</div>
                        {tT&&<div style={{fontSize:'10px',color:'#888'}}>Terminal {tT}</div>}
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:11,padding:'5px 13px 7px',borderTop:'1px solid #f0f2f5',background:'#fafbfc',flexWrap:'wrap'}}>
                      {air&&<span style={{fontSize:'10px',color:'#888'}}>✈ <strong>{air}</strong></span>}
                      {seat&&<span style={{fontSize:'10px',color:'#888'}}>💺 Seat <strong>{seat}</strong></span>}
                      {cls&&<span style={{fontSize:'10px',color:'#888'}}>🎫 <strong>{cls}</strong></span>}
                      {tT&&<span style={{fontSize:'10px',color:'#888'}}>🛬 Arrival terminal <strong>{tT}</strong></span>}
                      {pnr&&<span style={{fontSize:'10px',color:'#888'}}>🔖 PNR <strong>{pnr}</strong></span>}
                    </div>
                  </div>;
                })}</div>
              }
            </div>
            <div style={cS}>
              <div style={hS}><span style={{fontWeight:700,fontSize:'13px'}}>⚠️ Upcoming Expirations</span><button onClick={()=>onJump('alerts')} style={S.link}>View all →</button></div>
              {alerts.length===0 ? <div style={{padding:'28px',textAlign:'center',color:'#94a3b8',fontSize:'12px'}}><EmojiIcon e="✓" /> No upcoming expirations</div> :
                alerts.slice(0,6).map((a,i)=>{
                  const col=a.severity==='expired'?'#dc2626':a.severity==='critical'?'#ea580c':a.severity==='urgent'?'#ca8a04':'#0891b2';
                  const bg=a.severity==='expired'||a.severity==='critical'?'#fdecea':a.severity==='urgent'?'#fff8e6':'#eff6ff';
                  const fc=a.severity==='expired'||a.severity==='critical'?'#b91c1c':a.severity==='urgent'?'#8a5e00':'#1d4ed8';
                  return <div key={i} style={{display:'flex',alignItems:'flex-start',gap:9,padding:'9px 16px',borderBottom:'1px solid #f8f9fb'}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:col,flexShrink:0,marginTop:4}}></div>
                    <div style={{flex:1}}><div style={{fontSize:'12px',fontWeight:600}}>{a.full_name||'(no name)'} — {a.typeLabel}</div><div style={{fontSize:'10px',color:'#888',marginTop:1}}>{a.employee_id} · expires {fmtDateDisplay(a.expiryDate)}</div></div>
                    <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'8px',background:bg,color:fc,flexShrink:0}}>{a.daysLeft<0?Math.abs(a.daysLeft)+'d ago':a.daysLeft+'d'}</span>
                  </div>;
                })
              }
            </div>
          </div>
          <div style={{...cS,marginBottom:'14px'}}>
            <div style={hS}><span style={{fontWeight:700,fontSize:'13px'}}>🏢 Workforce Overview</span><span style={{fontSize:'11px',color:'#888',background:'#f6f7f9',padding:'3px 9px',borderRadius:'16px'}}>Showing {dashboardEmployees.length} of {allEmployees.length} employees</span></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',padding:'10px 16px 9px',borderBottom:'1px solid #f0f2f5'}}>
              {[['Active',dashboardEmployees.length,false],['Depts',stats.departments,false],['Passport exp.',stats.passportCount,stats.passportCount>0],['Emirates ID exp.',stats.eidCount,stats.eidCount>0],['CICPA exp.',stats.cicpaCount,stats.cicpaCount>0],['Training exp.',stats.trainingCertCount,stats.trainingCertCount>0],['Expired docs',stats.expired,stats.expired>0],['Critical ≤7d',stats.critical,stats.critical>0]].map(([lbl,val,alert],i)=>(
                <div key={lbl} style={{textAlign:'center',padding:'0 2px',borderLeft:i>0?'1px solid #f0f2f5':'none'}}>
                  <div style={{fontSize:'8px',fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>{lbl}</div>
                  <div style={{fontSize:'16px',fontWeight:700,color:alert?'#dc2626':'#111d2e'}}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'140px 44px 1fr 175px 55px',alignItems:'center',gap:11,padding:'8px 16px',background:'#f8f9fb',borderBottom:'1px solid #f0f2f5',fontSize:'8px',fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.4px'}}>
              <span>Nationality</span><span style={{textAlign:'center'}}>Staff</span><span>Doc coverage</span><span>Status</span><span style={{textAlign:'right'}}>Docs</span>
            </div>
            {natCounts.length===0 ? <div style={{padding:'20px',textAlign:'center',color:'#94a3b8',fontSize:'12px'}}>No staff data.</div> :
              natCounts.map(([nat,cnt],i)=>{
                const maxCnt=natCounts[0]?.[1]||1;
                const empsByNat=dashboardEmployees.filter(e=>(e.nationality||'Unknown')===nat);
                let expiring=0,expired=0;
                empsByNat.forEach(emp=>['passport_expiry','eid_expiry','cicpa_expiry','visa_expiry'].forEach(k=>{const d=emp[k];if(!d)return;if(d<=todayISO)expired++;else expiring++;}));
                const barColor=expired>0?'#ef4444':expiring>0?'#f59e0b':'#22c55e';
                let badge,bBg,bC,bBd;
                if(expired>0){badge='🔴 '+expired+' expired';bBg='#fdecea';bC='#b91c1c';bBd='#f5a5a5';}
                else if(expiring>0){badge='⚠️ Expiring soon';bBg='#fff8e6';bC='#8a5e00';bBd='#f5d47a';}
                else{badge='✅ No upcoming expirations';bBg='#eaf6f0';bC='#1a7a4a';bBd='#a3d9be';}
                return <div key={nat} style={{display:'grid',gridTemplateColumns:'140px 44px 1fr 175px 55px',alignItems:'center',gap:11,padding:'8px 16px',borderBottom:i<natCounts.length-1?'1px solid #f8f9fb':'none'}}>
                  <div style={{fontSize:'12px',fontWeight:700,display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:'15px'}}>{flagMap[nat]||'🌍'}</span>{nat}</div>
                  <div style={{fontSize:'12px',fontWeight:700,textAlign:'center'}}>{cnt}</div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{flex:1,height:4,background:'#f0f2f5',borderRadius:3}}><div style={{width:Math.round(cnt/maxCnt*100)+'%',height:'100%',background:barColor,borderRadius:3}}></div></div></div>
                  <div><span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:'14px',fontSize:'10px',fontWeight:600,background:bBg,color:bC,border:'1px solid '+bBd}}>{badge}</span></div>
                  <div style={{fontSize:'10px',color:'#888',textAlign:'right'}}>{expiring+expired}</div>
                </div>;
              })
            }
            <div style={{fontSize:'10px',color:'#888',padding:'6px 16px',borderTop:'1px solid #f6f7f9'}}>🕐 Last updated: {new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'13px'}}>
            <div style={cS}>
              <div style={hS}><span style={{fontWeight:700,fontSize:'13px'}}>🌍 By Nationality</span></div>
              <div style={{padding:'12px 16px'}}>{natCounts.map(([d,c])=><Bar key={d} label={d} value={c} max={natCounts[0]?.[1]||1} color="#059669" />)}</div>
            </div>
            <div style={cS}>
              <div style={hS}><span style={{fontWeight:700,fontSize:'13px'}}>🧑‍💼 Hiring Pipeline</span><button onClick={()=>onJump('hiring')} style={S.link}>View all →</button></div>
              {activePipeline.length===0 ? <div style={{padding:'20px',textAlign:'center',color:'#94a3b8',fontSize:'12px'}}>No active candidates</div> :
                activePipeline.map((c,i)=>{
                  const stage=c.manual_stage||c.step||'';
                  const stageLbl=stage.replace(/_/g,' ').replace(/\w/g,x=>x.toUpperCase())||'In pipeline';
                  const {bg,c:sc}=stageColor(stage);
                  return <div key={c.id||i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',borderBottom:i<activePipeline.length-1?'1px solid #f8f9fb':'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:'#1a2f4e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:800,color:'#c9a227',flexShrink:0}}>{initials(c.candidate_name)}</div>
                      <div><div style={{fontSize:'12px',fontWeight:600}}>{c.candidate_name||'—'}</div><div style={{fontSize:'10px',color:'#888'}}>{c.position||''}</div></div>
                    </div>
                    <span style={{fontSize:'10px',fontWeight:600,padding:'2px 8px',borderRadius:'8px',background:bg,color:sc,flexShrink:0}}>{stageLbl}</span>
                  </div>;
                })
              }
            </div>
          </div>
        </div>
      );
    }
    function Kpi({ label, value, color, icon, alert, onClick, sub }) {
      return <div className="hr-card" onClick={onClick} style={{ background:'#fff', border:'1px solid var(--bd1)', borderLeft: alert?`3px solid ${color}`:'1px solid #e2e8f0', borderRadius:'12px', padding:'14px', cursor:onClick?'pointer':'default' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}><div style={{ fontSize:'11.5px', color:'#64748b', fontWeight:600, lineHeight:1.25 }}>{label}</div><div><EmojiIcon e={icon} size={17} /></div></div>
        <div style={{ fontSize:'26px', fontWeight:700, lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:'10.5px', color: alert?color:'#94a3b8', fontWeight:600, marginTop:'4px' }}>{sub}</div>}
      </div>;
    }
    function Bar({ label, value, max, color }) {
      return <div style={{ marginBottom:'8px' }}><div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'3px' }}><span style={{ color:'#475569' }}>{label}</span><span style={{ fontWeight:600 }}>{value}</span></div><div style={{ height:'5px', background:'#f1f5f9', borderRadius:'3px' }}><div style={{ width:`${max>0?(value/max)*100:0}%`, height:'100%', background:color, borderRadius:'3px' }}></div></div></div>;
    }

    // ============ EMPLOYEE LIST ============
    function EmployeeList({ employees, total, search, setSearch, statusFilter, setStatusFilter, thresholds, onEdit, onDelete, onAdd, showToast, onQuickSave }) {
      // Compute missing-data summary across all employees
      const missingStats = useMemo(() => {
        const counts = { passport: 0, eid: 0, visa: 0, insurance: 0, iloe: 0 };
        const empsMissing = new Set();
        employees.forEach(emp => {
          let hasMissing = false;
          if (!emp.passport_expiry) { counts.passport++; hasMissing = true; }
          if (!emp.eid_expiry)      { counts.eid++;      hasMissing = true; }
          if (!emp.visa_expiry)     { counts.visa++;     hasMissing = true; }
          if (!emp.insurance_expiry){ counts.insurance++; hasMissing = true; }
          if (!emp.iloe_expiry)     { counts.iloe++;     hasMissing = true; }
          if (hasMissing) empsMissing.add(emp.id);
        });
        return { counts, total: empsMissing.size };
      }, [employees]);

      // ── Multi-select for "send for Training / Client Interview" export ──────
      const [selectedIds, setSelectedIds] = useState(() => new Set());
      const [sendModalOpen, setSendModalOpen] = useState(false);
      const toggleOne = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
      const toggleAllVisible = (visibleIds, checked) => setSelectedIds(prev => {
        const n = new Set(prev);
        visibleIds.forEach(id => { checked ? n.add(id) : n.delete(id); });
        return n;
      });
      const clearSelection = () => setSelectedIds(new Set());
      const selectedEmployees = useMemo(() => employees.filter(e => selectedIds.has(e.id)), [employees, selectedIds]);

      return (
        <div>
          <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search name, ID, passport, email…" style={{ ...S.input, flex:1, minWidth:'240px', maxWidth:'380px' }} />
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={S.input}>
              <option value="all">All ({total})</option><option value="employed_only">Employed only</option><option value="with_id">With Employee ID</option><option value="pending">Pending</option>
            </select>
            <button className="hr-btn" style={S.btnPri} onClick={onAdd}>+ Add Employee</button>
          </div>

          {/* Selection bar — pick employees to send for Training or Client Interview */}
          {selectedIds.size > 0 && (
            <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'10px 14px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'12.5px', fontWeight:700, color:'#3730a3' }}><EmojiIcon e="✅" /> {selectedIds.size} employee{selectedIds.size!==1?'s':''} selected</span>
              <button className="hr-btn" onClick={()=>setSendModalOpen(true)} style={{ background:'#4338ca', color:'#fff', border:'none', padding:'7px 14px', borderRadius:'8px', fontSize:'12.5px', fontWeight:700, cursor:'pointer' }}><EmojiIcon e="📋" /> Prepare Send-Out List</button>
              <button onClick={clearSelection} style={{ background:'none', border:'1px solid #a5b4fc', color:'#3730a3', padding:'6px 12px', borderRadius:'8px', fontSize:'12.5px', fontWeight:600, cursor:'pointer' }}>Clear selection</button>
            </div>
          )}

          {/* Missing document data alert banner */}
          {missingStats.total > 0 && (
            <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'10px', padding:'12px 16px', marginBottom:'14px', display:'flex', alignItems:'flex-start', gap:'12px' }}>
              <span style={{ fontSize:'20px', flexShrink:0 }}><EmojiIcon e="⚠️" /></span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'6px' }}>
                  {missingStats.total} employee{missingStats.total!==1?'s':''} have missing expiry date{missingStats.total!==1?'s':''} — no alerts can be generated for missing entries
                </div>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {missingStats.counts.passport > 0 && <span style={{ background:'#fee2e2', color:'#991b1b', fontSize:'11px', fontWeight:700, padding:'2px 9px', borderRadius:'8px' }}><EmojiIcon e="🛂" /> Passport: {missingStats.counts.passport}</span>}
                  {missingStats.counts.eid > 0      && <span style={{ background:'#fed7aa', color:'#9a3412', fontSize:'11px', fontWeight:700, padding:'2px 9px', borderRadius:'8px' }}><EmojiIcon e="🪪" /> Emirates ID: {missingStats.counts.eid}</span>}
                  {missingStats.counts.visa > 0     && <span style={{ background:'#fef3c7', color:'#92400e', fontSize:'11px', fontWeight:700, padding:'2px 9px', borderRadius:'8px' }}><EmojiIcon e="📄" /> Visa: {missingStats.counts.visa}</span>}
                  {missingStats.counts.insurance > 0 && <span style={{ background:'#cffafe', color:'#164e63', fontSize:'11px', fontWeight:700, padding:'2px 9px', borderRadius:'8px' }}><EmojiIcon e="🏥" /> Insurance: {missingStats.counts.insurance}</span>}
                  {missingStats.counts.iloe > 0     && <span style={{ background:'#fce7f3', color:'#9d174d', fontSize:'11px', fontWeight:700, padding:'2px 9px', borderRadius:'8px' }}><EmojiIcon e="🛡️" /> ILOE: {missingStats.counts.iloe}</span>}
                </div>
                <div style={{ fontSize:'11.5px', color:'#b45309', marginTop:'6px' }}>Rows highlighted in amber below. Click ✏️ on each employee to add the missing details.</div>
              </div>
            </div>
          )}
          {missingStats.total === 0 && employees.length > 0 && (
            <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'10px', padding:'10px 16px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'10px', fontSize:'12.5px', color:'#166534' }}>
              <span><EmojiIcon e="✅" /></span> All employees have complete expiry date entries for Passport, Emirates ID, Visa, Insurance &amp; ILOE
            </div>
          )}
          <EmployeeTable employees={employees} thresholds={thresholds} onEdit={onEdit} onDelete={onDelete} selectedIds={selectedIds} onToggleOne={toggleOne} onToggleAllVisible={toggleAllVisible} showToast={showToast} onQuickSave={onQuickSave} />
          <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b' }}>Showing {employees.length} {employees.length===1?'employee':'employees'}</div>
          {sendModalOpen && (
            <SendOutListModal
              employees={selectedEmployees}
              onClose={()=>setSendModalOpen(false)}
              showToast={showToast}
            />
          )}
        </div>
      );
    }
    function EmployeeTable({ employees, thresholds, onEdit, onDelete, selectedIds, onToggleOne, onToggleAllVisible, showToast, onQuickSave }) {
      const [quickView, setQuickView] = React.useState(null); // employee object for popup
      const [showJoiningReport, setShowJoiningReport] = React.useState(false);
      const colGetters = {
        emp_id: e => e.employee_id||'—',
        name: e => e.full_name||'—',
        position: e => e.position||'—',
        exp: e => e.work_experience ? `${e.work_experience} yrs` : '—',
        nationality: e => e.nationality||'—',
        status: e => e.status||'—',
        joined: e => e.joining_date ? fmtDateDisplay(e.joining_date) : '—',
        source: e => e.hired_from==='Supplier' ? (e.supplier_name||'Supplier') : (e.hired_from||'—'),
        passport: e => expiryStatus(e.passport_expiry, thresholds.passport),
        eid: e => expiryStatus(e.eid_expiry, thresholds.eid),
        visa: e => expiryStatus(e.visa_expiry, thresholds.visa),
        insurance: e => expiryStatus(e.insurance_expiry, thresholds.insurance),
        cicpa: e => expiryStatus(e.cicpa_expiry, thresholds.cicpa),
        iloe: e => expiryStatus(e.iloe_expiry, thresholds.iloe),
      };
      const { filters, setColFilter, clearAll, filteredRows: rows, activeCount } = useColumnFilters(employees, colGetters);
      const CHK_W = 34;
      const FROZEN_W = [CHK_W, 90, 170];
      const FROZEN_LEFT = [0, FROZEN_W[0], FROZEN_W[0]+FROZEN_W[1]];
      const visibleIds = rows.map(r => r.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds && selectedIds.has(id));
      return (
          <>
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
            {activeCount > 0 && (
              <div style={{ padding:'7px 12px', background:'#eff6ff', borderBottom:'1px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'11.5px', color:'#1e40af' }}>
                <span><EmojiIcon e="🔎" /> {activeCount} column filter{activeCount!==1?'s':''} active — showing {rows.length} of {employees.length}</span>
                <button onClick={clearAll} style={{ background:'none', border:'none', color:'#1e40af', fontWeight:700, cursor:'pointer', fontSize:'13.5px' }}>Clear all filters</button>
              </div>
            )}
            <div className="xl-wrap hr-scroll">
              <table className="xl-table" style={{ width:'100%', fontSize:'12px', minWidth:'900px' }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  <th className="xl-frozen" style={{ ...S.th, left:FROZEN_LEFT[0], width:FROZEN_W[0], textAlign:'center' }}>
                    <input type="checkbox" checked={allVisibleSelected} onChange={e => onToggleAllVisible && onToggleAllVisible(visibleIds, e.target.checked)} title="Select all visible rows" />
                  </th>
                  <ExcelTh label="Emp ID" colKey="emp_id" rows={employees} getValue={colGetters.emp_id} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[1]} style={{ width:FROZEN_W[1] }} />
                  <ExcelTh label="Name" colKey="name" rows={employees} getValue={colGetters.name} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[2]} style={{ width:FROZEN_W[2] }} className="xl-frozen-edge" />
                  <ExcelTh label="Role / Work Visa" colKey="position" rows={employees} getValue={colGetters.position} filters={filters} setColFilter={setColFilter} style={{ width:180, minWidth:180 }} />
                  <ExcelTh label="Exp. Years" colKey="exp" rows={employees} getValue={colGetters.exp} filters={filters} setColFilter={setColFilter} />
                  <ExcelTh label="Nationality" colKey="nationality" rows={employees} getValue={colGetters.nationality} filters={filters} setColFilter={setColFilter} />
                  <ExcelTh label="Status" colKey="status" rows={employees} getValue={colGetters.status} filters={filters} setColFilter={setColFilter} />
                  <ExcelTh label="Joined" colKey="joined" rows={employees} getValue={colGetters.joined} filters={filters} setColFilter={setColFilter} />
                  <th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {rows.length===0 ? <tr><td colSpan={9} style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>No employees found</td></tr> :
                    rows.map(emp=>{
                      // Compute missing critical document fields
                      const missingDocs = [];
                      if (!emp.passport_expiry) missingDocs.push('Passport Expiry');
                      if (!emp.eid_expiry) missingDocs.push('Emirates ID Expiry');
                      if (!emp.visa_expiry) missingDocs.push('Visa Expiry');
                      if (!emp.insurance_expiry) missingDocs.push('Insurance Expiry');
                      if (!emp.iloe_expiry) missingDocs.push('ILOE Expiry');
                      const hasMissing = missingDocs.length > 0;
                      const rowBg = hasMissing ? '#fffbeb' : '#fff';
                      const isSel = !!(selectedIds && selectedIds.has(emp.id));
                      return (
                      <tr key={emp.id} className="hr-row" onDoubleClick={()=>onEdit(emp)} title="Double-click to edit" style={{ borderTop:'1px solid var(--bd3)', cursor:'pointer', background: isSel ? '#eef2ff' : hasMissing ? '#fffbeb' : 'transparent' }}>
                        <td className="xl-frozen" style={{ ...S.td, left:FROZEN_LEFT[0], width:FROZEN_W[0], background: isSel ? '#eef2ff' : rowBg, textAlign:'center' }} onClick={e=>e.stopPropagation()}>
                          <input type="checkbox" checked={isSel} onChange={()=>onToggleOne && onToggleOne(emp.id)} />
                        </td>
                        <td className="xl-frozen" style={{ ...S.td, left:FROZEN_LEFT[1], width:FROZEN_W[1], background: isSel ? '#eef2ff' : rowBg }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                            <span>{emp.employee_id||'—'}</span>
                            {hasMissing && (
                              <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                                {missingDocs.map(d => (
                                  <span key={d} title={'Missing: ' + d} style={{ background:'#fef3c7', color:'#92400e', fontSize:'9.5px', fontWeight:700, padding:'1px 5px', borderRadius:'6px', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'3px' }}>{d}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="xl-frozen xl-frozen-edge" onClick={e=>{e.stopPropagation();setQuickView(emp);}} title="Click to view details" style={{ ...S.td, left:FROZEN_LEFT[2], width:FROZEN_W[2], background: isSel ? '#eef2ff' : rowBg, fontWeight:600, cursor:'pointer', color:'#2563eb', textDecoration:'underline', textDecorationStyle:'dotted', textUnderlineOffset:'2px' }}>
                          {emp.full_name}
                        </td>
                        <td style={{ ...S.td, width:180, minWidth:180 }}>{emp.position}</td>
                        <td style={{ ...S.td, textAlign:'center' }}>{emp.work_experience ? <span style={{ background:'#eff6ff', color:'#1d4ed8', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700 }}>{emp.work_experience} yrs</span> : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                        <td style={S.td}>{emp.nationality}</td>
                        <td style={S.td}>{emp.status && <span title={emp.status} style={{ background: isStrictEmployed(emp.status)?'#d1fae5':'#fef3c7', color: isStrictEmployed(emp.status)?'#065f46':'#92400e', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:600, display:'inline-block', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.status}</span>}</td>
                        <td style={S.td}>{emp.joining_date ? <div><span style={{ fontSize:'11px', whiteSpace:'nowrap' }}>{fmtDateDisplay(emp.joining_date)}</span></div> : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                        {/* Source/Passport/EID/Visa/Insurance/CICPA/ILOE moved to popup */}
                        <td style={{ ...S.td, textAlign:'right', whiteSpace:'nowrap' }} onClick={ev=>ev.stopPropagation()}><button onClick={()=>onEdit(emp)} style={S.iconBtn}></button><button onClick={(ev)=>{ev.stopPropagation();onDelete(emp.id);}} style={S.iconBtn}></button></td>
                      </tr>
                    );})}
                </tbody>
              </table>
            </div>
          </div>
        {/* Quick View Popup */}
        {quickView && (() => {
          const qv = quickView;
          const fmtD = v => v ? new Date(v).toLocaleDateString('en-GB') : null;
          const daysLeft = v => { if (!v) return null; const d = Math.round((new Date(v)-new Date())/(1000*60*60*24)); return d; };
          const expiryColor = (v, warn) => { const d=daysLeft(v); if(d===null) return '#94a3b8'; if(d<0) return '#dc2626'; if(d<=warn) return '#f59e0b'; return '#16a34a'; };
          const InfoRow = ({label, value, mono}) => value ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
              <span style={{ fontSize:'10px', color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
              <span style={{ fontSize:'12.5px', color:'#1e293b', fontFamily: mono?'ui-monospace,monospace':undefined }}>{value}</span>
            </div>
          ) : null;
          const DocRow = ({label, no, expiry, warnDays=60}) => {
            const d=daysLeft(expiry); const col=expiryColor(expiry,warnDays);
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:'2px', padding:'8px 10px', borderRadius:'8px', background: expiry ? (d<0?'#fef2f2':d<=warnDays?'#fffbeb':'#f0fdf4') : '#f8fafc', border:`1px solid ${expiry?(d<0?'#fecaca':d<=warnDays?'#fde68a':'#bbf7d0'):'#e2e8f0'}` }}>
                <span style={{ fontSize:'10px', color:'#64748b', fontWeight:700, textTransform:'uppercase' }}>{label}</span>
                {no && <span style={{ fontSize:'11px', color:'#334155', fontFamily:'ui-monospace,monospace', fontWeight:600 }}>{no}</span>}
                {expiry
                  ? <span style={{ fontSize:'11.5px', fontWeight:700, color:col }}>{fmtD(expiry)}{d!==null ? ` (${d<0?'Expired '+Math.abs(d)+'d ago':d+'d left'})` : ''}</span>
                  : <span style={{ fontSize:'11px', color:'#94a3b8' }}>Not entered</span>}
              </div>
            );
          };
          return (
          <ResizablePanel
            title={qv.full_name}
            subtitle={`${qv.employee_id} · ${qv.position}`}
            headerColor="#1f2937"
            onClose={()=>setQuickView(null)}
            defaultSize="normal"
            zIndex={200}>
            <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
            <div style={{ display:'flex', gap:'8px', padding:'8px 14px', background:'#f8fafc', borderBottom:'1px solid var(--bd1)', flexShrink:0 }}>
              <button className="hr-btn" onClick={()=>{setQuickView(null); onEdit(qv);}} style={{ background:'#1a5fa8', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>Edit Employee</button><button className="hr-btn" onClick={async ()=>{ const emp=qv; if(!emp||!emp.employee_id) return; if(!window.confirm('Revert '+(emp.full_name||emp.employee_id)+' back to Candidate? This deletes the Employee record ('+emp.employee_id+') and any linked contacts/training rows, and reopens their Hiring Pipeline card as Active.')) return; try { const { data: match } = await db.from('hiring_pipeline').select('id,temp_employee_id').eq('passport_no', emp.passport_no || '__none__').limit(1); if(!match||match.length===0){ alert('No matching candidate record found for this employee — nothing to revert.'); return; } const rec=match[0]; const restoredTempId=(rec.temp_employee_id && /T$/i.test(rec.temp_employee_id)) ? rec.temp_employee_id : (emp.employee_id+'T'); await db.from('hiring_pipeline').update({ status:'Active', manual_stage:null, temp_employee_id: restoredTempId }).eq('id', rec.id); await db.from('employee_contacts').delete().eq('employee_number', emp.employee_id); await db.from('employee_trainings').delete().eq('employee_id', emp.employee_id); await db.from('employees').delete().eq('employee_id', emp.employee_id); await logAudit(null, 'employees', emp.employee_id, emp.full_name, 'delete', 'Reverted to Candidate from Employee Quick View'); alert('Reverted — '+(emp.full_name||emp.employee_id)+' is back in the Hiring Pipeline as a candidate.'); window.location.reload(); } catch(e) { alert('Revert failed: '+e.message); } }} style={{ background:'#b91c1c', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>↩ Revert to Candidate</button>
              <button className="hr-btn" onClick={()=>setShowJoiningReport(true)} style={{ background:'#0f766e', color:'#fff', border:'none', padding:'6px 14px', borderRadius:'8px', fontSize:'14px', fontWeight:700, cursor:'pointer' }}><EmojiLabel text="📝 Joining Report" /></button>
            </div>
            {/* Body - scrollable */}
            <div style={{ overflowY:'auto', flex:1 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'0' }}>
                  {/* Left panel */}
                  <div style={{ padding:'18px 20px', borderRight:'1px solid var(--bd1)', display:'flex', flexDirection:'column', gap:'12px' }}>
                    <div style={{ fontSize:'11px', fontWeight:700, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'2px solid #eff6ff', paddingBottom:'6px' }}>Personal &amp; Contact</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      <InfoRow label="Nationality" value={qv.nationality} />
                      <InfoRow label="Status" value={qv.status} />
                      <InfoRow label="Experience" value={qv.work_experience ? qv.work_experience+' yrs' : null} />
                      <InfoRow label="Joined" value={fmtD(qv.joining_date)} />
                      <InfoRow label="Arrived at Camp" value={fmtD(qv.camp_arrival_date)} />
                      <InfoRow label="Actual Joining (Visa)" value={fmtD(qv.actual_joining_date)} />
                      <InfoRow label="Mobile" value={qv.mobile} />
                      <InfoRow label="Email" value={qv.email} />
                      <InfoRow label="Hired From" value={qv.hired_from==='Supplier'?(qv.supplier_name||'Supplier'):qv.hired_from} />
                      <InfoRow label="Department" value={qv.department} />
                    </div>
                    <div style={{ fontSize:'11px', fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'2px solid #f5f3ff', paddingBottom:'6px', marginTop:'4px' }}>Location &amp; Work History</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      <InfoRow label="Current Location (UAE)" value={qv.uae_address || qv.current_location_uae} />
                      <InfoRow label="Home Country Address" value={qv.home_address} />
                      <InfoRow label="Previous Job Location" value={qv.previous_job_location || qv.last_employer_location} />
                      <InfoRow label="Previous Employer" value={qv.previous_employer || qv.last_employer} />
                    </div>
                    {qv.skills && (
                      <>
                        <div style={{ fontSize:'11px', fontWeight:700, color:'#059669', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'2px solid #f0fdf4', paddingBottom:'6px', marginTop:'4px' }}>Skills</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                          {qv.skills.split(',').map((sk,i) => (
                            <span key={i} style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#166534', padding:'3px 9px', borderRadius:'12px', fontSize:'11px', fontWeight:600 }}>{sk.trim()}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Right panel */}
                  <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:'12px' }}>
                    <div style={{ fontSize:'11px', fontWeight:700, color:'#dc2626', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'2px solid #fef2f2', paddingBottom:'6px' }}>Documents &amp; Expiry</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                      <DocRow label="Passport" no={qv.passport_no} expiry={qv.passport_expiry} warnDays={180} />
                      <DocRow label="Emirates ID" no={qv.eid_no} expiry={qv.eid_expiry} warnDays={60} />
                      <DocRow label="Visa" expiry={qv.visa_expiry} warnDays={60} />
                      <DocRow label="Insurance" no={qv.insurance_id} expiry={qv.insurance_expiry} warnDays={30} />
                      <DocRow label="CICPA Gate Pass" no={qv.cicpa_no} expiry={qv.cicpa_expiry} warnDays={15} />
                      <DocRow label="ILOE" no={qv.iloe_cert_no} expiry={qv.iloe_expiry} warnDays={30} />
                    </div>
                    {qv.cicpa_locations && (
                      <div style={{ padding:'8px 10px', borderRadius:'8px', background:'#faf5ff', border:'1px solid #e9d5ff' }}>
                        <div style={{ fontSize:'10px', color:'#7c3aed', fontWeight:700, textTransform:'uppercase', marginBottom:'4px' }}>CICPA Permitted Locations</div>
                        <div style={{ fontSize:'12px', color:'#4c1d95' }}>{qv.cicpa_locations}</div>
                      </div>
                    )}
                    {(qv.passport_handover || qv.passport_handover_date) && (
                      <div style={{ padding:'8px 10px', borderRadius:'8px', background:'#fff7ed', border:'1px solid #fed7aa' }}>
                        <div style={{ fontSize:'10px', color:'#c2410c', fontWeight:700, textTransform:'uppercase', marginBottom:'4px' }}>Passport Handover</div>
                        <div style={{ fontSize:'12px', color:'#7c2d12' }}>{qv.passport_handover || fmtD(qv.passport_handover_date)}</div>
                      </div>
                    )}
                    <div style={{ fontSize:'11px', fontWeight:700, color:'#0891b2', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'2px solid #ecfeff', paddingBottom:'6px', marginTop:'4px' }}>Emergency Contact</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      <InfoRow label="Name" value={qv.emergency_name} />
                      <InfoRow label="Relation" value={qv.emergency_relation} />
                      <InfoRow label="Mobile" value={qv.emergency_mobile} />
                      <InfoRow label="Country" value={qv.emergency_country} />
                    </div>
                  </div>
                </div>
                {/* Notes bar */}
                {qv.notes && (
                  <div style={{ margin:'0 20px 16px', padding:'10px 14px', background:'#f8fafc', borderRadius:'8px', border:'1px solid var(--bd1)', fontSize:'12px', color:'#475569' }}>
                    <span style={{ fontWeight:700, color:'#0f172a' }}>Notes: </span>{qv.notes}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
          );
        })()}
        {showJoiningReport && quickView && (
          <JoiningReportModal
            employee={quickView}
            onClose={()=>setShowJoiningReport(false)}
            onSaved={async (patch) => { if (onQuickSave) await onQuickSave({ ...quickView, ...patch }); }}
            showToast={showToast}
          />
        )}
          </>
      );
    }

    // ============ SEND-OUT LIST (Training / Client Interview) ============
    // Takes a set of selected employees, lets HR review/edit a compact set of
    // fields (and add missing Emirates ID / CICPA details), then export to
    // Excel or PDF. "Save EID/CICPA to Records" is optional and only touches
    // those four columns on the employee's real record — nothing else here
    // is written back automatically.
    function SendOutListModal({ employees, onClose, showToast }) {
      const [purpose, setPurpose] = useState('Training');
      const [rows, setRows] = useState(() => employees.map(e => ({
        _id: e.id,
        emp_no: e.employee_id || '',
        name: e.full_name || '',
        craft: e.position || '',
        nationality: e.nationality || '',
        passport_no: e.passport_no || '',
        exp_years: e.work_experience || '',
        dob: e.dob || '',
        eid_no: e.eid_no || '',
        eid_expiry: e.eid_expiry || '',
        cicpa_no: e.cicpa_no || '',
        cicpa_expiry: e.cicpa_expiry || '',
      })));
      const [saving, setSaving] = useState(false);

      const setCell = (idx, key, val) => setRows(prev => prev.map((r,i) => i===idx ? { ...r, [key]: val } : r));

      const COLS = [
        { key:'emp_no',       label:'Emp No',         w:90  },
        { key:'name',         label:'Name',           w:170 },
        { key:'craft',        label:'Craft',          w:150 },
        { key:'nationality',  label:'Nationality',    w:110 },
        { key:'passport_no',  label:'Passport No',    w:120 },
        { key:'exp_years',    label:'Years Exp.',     w:80,  type:'number' },
        { key:'dob',          label:'Date of Birth',  w:130, type:'date' },
        { key:'eid_no',       label:'Emirates ID No', w:140 },
        { key:'eid_expiry',   label:'EID Expiry',     w:130, type:'date' },
        { key:'cicpa_no',     label:'CICPA No',       w:120 },
        { key:'cicpa_expiry', label:'CICPA Expiry',   w:130, type:'date' },
      ];

      const downloadExcel = () => {
        const wb = XLSX.utils.book_new();
        const data = rows.map(r => {
          const o = {};
          COLS.forEach(c => { o[c.label] = r[c.key] || ''; });
          return o;
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length ? data : [{}]), (purpose||'List').slice(0,28));
        const today = new Date().toISOString().slice(0,10);
        XLSX.writeFile(wb, `SATCO_${purpose.replace(/\s+/g,'_')}_List_${today}.xlsx`);
        showToast('✅ Send-out list exported to Excel');
      };

      const downloadPdf = async () => {
        try {
          const { PDFDocument, rgb, StandardFonts } = PDFLib;
          const NAVY = rgb(0.059,0.133,0.251), WHITE = rgb(1,1,1), BLACK = rgb(0,0,0),
                MGRAY = rgb(0.580,0.631,0.690), LGRAY = rgb(0.945,0.961,0.980), BORDER = rgb(0.796,0.851,0.906);
          const pdfDoc = await PDFDocument.create();
          const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
          // Landscape A4
          const PW = 841.89, PH = 595.28;
          const ML = 24, MR = 24, MT = 24;
          const today = new Date().toISOString().slice(0,10);
          const totalW = COLS.reduce((s,c)=>s+c.w,0);
          const colWidths = COLS.map(c => c.w * ((PW-ML-MR) / totalW));
          let page, y;
          const clip = (str, fnt, sz, maxW) => {
            const s = String(str||'');
            if (!s) return '';
            if (fnt.widthOfTextAtSize(s,sz) <= maxW) return s;
            let c = s;
            while (c.length>1 && fnt.widthOfTextAtSize(c+'…',sz)>maxW) c=c.slice(0,-1);
            return c+'…';
          };
          const addPage = () => {
            page = pdfDoc.addPage([PW,PH]);
            y = PH - MT;
            page.drawText(`SATCO Arabia — ${purpose} Send-Out List`, { x:ML, y:y-14, size:13, font:bold, color:NAVY });
            page.drawText(`Generated ${today}  |  ${rows.length} employee${rows.length!==1?'s':''}`, { x:ML, y:y-30, size:8, font:reg, color:MGRAY });
            y -= 42;
            let x = ML;
            page.drawRectangle({ x:ML, y:y-16, width:PW-ML-MR, height:16, color:NAVY });
            COLS.forEach((c,i) => {
              page.drawText(clip(c.label, bold, 7.5, colWidths[i]-6), { x:x+3, y:y-11, size:7.5, font:bold, color:WHITE });
              x += colWidths[i];
            });
            y -= 16;
          };
          addPage();
          const rowH = 16;
          rows.forEach((r, ri) => {
            if (y - rowH < 30) addPage();
            let x = ML;
            if (ri % 2 === 1) page.drawRectangle({ x:ML, y:y-rowH, width:PW-ML-MR, height:rowH, color:LGRAY });
            COLS.forEach((c,i) => {
              const val = c.type === 'date' && r[c.key] ? fmtDateDisplay(r[c.key]) : (r[c.key]||'');
              page.drawText(clip(val, reg, 7.5, colWidths[i]-6), { x:x+3, y:y-rowH+5, size:7.5, font:reg, color:BLACK });
              x += colWidths[i];
            });
            page.drawLine({ start:{x:ML,y:y-rowH}, end:{x:PW-MR,y:y-rowH}, thickness:0.4, color:BORDER });
            y -= rowH;
          });
          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type:'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `SATCO_${purpose.replace(/\s+/g,'_')}_List_${today}.pdf`; a.click();
          URL.revokeObjectURL(url);
          showToast('✅ Send-out list exported to PDF');
        } catch(e) { showToast('❌ PDF error: ' + e.message, 'error'); console.error(e); }
      };

      const saveToRecords = async () => {
        setSaving(true);
        let ok = 0, fail = 0;
        for (const r of rows) {
          if (!r._id) continue;
          const patch = {
            eid_no: r.eid_no || null, eid_expiry: r.eid_expiry || null,
            cicpa_no: r.cicpa_no || null, cicpa_expiry: r.cicpa_expiry || null,
          };
          try {
            const { error } = await db.from('employees').update(patch).eq('id', r._id);
            if (error) fail++; else ok++;
          } catch(e) { fail++; }
        }
        setSaving(false);
        if (fail === 0) showToast(`✅ Emirates ID / CICPA saved to ${ok} employee record${ok!==1?'s':''}`);
        else showToast(`⚠️ Saved ${ok}, failed ${fail} — check Supabase RLS policy on employees UPDATE`, 'error');
      };

      return (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.7)', zIndex:999, display:'flex', flexDirection:'column' }}>
          <div style={{ background:'#0f2744', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', flexShrink:0 }}>
            <div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:'15px' }}><EmojiIcon e="📋" /> Prepare Send-Out List</div>
              <div style={{ color:'#93c5fd', fontSize:'11.5px' }}>{rows.length} employee{rows.length!==1?'s':''} selected — review and edit before exporting</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
              <label style={{ color:'#e2e8f0', fontSize:'12px', fontWeight:600, display:'flex', alignItems:'center', gap:'6px' }}>
                Purpose:
                <select value={purpose} onChange={e=>setPurpose(e.target.value)} style={{ padding:'6px 8px', borderRadius:'6px', border:'1px solid #334155', fontSize:'12.5px' }}>
                  <option value="Training">Training</option>
                  <option value="Client Interview">Client Interview</option>
                </select>
              </label>
              <button onClick={saveToRecords} disabled={saving} style={{ background: saving?'#334155':'#059669', color:'#fff', border:'none', padding:'8px 14px', borderRadius:'7px', fontSize:'12.5px', fontWeight:700, cursor: saving?'wait':'pointer' }}>{saving ? 'Saving…' : '💾 Save EID/CICPA to Records'}</button>
              <button onClick={downloadExcel} style={{ background:'#16a34a', color:'#fff', border:'none', padding:'8px 14px', borderRadius:'7px', fontSize:'12.5px', fontWeight:700, cursor:'pointer' }}>⬇ Excel</button>
              <button onClick={downloadPdf} style={{ background:'#d97706', color:'#fff', border:'none', padding:'8px 14px', borderRadius:'7px', fontSize:'12.5px', fontWeight:700, cursor:'pointer' }}>⬇ PDF</button>
              <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', padding:'8px 14px', borderRadius:'7px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Close</button>
            </div>
          </div>
          <div style={{ flex:1, overflow:'auto', padding:'16px 20px', background:'#eef2f7' }}>
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'8px', padding:'8px 12px', marginBottom:'12px', fontSize:'11.5px', color:'#9a3412' }}>
              <EmojiIcon e="ℹ️" /> All fields below are editable. Emirates ID and CICPA details can be added here if missing — use "Save EID/CICPA to Records" to write them back to the employee's permanent record.
            </div>
            <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth: COLS.reduce((s,c)=>s+c.w,0) }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {COLS.map(c => (
                      <th key={c.key} style={{ textAlign:'left', padding:'8px 10px', borderBottom:'2px solid var(--bd1)', fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.04em', width:c.w, whiteSpace:'nowrap' }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={COLS.length} style={{ textAlign:'center', padding:'30px', color:'#94a3b8' }}>No employees selected</td></tr>
                  ) : rows.map((r, idx) => (
                    <tr key={r._id||idx} style={{ borderTop:'1px solid var(--bd3)' }}>
                      {COLS.map(c => (
                        <td key={c.key} style={{ padding:'4px 6px' }}>
                          {c.key === 'emp_no' ? (
                            <span style={{ display:'inline-block', padding:'6px 8px', fontWeight:600, color:'#334155' }}>{r.emp_no || '—'}</span>
                          ) : (
                            <input
                              type={c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'}
                              value={r[c.key]||''}
                              onChange={e=>setCell(idx, c.key, e.target.value)}
                              style={{ width:'100%', padding:'6px 8px', border:'1px solid var(--bd2)', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit' }}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    function DateCell({ value, threshold, docNo, missing }) {
      if (!value) return <td style={{ ...S.td, background: missing ? '#fff7ed' : 'transparent' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          {missing && <span style={{ fontSize:'10px', color:'#c2410c', background:'#ffedd5', border:'1px dashed #fb923c', padding:'2px 7px', borderRadius:'6px', fontWeight:700, whiteSpace:'nowrap' }}>Not entered</span>}
          {docNo && <span style={{ fontSize:'10px', color:'#94a3b8', fontFamily:'ui-monospace, monospace' }}>{docNo}</span>}
          {!missing && !docNo && <span style={{ color:'#cbd5e1' }}>—</span>}
        </div>
      </td>;
      const d = daysUntil(value); if (d===null) return <td style={S.td}><span style={{ color:'#cbd5e1' }}>—</span></td>;
      let c='#475569', bg='transparent';
      if (d<0){c='#dc2626';bg='#fee2e2';} else if(d<=7){c='#ea580c';bg='#fed7aa';} else if(d<=threshold){c='#ca8a04';bg='#fef3c7';}
      return <td style={S.td}>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <span style={{ fontSize:'11px', whiteSpace:'nowrap' }}>{fmtDateDisplay(value)}</span>
          <span style={{ fontSize:'10px', color:c, background:bg, padding:'1px 6px', borderRadius:'8px', alignSelf:'flex-start', fontWeight:600, whiteSpace:'nowrap' }}>{d<0?`${Math.abs(d)}d ago`:`${d}d`}</span>
          {docNo && <span style={{ fontSize:'10px', color:'#94a3b8', fontFamily:'ui-monospace, monospace', marginTop:'2px', whiteSpace:'nowrap' }}>{docNo}</span>}
        </div>
      </td>;
    }
    function InsuranceCell({ value, threshold, company, missing }) {
      const d = value ? daysUntil(value) : null;
      let c='#475569', bg='transparent';
      if (d !== null) {
        if (d<0){c='#dc2626';bg='#fee2e2';} else if(d<=7){c='#ea580c';bg='#fed7aa';} else if(d<=threshold){c='#ca8a04';bg='#fef3c7';}
      }
      if (!company && !value) return <td style={{ ...S.td, background: missing ? '#fff7ed' : 'transparent' }}>
        {missing ? <span style={{ fontSize:'10px', color:'#c2410c', background:'#ffedd5', border:'1px dashed #fb923c', padding:'2px 7px', borderRadius:'6px', fontWeight:700, whiteSpace:'nowrap' }}><EmojiIcon e="📋" /> Not entered</span> : <span style={{ color:'#cbd5e1' }}>—</span>}
      </td>;
      return <td style={S.td}>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          {company && <span style={{ fontSize:'11px', fontWeight:600, color:'#0891b2', whiteSpace:'nowrap' }}>{company}</span>}
          {value && <span style={{ fontSize:'11px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDateDisplay(value)}</span>}
          {d !== null && <span style={{ fontSize:'10px', color:c, background:bg, padding:'1px 6px', borderRadius:'8px', alignSelf:'flex-start', fontWeight:600, whiteSpace:'nowrap' }}>{d<0?`${Math.abs(d)}d ago`:`${d}d`}</span>}
          {!value && company && missing && <span style={{ fontSize:'10px', color:'#c2410c', background:'#ffedd5', border:'1px dashed #fb923c', padding:'2px 5px', borderRadius:'6px', fontWeight:700 }}><EmojiIcon e="📋" /> No expiry</span>}
        </div>
      </td>;
    }

    function CicpaCell({ value, threshold, docNo, locations }) {
      const locs = (locations || '').split(',').map(s=>s.trim()).filter(Boolean);
      // Empty case: no date but possibly some other data
      if (!value && !docNo && locs.length === 0) return <td style={S.td}><span style={{ color:'#cbd5e1' }}>—</span></td>;
      const d = value ? daysUntil(value) : null;
      let c='#475569', bg='transparent';
      if (d != null) {
        if (d<0){c='#dc2626';bg='#fee2e2';} else if(d<=7){c='#ea580c';bg='#fed7aa';} else if(d<=threshold){c='#ca8a04';bg='#fef3c7';}
      }
      return <td style={S.td}>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px', minWidth:'110px' }}>
          {value && <span style={{ fontSize:'11px', whiteSpace:'nowrap' }}>{fmtDateDisplay(value)}</span>}
          {d != null && <span style={{ fontSize:'10px', color:c, background:bg, padding:'1px 6px', borderRadius:'8px', alignSelf:'flex-start', fontWeight:600, whiteSpace:'nowrap' }}>{d<0?`${Math.abs(d)}d ago`:`${d}d`}</span>}
          {docNo && <span style={{ fontSize:'10px', color:'#94a3b8', fontFamily:'ui-monospace, monospace', marginTop:'1px', whiteSpace:'nowrap' }}>{docNo}</span>}
          {locs.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginTop:'3px' }}>
              {locs.map(loc => (
                <span key={loc} style={{ background:'#ede9fe', color:'#6d28d9', padding:'1px 6px', borderRadius:'8px', fontSize:'9.5px', fontWeight:600 }}>{loc}</span>
              ))}
            </div>
          )}
        </div>
      </td>;
    }

    function IloeCell({ value, threshold, certNo, missing }) {
      const d = value ? daysUntil(value) : null;
      let c='#475569', bg='transparent';
      if (d !== null) {
        if (d<0){c='#dc2626';bg='#fee2e2';} else if(d<=7){c='#ea580c';bg='#fed7aa';} else if(d<=threshold){c='#ca8a04';bg='#fef3c7';}
      }
      if (!certNo && !value) return <td style={{ ...S.td, background: missing ? '#fff7ed' : 'transparent' }}>
        {missing ? <span style={{ fontSize:'10px', color:'#c2410c', background:'#ffedd5', border:'1px dashed #fb923c', padding:'2px 7px', borderRadius:'6px', fontWeight:700, whiteSpace:'nowrap' }}><EmojiIcon e="📋" /> Not entered</span> : <span style={{ color:'#cbd5e1' }}>—</span>}
      </td>;
      return <td style={S.td}>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          {certNo && <span style={{ fontSize:'10px', fontFamily:'ui-monospace,monospace', color:'#be185d', fontWeight:600, whiteSpace:'nowrap' }}>{certNo}</span>}
          {value && <span style={{ fontSize:'11px', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDateDisplay(value)}</span>}
          {d !== null && <span style={{ fontSize:'10px', color:c, background:bg, padding:'1px 6px', borderRadius:'8px', alignSelf:'flex-start', fontWeight:600, whiteSpace:'nowrap' }}>{d<0?`${Math.abs(d)}d ago`:`${d}d`}</span>}
          {!value && certNo && missing && <span style={{ fontSize:'10px', color:'#c2410c', background:'#ffedd5', border:'1px dashed #fb923c', padding:'2px 5px', borderRadius:'6px', fontWeight:700 }}><EmojiIcon e="📋" /> No expiry</span>}
        </div>
      </td>;
    }

    // ============ ALERTS ============
    function AlertsView({ alerts, thresholds, dashboardEmployees }) {
      const [filter, setFilter] = useState('all');
      const filtered = filter==='all' ? alerts : alerts.filter(a=>a.type===filter);
      const trainingAlertCount = alerts.filter(a=>a.type==='training_cert').length;
      return (
        <div>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'12px 16px', marginBottom:'14px', fontSize:'12.5px', color:'#1e40af' }}>ℹ️ Alerts are computed for {dashboardEmployees.length} active employees.</div>
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'14px', marginBottom:'14px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <button onClick={()=>setFilter('all')} style={{ ...S.chip, ...(filter==='all'?S.chipActive:{}) }}>All ({alerts.length})</button>
            {EXPIRY_TYPES.map(t=>{const c=alerts.filter(a=>a.type===t.key).length; return <button key={t.key} onClick={()=>setFilter(t.key)} style={{ ...S.chip, ...(filter===t.key?S.chipActive:{}) }}>{t.label} ({c}) <span style={{color:'#94a3b8',fontSize:'12.5px'}}>≤{thresholds[t.key]}d</span></button>;})}
            <button onClick={()=>setFilter('training_cert')} style={{ ...S.chip, ...(filter==='training_cert' ? { background:'#ccfbf1', color:'#0f766e', borderColor:'#5eead4' } : {}), border:'1px solid #99f6e4' }}>Training Certs ( {trainingAlertCount}) <span style={{color:'#94a3b8',fontSize:'12.5px'}}>≤{thresholds.training_cert||30}d</span>
            </button>
          </div>
          <AlertsTable filtered={filtered} />
        </div>
      );
    }
    function AlertsTable({ filtered }) {
      const colGetters = {
        severity: a => a.severity||'—',
        employee: a => a.full_name||'—',
        doc: a => a.typeLabel||'—',
        issuer: a => a.issuingCompany||a.certNo||'—',
        expiry: a => a.expiryDate ? fmtDateDisplay(a.expiryDate) : '—',
        days: a => a.daysLeft<0 ? 'Overdue' : (a.daysLeft<=7 ? 'Critical (≤7d)' : (a.daysLeft<=30 ? 'Warning' : 'OK')),
        contact: a => a.email||a.mobile||'—',
      };
      const { filters, setColFilter, clearAll, filteredRows: rows, activeCount } = useColumnFilters(filtered, colGetters);
      const FROZEN_W = [100, 160];
      const FROZEN_LEFT = [0, FROZEN_W[0]];
      return (
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
            {activeCount > 0 && (
              <div style={{ padding:'7px 12px', background:'#eff6ff', borderBottom:'1px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'11.5px', color:'#1e40af' }}>
                <span><EmojiIcon e="🔎" /> {activeCount} column filter{activeCount!==1?'s':''} active — showing {rows.length} of {filtered.length}</span>
                <button onClick={clearAll} style={{ background:'none', border:'none', color:'#1e40af', fontWeight:700, cursor:'pointer', fontSize:'13.5px' }}>Clear all filters</button>
              </div>
            )}
            {filtered.length===0 ? <div style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>All clear — no expiring documents</div> :
              <div className="xl-wrap hr-scroll">
              <table className="xl-table" style={{ width:'100%', fontSize:'12px', minWidth:'900px' }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  <ExcelTh label="Severity" colKey="severity" rows={filtered} getValue={colGetters.severity} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[0]} style={{ width:FROZEN_W[0] }} />
                  <ExcelTh label="Employee" colKey="employee" rows={filtered} getValue={colGetters.employee} filters={filters} setColFilter={setColFilter} frozen left={FROZEN_LEFT[1]} style={{ width:FROZEN_W[1] }} className="xl-frozen-edge" />
                  <ExcelTh label="Document / Course" colKey="doc" rows={filtered} getValue={colGetters.doc} filters={filters} setColFilter={setColFilter} />
                  <ExcelTh label="Issuer / Cert No" colKey="issuer" rows={filtered} getValue={colGetters.issuer} filters={filters} setColFilter={setColFilter} />
                  <ExcelTh label="Expiry Date" colKey="expiry" rows={filtered} getValue={colGetters.expiry} filters={filters} setColFilter={setColFilter} />
                  <ExcelTh label="Days" colKey="days" rows={filtered} getValue={colGetters.days} filters={filters} setColFilter={setColFilter} />
                  <ExcelTh label="Contact" colKey="contact" rows={filtered} getValue={colGetters.contact} filters={filters} setColFilter={setColFilter} />
                </tr></thead>
                <tbody>{rows.map((a,i)=>{const c=a.severity==='expired'?'#dc2626':a.severity==='critical'?'#ea580c':a.severity==='urgent'?'#ca8a04':'#0891b2';
                  return <tr key={i} className="hr-row" style={{ borderTop:'1px solid var(--bd3)' }}>
                    <td className="xl-frozen" style={{ ...S.td, left:FROZEN_LEFT[0], width:FROZEN_W[0], background:'#fff' }}><span style={{ background:c+'15', color:c, padding:'3px 9px', borderRadius:'10px', fontSize:'10.5px', fontWeight:700, textTransform:'uppercase' }}>{a.severity}</span></td>
                    <td className="xl-frozen xl-frozen-edge" style={{ ...S.td, left:FROZEN_LEFT[1], width:FROZEN_W[1], background:'#fff' }}><div style={{ fontWeight:600 }}>{a.full_name}</div><div style={{ fontSize:'11px', color:'#94a3b8' }}>{a.employee_id}</div></td>
                    <td style={S.td}>
                      <div>{a.typeLabel}</div>
                      {a.type === 'training_cert' && <div style={{ fontSize:'10.5px', color:'#0f766e', background:'#f0fdfa', display:'inline-block', padding:'1px 6px', borderRadius:'8px', marginTop:'2px', fontWeight:600 }}><EmojiIcon e="🎓" /> Training Cert</div>}
                    </td>
                    <td style={{ ...S.td, fontSize:'11.5px', color:'#64748b' }}>
                      {a.issuingCompany && <div style={{ fontWeight:600, color:'#0f172a' }}>{a.issuingCompany}</div>}
                      {a.certNo && <div style={{ fontFamily:'ui-monospace,monospace', fontSize:'11px', color:'#64748b' }}>{a.certNo}</div>}
                      {!a.issuingCompany && !a.certNo && '—'}
                    </td>
                    <td style={{ ...S.td, whiteSpace:'nowrap' }}>{fmtDateDisplay(a.expiryDate)}</td>
                    <td style={{ ...S.td, fontWeight:700, color:c, whiteSpace:'nowrap' }}>{a.daysLeft<0?`${Math.abs(a.daysLeft)}d overdue`:`${a.daysLeft}d`}</td>
                    <td style={{ ...S.td, fontSize:'11px' }}>{a.email&&<div>{a.email}</div>}{a.mobile&&<div style={{color:'#94a3b8'}}>{a.mobile}</div>}</td>
                  </tr>;})}</tbody>
              </table>
              </div>}
          </div>
      );
    }

    // ============ MOB-DEMOB ============
    function MobDemobView({ records, employees, onAdd, onEdit, onDelete, onSyncAll, onRedeploy, selectedMobEmp, setSelectedMobEmp }) {
      const [search, setSearch] = useState('');
      const empIds = new Set(employees.map(e => e.employee_id).filter(Boolean));
      const synced = records.filter(r => empIds.has(r.employee_id)).length;
      const total = empIds.size;
      const missing = total - synced;

      const calcDays = (r) => {
        const mob = r.mobilization_date ? new Date(r.mobilization_date) : null;
        const demob = r.demobilization_date ? new Date(r.demobilization_date) : null;
        if (!mob) return null;
        return Math.round(((demob || new Date()) - mob) / 86400000);
      };

      // Build unique employee list from employees table (active) + any records without matching employee
      const empList = useMemo(() => {
        const s = search.toLowerCase().trim();
        return employees
          .filter(e => {
            if (!s) return true;
            return (e.employee_id||'').toLowerCase().includes(s) ||
                   (e.full_name||'').toLowerCase().includes(s) ||
                   (e.position||'').toLowerCase().includes(s);
          })
          .sort((a, b) => {
            const na = parseInt((a.employee_id||'').replace(/[^0-9]/g,'') || '0');
            const nb = parseInt((b.employee_id||'').replace(/[^0-9]/g,'') || '0');
            return na - nb;
          });
      }, [employees, search]);

      // Records for the selected employee
      const empRecords = useMemo(() => {
        if (!selectedMobEmp) return [];
        return [...records]
          .filter(r => r.employee_id === selectedMobEmp.employee_id)
          .sort((a, b) => (b.mobilization_date||'') > (a.mobilization_date||'') ? 1 : -1);
      }, [records, selectedMobEmp]);

      // ── DETAIL VIEW ─────────────────────────────────────────
      if (selectedMobEmp) {
        const activeRec = empRecords.find(r => !r.demobilization_date);
        const totalDays = empRecords.reduce((s, r) => s + (calcDays(r) || 0), 0);
        return (
          <div>
            {/* Back + header */}
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'18px' }}>
              <button onClick={() => setSelectedMobEmp(null)}
                style={{ background:'#f1f5f9', border:'1px solid var(--bd1)', borderRadius:'8px', padding:'7px 14px', fontSize:'13px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}><EmojiIcon e="←" /> Back</button>
              <div style={{ flex:1 }}>
                <h2 style={{ margin:0, fontSize:'17px', fontWeight:700, color:'#0f172a' }}>{selectedMobEmp.full_name}</h2>
                <div style={{ fontSize:'12px', color:'#64748b', marginTop:'2px' }}>{selectedMobEmp.employee_id} · {selectedMobEmp.position}</div>
              </div>
              <button className="hr-btn" style={S.btnPri} onClick={() => onAdd({ employee_id: selectedMobEmp.employee_id, full_name: selectedMobEmp.full_name, position: selectedMobEmp.position, eid_no: selectedMobEmp.eid_no })}>
                + New Assignment
              </button>
            </div>

            {/* Summary strip */}
            <div style={{ display:'flex', gap:'10px', marginBottom:'18px', flexWrap:'wrap' }}>
              <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'12px 18px', display:'flex', flexDirection:'column', gap:'2px' }}>
                <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:700, textTransform:'uppercase' }}>Assignments</div>
                <div style={{ fontSize:'22px', fontWeight:800, color:'#0f172a' }}>{empRecords.length}</div>
              </div>
              <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'10px', padding:'12px 18px', display:'flex', flexDirection:'column', gap:'2px' }}>
                <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:700, textTransform:'uppercase' }}>Total Days</div>
                <div style={{ fontSize:'22px', fontWeight:800, color:'#0f172a' }}>{totalDays}<span style={{ fontSize:'13px', color:'#64748b', fontWeight:500 }}>d</span></div>
              </div>
              <div style={{ background: activeRec ? '#f0fdf4' : '#fff', border:'1px solid '+(activeRec?'#86efac':'#e2e8f0'), borderRadius:'10px', padding:'12px 18px', display:'flex', flexDirection:'column', gap:'2px' }}>
                <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:700, textTransform:'uppercase' }}>Status</div>
                <div style={{ fontSize:'14px', fontWeight:700, color: activeRec ? '#166534' : '#64748b' }}><EmojiLabel text={activeRec ? '🟢 Active' : '⚪ Inactive'} /></div>
              </div>
            </div>

            {/* Assignment cards */}
            {empRecords.length === 0 ? (
              <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'60px', textAlign:'center', color:'#94a3b8' }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}><EmojiIcon e="📋" /></div>
                <div style={{ fontWeight:600 }}>No assignment records yet</div>
                <button className="hr-btn" style={{ ...S.btnPri, marginTop:'14px' }} onClick={() => onAdd({ employee_id: selectedMobEmp.employee_id, full_name: selectedMobEmp.full_name, position: selectedMobEmp.position, eid_no: selectedMobEmp.eid_no })}>
                  Add First Assignment
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {empRecords.map((r, idx) => {
                  const days = calcDays(r);
                  const isActive = !r.demobilization_date;
                  return (
                    <div key={r.id} style={{ background:'#fff', border:'1px solid '+(isActive?'#86efac':'#e2e8f0'), borderLeft:'4px solid '+(isActive?'#16a34a':'#94a3b8'), borderRadius:'12px', padding:'16px 18px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', marginBottom:'12px' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                            <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:700 }}>Assignment #{empRecords.length - idx}</span>
                            {isActive && <span style={{ background:'#dcfce7', color:'#166534', fontSize:'10.5px', fontWeight:700, padding:'2px 8px', borderRadius:'10px' }}>Active</span>}
                          </div>
                          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                            {r.supply && <span style={{ background:'#eff6ff', color:'#1e40af', fontSize:'11.5px', fontWeight:600, padding:'3px 10px', borderRadius:'8px' }}><EmojiIcon e="📦" /> {r.supply}</span>}
                            {r.location && <span style={{ background:'#f5f3ff', color:'#6d28d9', fontSize:'11.5px', fontWeight:600, padding:'3px 10px', borderRadius:'8px' }}><EmojiIcon e="📍" /> {r.location}</span>}
                            {days !== null && <span style={{ background: isActive?'#dbeafe':'#f0fdf4', color: isActive?'#1d4ed8':'#166534', fontSize:'11.5px', fontWeight:700, padding:'3px 10px', borderRadius:'8px' }}>{days}d{isActive?' (ongoing)':''}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                          {isActive && (
                            <button onClick={() => {
                              const demobDate = window.prompt('Close assignment as of (YYYY-MM-DD):', new Date().toISOString().slice(0,10));
                              if (demobDate) onRedeploy(r, demobDate);
                            }} style={{ background:'#fff7ed', color:'#c2410c', border:'1px solid #fdba74', fontSize:'11.5px', fontWeight:700, padding:'5px 12px', borderRadius:'8px', cursor:'pointer' }}><EmojiIcon e="🔁" /> Redeploy</button>
                          )}
                          <button onClick={() => onEdit(r)} style={{ ...S.btnSec, fontSize:'14px', padding:'5px 12px' }}>Edit</button>
                          <button onClick={() => onDelete(r.id)} style={{ ...S.iconBtn, color:'#dc2626', fontSize:'16px' }}><EmojiIcon e="🗑️" /></button>
                        </div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                        <div style={{ background:'#f0fdf4', borderRadius:'8px', padding:'10px 12px' }}>
                          <div style={{ fontSize:'10px', color:'#64748b', fontWeight:700, textTransform:'uppercase', marginBottom:'3px' }}>Mobilisation</div>
                          <div style={{ fontSize:'14px', fontWeight:700, color:'#166534' }}>{r.mobilization_date ? fmtDateDisplay(r.mobilization_date) : '—'}</div>
                        </div>
                        <div style={{ background: isActive ? '#fffbeb' : '#fef2f2', borderRadius:'8px', padding:'10px 12px' }}>
                          <div style={{ fontSize:'10px', color:'#64748b', fontWeight:700, textTransform:'uppercase', marginBottom:'3px' }}>Demobilisation</div>
                          <div style={{ fontSize:'14px', fontWeight:700, color: isActive ? '#b45309' : '#991b1b' }}>
                            {r.demobilization_date ? fmtDateDisplay(r.demobilization_date) : 'Still on site'}
                          </div>
                        </div>
                      </div>
                      {r.remarks && (
                        <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b', fontStyle:'italic', borderTop:'1px solid var(--bd3)', paddingTop:'8px' }}><EmojiIcon e="📝" /> {r.remarks}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      // ── LIST VIEW ───────────────────────────────────────────
      return (
        <div>
          {/* Toolbar */}
          <div style={{ display:'flex', gap:'10px', marginBottom:'14px', alignItems:'center', flexWrap:'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by Emp ID, Name or Position…"
              style={{ ...S.input, flex:1, minWidth:'220px', maxWidth:'360px' }} />
            <div style={{ background: missing===0&&total>0 ? '#f0fdf4' : '#fffbeb', border:'1px solid '+(missing===0&&total>0?'#86efac':'#fcd34d'), borderRadius:'8px', padding:'7px 14px', fontSize:'12px', color:missing===0&&total>0?'#166534':'#92400e', fontWeight:600, whiteSpace:'nowrap' }}>
              {missing===0&&total>0 ? '✅' : '⚠️'} {synced}/{total} synced
            </div>
            <button className="hr-btn" onClick={onSyncAll}
              style={{ background:'#0f172a', color:'#fff', border:'none', padding:'9px 16px', borderRadius:'8px', fontSize:'15px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'8px' }}>
              Sync All from Employees
              <span style={{ background:'rgba(255,255,255,0.18)', fontSize:'11px', padding:'2px 8px', borderRadius:'8px' }}>{employees.length}</span>
            </button>
            <button className="hr-btn" style={S.btnPri} onClick={() => onAdd({})}>+ Add Record</button>
          </div>

          {/* Simple employee list — 3 columns only */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
            {/* Header row */}
            <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 1fr', gap:'0', background:'#f8fafc', borderBottom:'2px solid var(--bd1)', padding:'0' }}>
              {['Emp ID','Full Name','Position'].map(h => (
                <div key={h} style={{ ...S.th, padding:'11px 14px', display:'block' }}>{h}</div>
              ))}
            </div>

            {/* Employee rows */}
            {empList.length === 0 ? (
              <div style={{ textAlign:'center', padding:'50px', color:'#94a3b8' }}>
                {employees.length === 0 ? 'No employees found — add employees first' : 'No results match your search'}
              </div>
            ) : (
              empList.map((emp, i) => {
                const empRecs = records.filter(r => r.employee_id === emp.employee_id);
                const activeRec = empRecs.find(r => !r.demobilization_date);
                return (
                  <div key={emp.id} onClick={() => setSelectedMobEmp(emp)}
                    className="hr-row"
                    style={{ display:'grid', gridTemplateColumns:'100px 1fr 1fr', gap:'0', borderTop: i>0 ? '1px solid #f1f5f9' : 'none', cursor:'pointer', background: activeRec ? '#f0fdf4' : 'transparent', transition:'background 0.1s' }}>
                    <div style={{ ...S.td, padding:'13px 14px', fontFamily:'ui-monospace,monospace', fontWeight:700, color:'#2563eb', fontSize:'12.5px' }}>
                      {emp.employee_id}
                    </div>
                    <div style={{ ...S.td, padding:'13px 14px', display:'flex', flexDirection:'column', gap:'3px' }}>
                      <span style={{ fontWeight:600, color:'#0f172a', fontSize:'13px' }}>{emp.full_name}</span>
                      <div style={{ display:'flex', gap:'5px', alignItems:'center' }}>
                        {empRecs.length > 0 && (
                          <span style={{ background:'#f0f9ff', color:'#0369a1', fontSize:'10.5px', fontWeight:600, padding:'1px 7px', borderRadius:'8px' }}>
                            {empRecs.length} assignment{empRecs.length!==1?'s':''}
                          </span>
                        )}
                        {activeRec && <span style={{ background:'#dcfce7', color:'#166534', fontSize:'10.5px', fontWeight:700, padding:'1px 7px', borderRadius:'8px' }}>Active</span>}
                      </div>
                    </div>
                    <div style={{ ...S.td, padding:'13px 14px', color:'#475569', fontSize:'12.5px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span>{emp.position}</span>
                      <span style={{ color:'#94a3b8', fontSize:'16px' }}>›</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ marginTop:'10px', fontSize:'12px', color:'#64748b' }}>
            {empList.length} employee{empList.length!==1?'s':''} · {records.length} total assignment{records.length!==1?'s':''}
          </div>
        </div>
      );
    }

    // ============ REPORTS ============
    function ReportsView({ alerts, dashboardEmployees, recipients }) {
      const [copied, setCopied] = useState('');

      // Compute missing-data entries across all active employees
      const MISSING_DOC_FIELDS = [
        { key: 'passport_expiry', label: 'Passport Expiry' },
        { key: 'eid_expiry',      label: 'Emirates ID Expiry' },
        { key: 'visa_expiry',     label: 'Visa Expiry' },
        { key: 'insurance_expiry',label: 'Insurance Expiry' },
        { key: 'iloe_expiry',     label: 'ILOE Expiry' },
      ];
      const missingEntries = useMemo(() => {
        const rows = [];
        dashboardEmployees.forEach(emp => {
          const missing = MISSING_DOC_FIELDS.filter(f => !emp[f.key]).map(f => f.label);
          if (missing.length) rows.push({ employee_id: emp.employee_id, full_name: emp.full_name, missing });
        });
        return rows;
      }, [dashboardEmployees]);

      const emailBody = useMemo(() => {
        const hasAlerts  = alerts.length > 0;
        const hasMissing = missingEntries.length > 0;
        if (!hasAlerts && !hasMissing) return `Dear HR Team,\n\nDocument expiry compliance report from SATCO Arabia as of ${new Date().toLocaleDateString('en-GB')}.\n\nAll documents are within compliance thresholds and all employee records are complete — no action required.\n\nBest regards,\nHR Compliance System\nSATCO Arabia`;
        let b = `Dear HR Team,\n\nDocument expiry compliance report from SATCO Arabia as of ${new Date().toLocaleDateString('en-GB')}.\n\n`;
        if (hasAlerts) b += `Expiry alerts: ${alerts.length} item(s) across ${dashboardEmployees.length} active employee(s) require attention.\n`;
        if (hasMissing) b += `Missing data: ${missingEntries.length} employee(s) have incomplete document records — expiry alerts CANNOT be generated for these until data is entered.\n`;
        b += '\n';
        // Standard document expiry sections
        EXPIRY_TYPES.forEach(t => {
          const items = alerts.filter(a => a.type === t.key);
          if (!items.length) return;
          b += `\n===== ${t.label.toUpperCase()} (${items.length}) =====\n`;
          items.forEach(a => {
            const status = a.daysLeft < 0 ? `EXPIRED ${Math.abs(a.daysLeft)} days ago` : `${a.daysLeft} days remaining`;
            b += `• ${a.full_name || '(no name)'} [${a.employee_id || 'N/A'}] — ${fmtDateDisplay(a.expiryDate)} (${status})\n`;
          });
        });
        // Training certificate alerts
        const trainingAlerts = alerts.filter(a => a.type === 'training_cert');
        if (trainingAlerts.length) {
          b += `\n===== TRAINING CERTIFICATES (${trainingAlerts.length}) =====\n`;
          trainingAlerts.forEach(a => {
            const label = a.typeLabel || 'Training Certificate';
            const issuer = a.issuingCompany ? ` [${a.issuingCompany}]` : '';
            const certNo = a.certNo ? ` — Cert: ${a.certNo}` : '';
            const status = a.daysLeft < 0 ? `EXPIRED ${Math.abs(a.daysLeft)} days ago` : `${a.daysLeft} days remaining`;
            b += `• ${a.full_name || '(no name)'} [${a.employee_id || 'N/A'}] — ${label}${issuer}${certNo} — ${fmtDateDisplay(a.expiryDate)} (${status})\n`;
          });
        }
        // ── MISSING DATA SECTION ──
        if (hasMissing) {
          b += `\n\n===== ⚠ MISSING DOCUMENT DATA — ACTION REQUIRED (${missingEntries.length} employee(s)) =====\n`;
          b += `The following employees have one or more expiry dates NOT entered in the system.\n`;
          b += `No alerts can be automatically generated for missing fields — please update these records immediately.\n\n`;
          missingEntries.forEach(r => {
            b += `• ${r.full_name || '(no name)'} [${r.employee_id || 'N/A'}]\n`;
            r.missing.forEach(m => { b += `    – ${m}: NOT ENTERED\n`; });
          });
        }
        b += `\nPlease take necessary action.\n\nBest regards,\nHR Compliance System\nSATCO Arabia`;
        return b;
      }, [alerts, dashboardEmployees, missingEntries]);

      const waBody = useMemo(() => {
        const hasAlerts  = alerts.length > 0;
        const hasMissing = missingEntries.length > 0;
        if (!hasAlerts && !hasMissing) return 'All clear — no expiry alerts and all records complete.';
        const expired  = alerts.filter(a => a.severity === 'expired');
        const critical = alerts.filter(a => a.severity === 'critical');
        const urgent   = alerts.filter(a => a.severity === 'urgent');
        const getLabel = (a) => a.typeLabel || (a.type === 'training_cert' ? 'Training Cert' : a.type);
        let m = `*HR Compliance Alert*\nSATCO Arabia\n${new Date().toLocaleDateString('en-GB')}\n\n`;
        if (hasAlerts)  m += `Expiry alerts: ${alerts.length} | Expired: ${expired.length} | Critical (≤7d): ${critical.length} | Urgent (≤30d): ${urgent.length}\n`;
        if (hasMissing) m += `⚠ Missing data: ${missingEntries.length} employee(s)\n`;
        m += '\n';
        if (expired.length) {
          m += `*🔴 EXPIRED — Immediate Action Required:*\n`;
          expired.slice(0, 15).forEach(a => { m += `• ${a.full_name} [${a.employee_id}] — ${getLabel(a)} — ${fmtDateDisplay(a.expiryDate)} (${Math.abs(a.daysLeft)}d overdue)\n`; });
          m += '\n';
        }
        if (critical.length) {
          m += `*🟠 CRITICAL (expires within 7 days):*\n`;
          critical.slice(0, 15).forEach(a => { m += `• ${a.full_name} [${a.employee_id}] — ${getLabel(a)} — ${fmtDateDisplay(a.expiryDate)} (${a.daysLeft}d left)\n`; });
          m += '\n';
        }
        if (urgent.length) {
          m += `*🟡 URGENT (expires within 30 days):*\n`;
          urgent.slice(0, 15).forEach(a => { m += `• ${a.full_name} [${a.employee_id}] — ${getLabel(a)} — ${fmtDateDisplay(a.expiryDate)} (${a.daysLeft}d left)\n`; });
          m += '\n';
        }
        if (hasMissing) {
          m += `*📋 MISSING DATA — Cannot generate alerts:*\n`;
          missingEntries.slice(0, 15).forEach(r => {
            m += `• ${r.full_name} [${r.employee_id}] — ${r.missing.join(', ')}\n`;
          });
          if (missingEntries.length > 15) m += `  …and ${missingEntries.length - 15} more\n`;
          m += '\n';
        }
        m += `Please take necessary action.\nHR Compliance System — SATCO Arabia`;
        return m;
      }, [alerts, missingEntries]);

      const totalIssues = alerts.length + missingEntries.length;
      const subject = `HR Compliance: ${alerts.length} expiry alert(s)${missingEntries.length > 0 ? `, ${missingEntries.length} missing record(s)` : ''} — ${new Date().toLocaleDateString('en-GB')}`;
      const copy = (t,l) => { navigator.clipboard.writeText(t); setCopied(l); setTimeout(()=>setCopied(''),2000); };
      const downloadXlsx = () => { const wb=XLSX.utils.book_new(); const rows=alerts.map(a=>({'Employee ID':a.employee_id,'Full Name':a.full_name,Document:a.typeLabel,'Expiry Date':fmtDateISO(a.expiryDate),'Days Remaining':a.daysLeft,Severity:a.severity,Email:a.email,Mobile:a.mobile})); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Alerts'); XLSX.writeFile(wb,`alerts_${new Date().toISOString().slice(0,10)}.xlsx`); };
      return (
        <div>
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'18px', marginBottom:'14px' }}>
            <h3 style={{ margin:'0 0 10px', fontSize:'14px' }}>Report Summary</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {alerts.length === 0 && missingEntries.length === 0
                ? <div style={{ fontSize:'13px', color:'#166534', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'10px 14px' }}>✅ All clear — no expiring documents and all employee records are complete.</div>
                : <>
                  {alerts.length > 0 && (
                    <div style={{ fontSize:'13px', color:'#475569' }}>
                      <strong>{alerts.length}</strong> expiry alert(s) across <strong>{dashboardEmployees.length}</strong> active employee(s).{' '}
                      {recipients.length > 0 ? <span>Sending to <strong>{recipients.length}</strong> recipient(s).</span> : <span style={{ color:'#dc2626' }}>No recipients set — add them in Settings.</span>}
                    </div>
                  )}
                  {missingEntries.length > 0 && (
                    <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'8px', padding:'10px 14px' }}>
                      <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'6px' }}><EmojiIcon e="⚠️" /> {missingEntries.length} employee(s) have missing expiry date entries — included in email below
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                        {missingEntries.map(r => (
                          <div key={r.employee_id} style={{ fontSize:'12px', color:'#78350f' }}>
                            <strong>{r.full_name}</strong> [{r.employee_id}] — missing: {r.missing.join(', ')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              }
            </div>
          </div>
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'18px', marginBottom:'14px' }}>
            <h3 style={{ margin:'0 0 10px', fontSize:'14px' }}>Download Report</h3>
            <button className="hr-btn" style={S.btnSec} onClick={downloadXlsx}>Download Excel</button>
          </div>
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'18px', marginBottom:'14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px', flexWrap:'wrap', gap:'8px' }}>
              <h3 style={{ margin:0, fontSize:'14px' }}><EmojiIcon e="✉️" /> Email Draft</h3>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                <button className="hr-btn" style={S.btnSec} onClick={()=>copy(emailBody,'email')}><EmojiLabel text={copied==='email'?'✓ Copied!':'Copy Body'} /></button>
                <a className="hr-btn" style={{ ...S.btnPri, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'6px' }}
                  href={`mailto:${recipients.map(r=>r.email).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`}><EmojiIcon e="📨" /> Open in Email App</a>
              </div>
            </div>
            <div style={{ fontSize:'11.5px', color:'#64748b', background:'#f8fafc', padding:'10px 12px', borderRadius:'6px', marginBottom:'10px', lineHeight:1.7 }}>
              <div><strong>Subject:</strong> {subject}</div>
              <div style={{ marginTop:'4px' }}>
                <strong>To:</strong>{' '}
                {recipients.length
                  ? recipients.map((r,i) => (
                    <span key={r.id}>
                      {i>0&&', '}
                      <span style={{ background:'#eff6ff', color:'#1e40af', padding:'1px 7px', borderRadius:'10px', fontSize:'11px', fontWeight:600 }}>
                        {r.name||r.email}
                      </span>
                    </span>
                  ))
                  : <span style={{ color:'#dc2626' }}><EmojiIcon e="⚠" /> No recipients — add them in Settings first</span>
                }
              </div>
            </div>
            {recipients.length > 0 && (
              <div style={{ marginBottom:'10px', padding:'10px 12px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
                <div style={{ fontSize:'12px', color:'#166534' }}><EmojiIcon e="📬" /> Ready to send to<strong>{recipients.length}</strong> recipient{recipients.length!==1?'s':''}: {recipients.map(r=>r.name||r.email).join(', ')}
                </div>
                {totalIssues > 0 ? (
                  <a className="hr-btn" style={{ ...S.btnPri, textDecoration:'none', background:'#059669', whiteSpace:'nowrap', fontSize:'12.5px' }}
                    href={`mailto:${recipients.map(r=>r.email).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`}><EmojiIcon e="🚀" /> Send Now</a>
                ) : (
                  <span style={{ fontSize:'12px', color:'#166534', fontStyle:'italic', display:'flex', alignItems:'center', gap:'4px' }}><EmojiIcon e="✅" /> All documents compliant — no email needed today</span>
                )}
              </div>
            )}
            <textarea readOnly value={emailBody} style={{ width:'100%', minHeight:'280px', padding:'10px', border:'1px solid var(--bd1)', borderRadius:'6px', fontFamily:'monospace', fontSize:'11.5px', background:'#fafbfc' }} />
          </div>
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'18px' }}>
          </div>
        </div>
      );
    }

    // ============ SETTINGS — static strings live OUTSIDE the component ============
    // Kept outside to prevent Babel/JSX from evaluating ${...} inside these strings

    const SETTINGS_SQL_RECIPIENTS = [
      '-- Run this once in Supabase SQL Editor',
      '-- Adds name column to existing recipients table (safe to run even if it exists)',
      "ALTER TABLE recipients ADD COLUMN IF NOT EXISTS name text;",
      "ALTER TABLE recipients ADD COLUMN IF NOT EXISTS role text DEFAULT 'hr';"
    ].join('\n');

    const SETTINGS_SQL_PGCRON = [
      '-- Step 1: Enable pg_cron extension (run once)',
      'CREATE EXTENSION IF NOT EXISTS pg_cron;',
      '',
      '-- Step 2: Schedule daily email at 08:00 UAE time (04:00 UTC)',
      'SELECT cron.schedule(',
      "  'satco-daily-hr-alert',",
      "  '0 4 * * *',",
      '  $$',
      '  SELECT net.http_post(',
      "    url := 'https://oaerqjrkdpuhiproppaz.supabase.co/functions/v1/daily-alert',",
      "    headers := '{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer YOUR_SERVICE_ROLE_KEY\"}'::jsonb,",
      "    body := '{}'::jsonb",
      '  );',
      '  $$',
      ');',
      '',
      '-- To view scheduled jobs:',
      '-- SELECT * FROM cron.job;',
      '',
      "-- To remove: SELECT cron.unschedule('satco-daily-hr-alert');"
    ].join('\n');

    const SETTINGS_EDGE_FN = [
      '// supabase/functions/daily-alert/index.ts',
      '// Deploy: supabase functions deploy daily-alert',
      '',
      "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'",
      '',
      "const SUPABASE_URL = Deno.env.get('SUPABASE_URL')",
      "const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
      "const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')",
      '',
      '// ── helpers ──────────────────────────────────────────────────────────',
      "const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Dubai' }) : '—'",
      "const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Dubai' }) : '—'",
      "const todayUAE = () => new Date(new Date().toLocaleDateString('en-CA', { timeZone:'Asia/Dubai' }))",
      "const daysDiff = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000)",
      '',
      'Deno.serve(async () => {',
      '  const db = createClient(SUPABASE_URL, SERVICE_KEY)',
      '  const today = todayUAE()',
      "  const dateStr = today.toLocaleDateString('en-GB')",
      "  const { data: recips } = await db.from('recipients').select('*')",
      '',
      '  // ════════════════════════════════════════════════════════════════════',
      '  // PART 1 — EMPLOYEE DOCUMENT EXPIRY + MISSING DATA',
      '  // ════════════════════════════════════════════════════════════════════',
      "  const [{ data: emps }, { data: trainings }] = await Promise.all([",
      "    db.from('employees').select('*'),",
      "    db.from('employee_trainings').select('*')",
      '  ])',
      '  const THRESH = { passport:180, eid:60, visa:60, insurance:30, cicpa:15, iloe:30 }',
      '  const COLS   = { passport:"passport_expiry", eid:"eid_expiry", visa:"visa_expiry", insurance:"insurance_expiry", cicpa:"cicpa_expiry", iloe:"iloe_expiry" }',
      '  const LBLS   = { passport:"Passport", eid:"Emirates ID", visa:"Visa", insurance:"Insurance", cicpa:"CICPA Gate Pass", iloe:"ILOE" }',
      '  const MISSING_COLS = [',
      '    { col:"passport_expiry",  label:"Passport Expiry" },',
      '    { col:"eid_expiry",       label:"Emirates ID Expiry" },',
      '    { col:"visa_expiry",      label:"Visa Expiry" },',
      '    { col:"insurance_expiry", label:"Insurance Expiry" },',
      '    { col:"iloe_expiry",      label:"ILOE Expiry" },',
      '  ]',
      '  const TRAINING_THRESH = 30',
      '  const hits = [], missing = []',
      '',
      '  for (const emp of (emps || [])) {',
      '    for (const [k, days] of Object.entries(THRESH)) {',
      '      const val = emp[COLS[k]]; if (!val) continue',
      '      const exp = new Date(val); exp.setHours(0,0,0,0)',
      '      const d = Math.round((exp - today) / 86400000)',
      '      if (d <= days) hits.push({ name:emp.full_name, id:emp.employee_id, doc:LBLS[k], d })',
      '    }',
      '    const mf = MISSING_COLS.filter(f => !emp[f.col]).map(f => f.label)',
      '    if (mf.length) missing.push({ name:emp.full_name, id:emp.employee_id, fields:mf })',
      '  }',
      '  for (const tr of (trainings || [])) {',
      "    let parsed = {}; try { parsed = JSON.parse(tr.training_records || '{}') } catch {}",
      '    for (const [key, rec] of Object.entries(parsed)) {',
      "      if (key === '__other' || !rec?.expiry) continue",
      '      const exp = new Date(rec.expiry); exp.setHours(0,0,0,0)',
      '      const d = Math.round((exp - today) / 86400000)',
      "      if (d <= TRAINING_THRESH) hits.push({ name:tr.full_name, id:tr.employee_id, doc:rec.courseName||key, d })",
      '    }',
      "    for (const ot of (parsed.__other || [])) {",
      '      if (!ot.expiry) continue',
      '      const exp = new Date(ot.expiry); exp.setHours(0,0,0,0)',
      '      const d = Math.round((exp - today) / 86400000)',
      "      if (d <= TRAINING_THRESH) hits.push({ name:tr.full_name, id:tr.employee_id, doc:ot.courseName||ot.label||'Training Cert', d })",
      '    }',
      '  }',
      '',
      '  // ════════════════════════════════════════════════════════════════════',
      '  // PART 2 — HIRING PIPELINE ALERTS (4 types)',
      '  // ════════════════════════════════════════════════════════════════════',
      "  const { data: pipeline } = await db.from('hiring_pipeline').select('*')",
      '  const pipelineAlerts = []',
      '',
      '  for (const c of (pipeline || [])) {',
      '    const name = c.full_name || c.candidate_name || "Unknown"',
      '    const tid  = c.temp_employee_id || c.id',
      '    const pos  = c.position || c.job_title || ""',
      '',
      '    // A) Visa expiring <=14 days, not yet arrived',
      '    if (c.visit_visa_expiry_date && !c.date_of_arrival && !c.visa_expiry_alert_sent) {',
      '      const d = daysDiff(c.visit_visa_expiry_date, today)',
      '      if (d >= 0 && d <= 14) {',
      '        pipelineAlerts.push({ id:c.id, flag:"visa_expiry_alert_sent", section:"VISA EXPIRY WARNING",',
      '          line: name + " [" + tid + "] — Visit visa expires in " + d + "d (" + fmtDate(c.visit_visa_expiry_date) + ")" })',
      '      }',
      '    }',
      '',
      '    // B) 7 days since visa issued, no ticket booked',
      '    if (c.visit_visa_issue_date && !c.ticket_depart_datetime && !c.ticket_reminder_sent) {',
      '      const d = daysDiff(today, c.visit_visa_issue_date)',
      '      if (d === 7) {',
      '        pipelineAlerts.push({ id:c.id, flag:"ticket_reminder_sent", section:"TICKET NOT BOOKED (7d since visa)",',
      '          line: name + " [" + tid + "] " + pos + " — Visa issued " + fmtDate(c.visit_visa_issue_date) + ", no ticket booked yet" })',
      '      }',
      '    }',
      '',
      '    // C) 2 days before departure — AIRPORT PICKUP',
      '    if (c.ticket_depart_datetime && !c.pickup_alert_sent) {',
      '      const d = daysDiff(c.ticket_depart_datetime, today)',
      '      if (d === 2) {',
      '        const airport = (c.ticket_to_airport || "AUH") + (c.ticket_to_terminal ? " T/" + c.ticket_to_terminal : "")',
      '        const flight  = (c.ticket_flight_no || "") + (c.ticket_pnr ? " · PNR: " + c.ticket_pnr : "")',
      '        const route   = (c.ticket_from_city || c.ticket_from_airport || "?") + " → " + (c.ticket_to_city || c.ticket_to_airport || "AUH")',
      '        const line    = name + " [" + tid + "] | " + pos + "\\n"',
      '                      + "  Flight:  " + flight + "\\n"',
      '                      + "  Route:   " + route + "\\n"',
      '                      + "  Arrives: " + airport + " on " + fmtDate(c.ticket_arrive_datetime) + " at " + fmtTime(c.ticket_arrive_datetime) + " (UAE time)\\n"',
      '                      + "  ➜ Please arrange driver for airport pickup."',
      '        pipelineAlerts.push({ id:c.id, flag:"pickup_alert_sent", section:"AIRPORT PICKUP — DEPARTURE IN 2 DAYS", line })',
      '      }',
      '    }',
      '',
      '    // D) 22 days after arrival, not yet Joined',
      '    if (c.date_of_arrival && !c.post_arrival_alert_sent) {',
      '      const d = daysDiff(today, c.date_of_arrival)',
      '      if (d === 22) {',
      '        const deadline = new Date(c.date_of_arrival); deadline.setDate(deadline.getDate() + 30)',
      '        pipelineAlerts.push({ id:c.id, flag:"post_arrival_alert_sent", section:"RESIDENCE VISA URGENCY (Day 22 — 8 days left)",',
      '          line: name + " [" + tid + "] " + pos + " — Arrived " + fmtDate(c.date_of_arrival) + ", deadline " + fmtDate(deadline.toISOString()) })',
      '      }',
      '    }',
      '  }',
      '',
      '  // Mark flags so alerts only send once',
      '  for (const pa of pipelineAlerts) {',
      '    await db.from(\'hiring_pipeline\').update({ [pa.flag]: true }).eq(\'id\', pa.id)',
      '  }',
      '',
      '  // ════════════════════════════════════════════════════════════════════',
      '  // PART 3 — RECYCLE BIN: 2-day purge warning + 30-day auto-purge',
      '  // ════════════════════════════════════════════════════════════════════',
      '  const RECYCLE_TABLES = [',
      '    { table: "employees",          name: "full_name" },',
      '    { table: "mob_demob",          name: "full_name" },',
      '    { table: "employee_contacts",  name: "full_name" },',
      '    { table: "employee_trainings", name: "full_name" },',
      '    { table: "hiring_pipeline",    name: "full_name" },',
      '    { table: "recipients",         name: "name" },',
      '    { table: "job_vacancies",      name: "title" },',
      '    { table: "job_applications",   name: "applicant_name" },',
      '  ]',
      '  const purgeWarnings = [], purgedRows = []',
      '  for (const rt of RECYCLE_TABLES) {',
      '    let rows = []',
      '    try {',
      "      const res = await db.from(rt.table).select('*').not('deleted_at', 'is', null)",
      '      rows = res.data || []',
      '    } catch (e) { continue } // table/columns not migrated yet — skip quietly',
      '    for (const row of rows) {',
      '      if (!row.deleted_at) continue',
      '      const d = daysDiff(today, row.deleted_at)',
      '      const label = row[rt.name] || row.candidate_name || row.email || ("#" + row.id)',
      '      if (d >= 30) {',
      '        await db.from(rt.table).delete().eq("id", row.id)',
      "        await db.from('audit_log').insert({ actor_email: 'system', table_name: rt.table, record_id: String(row.id), record_label: label, action: 'purge', details: 'Auto-purged after 30 days in Recycle Bin' })",
      '        purgedRows.push(rt.table + ": " + label)',
      '      } else if (d >= 28 && !row.purge_warned_at) {',
      '        await db.from(rt.table).update({ purge_warned_at: new Date().toISOString() }).eq("id", row.id)',
      '        purgeWarnings.push(rt.table + ": " + label + " (deleted " + fmtDate(row.deleted_at) + " by " + (row.deleted_by || "unknown") + ") — permanently purges in " + (30 - d) + "d")',
      '      }',
      '    }',
      '  }',
      '',
      '  // ════════════════════════════════════════════════════════════════════',
      '  // PART 4 — BUILD EMAIL & SEND',
      '  // ════════════════════════════════════════════════════════════════════',
      '  const hasAnything = hits.length || missing.length || pipelineAlerts.length || purgeWarnings.length || purgedRows.length',
      "  if (!hasAnything) return new Response('No alerts today', { status: 200 })",
      '',
      '  // Group pipeline alerts by section for clean output',
      '  const sections = {}',
      '  for (const pa of pipelineAlerts) {',
      '    if (!sections[pa.section]) sections[pa.section] = []',
      '    sections[pa.section].push(pa.line)',
      '  }',
      '',
      '  let emailBody = "SATCO Arabia — Daily HR Alert\\n" + dateStr + "\\n" + "=".repeat(50) + "\\n\\n"',
      '',
      '  // Pipeline section first (most urgent)',
      '  if (pipelineAlerts.length) {',
      '    emailBody += "HIRING PIPELINE ALERTS (" + pipelineAlerts.length + ")\\n" + "-".repeat(40) + "\\n"',
      '    for (const [sec, lines] of Object.entries(sections)) {',
      '      emailBody += "\\n" + sec + ":\\n"',
      '      lines.forEach(l => { emailBody += l + "\\n" })',
      '    }',
      '    emailBody += "\\n"',
      '  }',
      '',
      '  // Employee compliance section',
      '  if (hits.length || missing.length) {',
      '    emailBody += "EMPLOYEE COMPLIANCE ALERTS\\n" + "-".repeat(40) + "\\n"',
      '    const ovd  = hits.filter(h => h.d < 0)',
      '    const crit = hits.filter(h => h.d >= 0 && h.d <= 7)',
      '    const urg  = hits.filter(h => h.d > 7)',
      '    if (ovd.length)  { emailBody += "\\nEXPIRED (" + ovd.length + "):\\n";   ovd.forEach(h  => { emailBody += "- " + h.name + " [" + h.id + "] — " + h.doc + " EXPIRED " + Math.abs(h.d) + "d ago\\n" }) }',
      '    if (crit.length) { emailBody += "\\nCRITICAL (" + crit.length + "):\\n"; crit.forEach(h => { emailBody += "- " + h.name + " [" + h.id + "] — " + h.doc + " in " + h.d + "d\\n" }) }',
      '    if (urg.length)  { emailBody += "\\nURGENT (" + urg.length + "):\\n";   urg.forEach(h  => { emailBody += "- " + h.name + " [" + h.id + "] — " + h.doc + " in " + h.d + "d\\n" }) }',
      '    if (missing.length) {',
      '      emailBody += "\\n===== MISSING DOCUMENT DATA (" + missing.length + " employee(s)) =====\\n"',
      '      missing.forEach(r => {',
      '        emailBody += "• " + r.name + " [" + r.id + "]\\n"',
      '        r.fields.forEach(f => { emailBody += "    – " + f + ": NOT ENTERED\\n" })',
      '      })',
      '    }',
      '  }',
      '',
      '  // Recycle bin section',
      '  if (purgeWarnings.length) {',
      '    emailBody += "\\n===== RECYCLE BIN — PURGING IN 2 DAYS (" + purgeWarnings.length + ") =====\\n"',
      '    emailBody += "These deleted records will be PERMANENTLY removed in 2 days unless restored from the Recycle Bin:\\n"',
      '    purgeWarnings.forEach(w => { emailBody += "- " + w + "\\n" })',
      '  }',
      '  if (purgedRows.length) {',
      '    emailBody += "\\n===== RECYCLE BIN — AUTO-PURGED TODAY (" + purgedRows.length + ") =====\\n"',
      '    purgedRows.forEach(w => { emailBody += "- " + w + "\\n" })',
      '  }',
      '',
      '  emailBody += "\\nPlease take necessary action.\\nSATCO Arabia HR System"',
      '',
      '  // Subject line — most urgent alert type first',
      '  const subjectParts = []',
      '  if (sections["AIRPORT PICKUP — DEPARTURE IN 2 DAYS"]?.length) subjectParts.push(sections["AIRPORT PICKUP — DEPARTURE IN 2 DAYS"].length + " airport pickup(s)")',
      '  if (sections["VISA EXPIRY WARNING"]?.length)                   subjectParts.push(sections["VISA EXPIRY WARNING"].length + " visa expiry warning(s)")',
      '  if (sections["RESIDENCE VISA URGENCY (Day 22 — 8 days left)"]?.length) subjectParts.push("post-arrival urgency")',
      '  if (sections["TICKET NOT BOOKED (7d since visa)"]?.length)    subjectParts.push(sections["TICKET NOT BOOKED (7d since visa)"].length + " ticket reminder(s)")',
      '  if (hits.length)    subjectParts.push(hits.length + " compliance expiry")',
      '  if (missing.length) subjectParts.push(missing.length + " missing record(s)")',
      '  if (purgeWarnings.length) subjectParts.push(purgeWarnings.length + " recycle bin purge warning(s)")',
      '  const subject = "HR Alert: " + subjectParts.join(" | ") + " — " + dateStr',
      '',
      '  // Send email',
      '  if (recips?.length && RESEND_KEY) {',
      "    await fetch('https://api.resend.com/emails', {",
      "      method: 'POST',",
      '      headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },',
      '      body: JSON.stringify({',
      '        from: "HR Compliance <info@satcoarabiaengg.com>",',
      '        to: recips.map(r => r.email),',
      '        subject,',
      '        text: emailBody',
      '      })',
      '    })',
      '  }',
      '',
      '  const sentTo = recips?.length ? "email: " + recips.length + " recipient(s)" : "no recipients configured"',
      '  return new Response("Sent via " + sentTo, { status: 200 })',
      '})'
    ].join('\n');

    const SETTINGS_SQL_AUDIT_RECYCLE = [
      '-- Run this once in Supabase SQL Editor',
      '-- Creates the audit log table + recycle-bin (soft-delete) columns',
      '',
      '-- 1) Activity log -- records who changed what, and when',
      'CREATE TABLE IF NOT EXISTS audit_log (',
      '  id bigint generated always as identity primary key,',
      '  created_at timestamptz DEFAULT now(),',
      '  actor_email text,',
      '  table_name text,',
      '  record_id text,',
      '  record_label text,',
      "  action text, -- 'create' | 'update' | 'delete' | 'restore' | 'purge'",
      '  details text',
      ');',
      'ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;',
      'DROP POLICY IF EXISTS "audit_log_all" ON audit_log;',
      'CREATE POLICY "audit_log_all" ON audit_log FOR ALL USING (true) WITH CHECK (true);',
      'CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);',
      '',
      '-- 2) Recycle bin -- deleted rows are flagged, not removed, for 30 days',
      "ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_by text;",
      "ALTER TABLE employees ADD COLUMN IF NOT EXISTS purge_warned_at timestamptz;",
      "ALTER TABLE mob_demob ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE mob_demob ADD COLUMN IF NOT EXISTS deleted_by text;",
      "ALTER TABLE mob_demob ADD COLUMN IF NOT EXISTS purge_warned_at timestamptz;",
      "ALTER TABLE employee_contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE employee_contacts ADD COLUMN IF NOT EXISTS deleted_by text;",
      "ALTER TABLE employee_contacts ADD COLUMN IF NOT EXISTS purge_warned_at timestamptz;",
      "ALTER TABLE employee_trainings ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE employee_trainings ADD COLUMN IF NOT EXISTS deleted_by text;",
      "ALTER TABLE employee_trainings ADD COLUMN IF NOT EXISTS purge_warned_at timestamptz;",
      "ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS deleted_by text;",
      "ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS purge_warned_at timestamptz;",
      "ALTER TABLE recipients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE recipients ADD COLUMN IF NOT EXISTS deleted_by text;",
      "ALTER TABLE recipients ADD COLUMN IF NOT EXISTS purge_warned_at timestamptz;",
      "ALTER TABLE job_vacancies ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE job_vacancies ADD COLUMN IF NOT EXISTS deleted_by text;",
      "ALTER TABLE job_vacancies ADD COLUMN IF NOT EXISTS purge_warned_at timestamptz;",
      "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS deleted_at timestamptz;",
      "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS deleted_by text;",
      "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS purge_warned_at timestamptz;",
      '',
      '-- That is it -- no data is touched. Existing rows just get deleted_at = NULL,',
      '-- meaning "not deleted". Nothing changes until someone clicks Delete.'
    ].join('\n');

    // ============ RECYCLE BIN ============
    const RECYCLE_BIN_TABLES = [
      { table: 'employees',          typeLabel: 'Employee',        name: r => r.full_name },
      { table: 'mob_demob',          typeLabel: 'Mob/Demob',       name: r => r.full_name },
      { table: 'employee_contacts',  typeLabel: 'Contact',         name: r => r.full_name },
      { table: 'employee_trainings', typeLabel: 'Training',        name: r => r.full_name },
      { table: 'hiring_pipeline',    typeLabel: 'Candidate',       name: r => r.full_name || r.candidate_name },
      { table: 'recipients',         typeLabel: 'Alert Recipient', name: r => r.name || r.email },
      { table: 'job_vacancies',      typeLabel: 'Job Vacancy',     name: r => r.title },
      { table: 'job_applications',   typeLabel: 'Job Application', name: r => r.applicant_name || r.full_name },
      { table: 'suppliers',          typeLabel: 'Supplier',        name: r => r.supplier_name },
      { table: 'supplier_employees', typeLabel: 'Supplier Employee', name: r => r.full_name },
    ];

    function RecycleBinView({ user, showToast }) {
      const [rows, setRows] = useState([]);
      const [loading, setLoading] = useState(true);
      const [busyKey, setBusyKey] = useState(null);
      const [migrationMissing, setMigrationMissing] = useState(false);

      const load = async () => {
        setLoading(true);
        let anyOk = false;
        const results = await Promise.all(RECYCLE_BIN_TABLES.map(async t => {
          try {
            const { data, error } = await db.from(t.table).select('*').not('deleted_at', 'is', null);
            if (error) throw error;
            anyOk = true;
            return (data || []).map(row => ({ table: t.table, typeLabel: t.typeLabel, row, label: t.name(row) || ('#' + row.id) }));
          } catch (e) {
            return [];
          }
        }));
        setMigrationMissing(!anyOk);
        const all = results.flat().sort((a, b) => new Date(b.row.deleted_at) - new Date(a.row.deleted_at));
        setRows(all);
        setLoading(false);
      };
      useEffect(() => { load(); }, []);

      const daysLeft = (deletedAt) => {
        const d = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000);
        return Math.max(0, 30 - d);
      };

      const restore = async (item) => {
        const key = item.table + item.row.id;
        setBusyKey(key);
        try {
          await restoreDeletedRow(user, item.table, item.row.id, item.label);
          showToast('✅ Restored: ' + item.label);
          await load();
        } catch (e) {
          showToast('❌ Restore failed: ' + e.message, 'error');
        } finally { setBusyKey(null); }
      };

      const purgeNow = async (item) => {
        if (!window.confirm(`Permanently delete "${item.label}"? This cannot be undone.`)) return;
        const key = item.table + item.row.id;
        setBusyKey(key);
        try {
          await purgeDeletedRow(user, item.table, item.row.id, item.label);
          showToast('🗑️ Permanently deleted: ' + item.label);
          await load();
        } catch (e) {
          showToast('❌ Delete failed: ' + e.message, 'error');
        } finally { setBusyKey(null); }
      };

      if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'40vh', flexDirection:'column', gap:'16px' }}><div className="spinner"></div><div style={{ color:'#64748b' }}>Loading Recycle Bin…</div></div>;

      return (
        <div>
          {migrationMissing && (
            <div style={{ marginBottom:'14px', padding:'12px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'12.5px', color:'#991b1b' }}>
              <EmojiIcon e="⚠️" /> The Recycle Bin isn't set up yet on this database — go to <strong>Settings → Activity Log &amp; Recycle Bin Setup</strong> and run the SQL script. Until then, deletes are permanent.
            </div>
          )}
          {!migrationMissing && (
            <div style={{ marginBottom:'14px', padding:'12px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', fontSize:'12.5px', color:'#92400e' }}>
              <EmojiIcon e="🗑️" /> Deleted records stay here for 30 days before being permanently removed. 
            </div>
          )}
          {rows.length === 0 ? (
            <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'40px', textAlign:'center', color:'#64748b' }}>
              <div style={{ fontSize:'40px', marginBottom:'10px' }}>🗑️</div>
              <div style={{ fontSize:'15px', fontWeight:700, color:'#334155', marginBottom:'4px' }}>Recycle Bin is empty</div>
              <div style={{ fontSize:'13px' }}>Nothing has been deleted recently.</div>
            </div>
          ) : (
            <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
              <div className="xl-wrap hr-scroll" style={{ maxHeight:'none' }}>
              <table style={{ width:'100%', minWidth:'720px', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Name</th>
                    <th style={S.th}>Deleted By</th>
                    <th style={S.th}>Deleted On</th>
                    <th style={S.th}>Purges In</th>
                    <th style={{ ...S.th, textAlign:'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(item => {
                    const key = item.table + item.row.id;
                    const dl = daysLeft(item.row.deleted_at);
                    const busy = busyKey === key;
                    return (
                      <tr key={key} style={{ borderTop:'1px solid var(--bd1)' }}>
                        <td style={S.td}><span style={{ fontSize:'11px', fontWeight:700, color:'#475569', background:'#f1f5f9', padding:'2px 8px', borderRadius:'6px' }}>{item.typeLabel}</span></td>
                        <td style={{ ...S.td, fontWeight:600 }}>{item.label}</td>
                        <td style={S.td}>{item.row.deleted_by || 'unknown'}</td>
                        <td style={S.td}>{fmtDateDisplay ? fmtDateDisplay(item.row.deleted_at) : new Date(item.row.deleted_at).toLocaleDateString('en-GB')}</td>
                        <td style={S.td}><span style={{ fontSize:'11.5px', fontWeight:700, color: dl <= 2 ? '#dc2626' : '#166534' }}>{dl}d</span></td>
                        <td style={{ ...S.td, textAlign:'right' }}>
                          <button disabled={busy} onClick={() => restore(item)} style={{ ...S.btnSec, fontSize:'11px', padding:'5px 10px', marginRight:'6px', opacity: busy?0.6:1 }}>{busy?'…':'Restore'}</button>
                          <button disabled={busy} onClick={() => purgeNow(item)} style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', padding:'5px 10px', borderRadius:'6px', fontSize:'11px', fontWeight:700, cursor:'pointer', opacity: busy?0.6:1 }}>{busy?'…':'Delete Permanently'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ============ ACTIVITY LOG ============
    function ActivityLogView() {
      const [rows, setRows] = useState([]);
      const [loading, setLoading] = useState(true);
      const [missing, setMissing] = useState(false);
      const [actorFilter, setActorFilter] = useState('all');
      const [tableFilter, setTableFilter] = useState('all');

      const load = async () => {
        setLoading(true);
        try {
          const { data, error } = await db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500);
          if (error) throw error;
          setRows(data || []);
          setMissing(false);
        } catch (e) {
          setRows([]);
          setMissing(true);
        }
        setLoading(false);
      };
      useEffect(() => { load(); }, []);

      const actors = useMemo(() => Array.from(new Set(rows.map(r => r.actor_email).filter(Boolean))).sort(), [rows]);
      const tables = useMemo(() => Array.from(new Set(rows.map(r => r.table_name).filter(Boolean))).sort(), [rows]);
      const filtered = useMemo(() => rows.filter(r =>
        (actorFilter === 'all' || r.actor_email === actorFilter) &&
        (tableFilter === 'all' || r.table_name === tableFilter)
      ), [rows, actorFilter, tableFilter]);

      const actionStyle = {
        create:  { bg:'#dcfce7', co:'#166534' },
        update:  { bg:'#dbeafe', co:'#1e40af' },
        delete:  { bg:'#fef3c7', co:'#92400e' },
        restore: { bg:'#e0e7ff', co:'#3730a3' },
        purge:   { bg:'#fee2e2', co:'#991b1b' },
      };

      if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'40vh', flexDirection:'column', gap:'16px' }}><div className="spinner"></div><div style={{ color:'#64748b' }}>Loading Activity Log…</div></div>;

      if (missing) return (
        <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'40px', textAlign:'center', color:'#64748b' }}>
          <div style={{ fontSize:'40px', marginBottom:'10px' }}>📋</div>
          <div style={{ fontSize:'15px', fontWeight:700, color:'#334155', marginBottom:'4px' }}>Activity Log isn't set up yet</div>
          <div style={{ fontSize:'13px' }}>Go to <strong>Settings → Activity Log &amp; Recycle Bin Setup</strong> and run the SQL script to start tracking who changes what.</div>
        </div>
      );

      return (
        <div>
          <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
            <select value={actorFilter} onChange={e=>setActorFilter(e.target.value)} style={{ padding:'8px 12px', borderRadius:'6px', border:'1px solid var(--bd1)', fontSize:'12.5px' }}>
              <option value="all">All team members</option>
              {actors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={tableFilter} onChange={e=>setTableFilter(e.target.value)} style={{ padding:'8px 12px', borderRadius:'6px', border:'1px solid var(--bd1)', fontSize:'12.5px' }}>
              <option value="all">All sections</option>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ marginLeft:'auto', fontSize:'12px', color:'#64748b', alignSelf:'center' }}>{filtered.length} of {rows.length} entries · last 500</div>
          </div>
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', overflow:'hidden' }}>
            <div className="xl-wrap hr-scroll" style={{ maxHeight:'none' }}>
            <table style={{ width:'100%', minWidth:'760px', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  <th style={S.th}>When</th>
                  <th style={S.th}>Who</th>
                  <th style={S.th}>Action</th>
                  <th style={S.th}>Section</th>
                  <th style={S.th}>Record</th>
                  <th style={S.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = actionStyle[r.action] || { bg:'#f1f5f9', co:'#475569' };
                  return (
                    <tr key={r.id} style={{ borderTop:'1px solid var(--bd1)' }}>
                      <td style={{ ...S.td, whiteSpace:'nowrap' }}>{new Date(r.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                      <td style={S.td}>{r.actor_email}</td>
                      <td style={S.td}><span style={{ fontSize:'11px', fontWeight:700, color:st.co, background:st.bg, padding:'2px 9px', borderRadius:'6px', textTransform:'capitalize' }}>{r.action}</span></td>
                      <td style={S.td}>{r.table_name}</td>
                      <td style={{ ...S.td, fontWeight:600 }}>{r.record_label || r.record_id}</td>
                      <td style={{ ...S.td, whiteSpace:'normal', color:'#64748b', fontSize:'12px' }}>{r.details}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan="6" style={{ ...S.td, textAlign:'center', color:'#94a3b8', padding:'30px' }}>No activity matches these filters yet.</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      );
    }

    // ============ SETTINGS ============
    function SettingsView({ thresholds, setThresholds, recipients, onAddRecipient, onDeleteRecipient, employeeCount }) {
      const [local, setLocal] = useState(thresholds);
      const [newRecip, setNewRecip] = useState({ name:'', role:'hr', email:'' });
      const [copiedSql, setCopiedSql] = useState('');

      const addRecip = () => {
        const e = (newRecip.email||'').trim();
        if (!e) return window.alert('Email is required');
        if (!/^[^@]+@[^@]+\.[^@]+$/.test(e)) return window.alert('Invalid email address');
        onAddRecipient({ name: newRecip.name.trim(), role: newRecip.role, email: e });
        setNewRecip({ name:'', role:'hr', email:'' });
      };

      const roleColors = { hr:'#dbeafe:#1e40af', manager:'#dcfce7:#166534', ceo:'#fef3c7:#92400e', admin:'#f3e8ff:#6b21a8', other:'#f1f5f9:#475569' };
      const getRoleStyle = (role) => { const [bg,co]=(roleColors[role]||roleColors.other).split(':'); return { background:bg, color:co }; };

      const copySql = (key, text) => { navigator.clipboard.writeText(text); setCopiedSql(key); setTimeout(()=>setCopiedSql(''),2500); };

      return (
        <div className="settings-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>

          {/* Alert Thresholds */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'20px' }}>
            <h3 style={{ margin:'0 0 4px', fontSize:'14px' }}><EmojiIcon e="⏱" /> Alert Thresholds</h3>
            <p style={{ margin:'0 0 14px', fontSize:'12px', color:'#64748b' }}>Days in advance to trigger alerts. Applies to this session.</p>
            {EXPIRY_TYPES.map(t=>(
              <div key={t.key} style={{ marginBottom:'12px' }}>
                <label style={{ fontSize:'12.5px', color:'#475569', fontWeight:600, display:'block', marginBottom:'6px' }}>{t.label}</label>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <input type="number" min="1" max="365" value={local[t.key]} onChange={e=>setLocal({...local,[t.key]:Math.max(1,Math.min(365,parseInt(e.target.value)||1))})} style={{ ...S.input, width:'70px' }} />
                  <span style={{ fontSize:'11.5px', color:'#64748b' }}>days</span>
                  <select value={local[t.key]} onChange={e=>setLocal({...local,[t.key]:parseInt(e.target.value)})} style={{ ...S.input, fontSize:'11.5px' }}>{[7,14,30,60,90,120,180,270,365].map(d=><option key={d} value={d}>{d}d preset</option>)}</select>
                </div>
              </div>
            ))}
            <div style={{ marginBottom:'12px' }}>
              <label style={{ fontSize:'12.5px', color:'#0f766e', fontWeight:600, display:'block', marginBottom:'6px' }}><EmojiIcon e="🎓" /> Training Certificates</label>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <input type="number" min="1" max="365" value={local.training_cert||30} onChange={e=>setLocal({...local, training_cert:Math.max(1,Math.min(365,parseInt(e.target.value)||1))})} style={{ ...S.input, width:'70px' }} />
                <span style={{ fontSize:'11.5px', color:'#64748b' }}>days</span>
                <select value={local.training_cert||30} onChange={e=>setLocal({...local, training_cert:parseInt(e.target.value)})} style={{ ...S.input, fontSize:'11.5px' }}>{[7,14,30,60,90,120,180,270,365].map(d=><option key={d} value={d}>{d}d preset</option>)}</select>
              </div>
            </div>
            <button className="hr-btn" style={{ ...S.btnPri, marginTop:'6px' }} onClick={()=>setThresholds(local)}>Apply Thresholds</button>
          </div>

          {/* Email Recipients */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'20px' }}>
            <h3 style={{ margin:'0 0 4px', fontSize:'14px' }}>Email Alert Recipients</h3>
            <p style={{ margin:'0 0 14px', fontSize:'12px', color:'#64748b' }}>People who receive the daily compliance email. Add name and role for easy identification.</p>

            {/* Add form */}
            <div style={{ background:'#f8fafc', border:'1px solid var(--bd1)', borderRadius:'8px', padding:'12px', marginBottom:'14px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                <div>
                  <label style={S.label}>Name</label>
                  <input placeholder="e.g. Zaheer" value={newRecip.name} onChange={e=>setNewRecip(p=>({...p,name:e.target.value}))} style={{ ...S.input, width:'100%' }} />
                </div>
                <div>
                  <label style={S.label}>Role</label>
                  <select value={newRecip.role} onChange={e=>setNewRecip(p=>({...p,role:e.target.value}))} style={{ ...S.input, width:'100%' }}>
                    <option value="hr">HR</option>
                    <option value="manager">Manager</option>
                    <option value="ceo">CEO / Director</option>
                    <option value="admin">Admin</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <div style={{ flex:1 }}>
                  <label style={S.label}>Email <span style={{ color:'#dc2626' }}>*</span></label>
                  <input type="email" placeholder="email@satcoarabia.com" value={newRecip.email} onChange={e=>setNewRecip(p=>({...p,email:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addRecip()} style={{ ...S.input, width:'100%' }} />
                </div>
                <button className="hr-btn" style={{ ...S.btnPri, alignSelf:'flex-end', whiteSpace:'nowrap', padding:'8px 16px' }} onClick={addRecip}>+ Add</button>
              </div>
            </div>

            {/* Recipient list */}
            {recipients.length === 0
              ? <div style={{ padding:'20px', textAlign:'center', color:'#94a3b8', fontSize:'12.5px', border:'1px dashed var(--bd1)', borderRadius:'8px' }}>No recipients yet — add someone above</div>
              : (
                <div>
                  {recipients.map(r => {
                    const rs = getRoleStyle(r.role || 'hr');
                    return (
                      <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', background:'#fff', border:'1px solid var(--bd3)', borderRadius:'8px', marginBottom:'5px' }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'#e0f2fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, color:'#0369a1', flexShrink:0 }}>
                          {(r.name||r.email||'?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
                            <span style={{ fontSize:'13px', fontWeight:600 }}>{r.name || '(no name)'}</span>
                            <span style={{ ...rs, fontSize:'10px', fontWeight:700, padding:'1px 7px', borderRadius:'10px' }}>{(r.role||'hr').toUpperCase()}</span>
                          </div>
                          <span style={{ fontSize:'11.5px', color:'#64748b' }}>{r.email}</span>
                        </div>
                        <button onClick={()=>onDeleteRecipient(r.id)} style={{ ...S.iconBtn, color:'#dc2626' }} title="Remove"></button>
                      </div>
                    );
                  })}
                  <div style={{ marginTop:'10px', padding:'10px 12px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', fontSize:'12px', color:'#166534' }}>{recipients.length} recipient{recipients.length!==1?'s':''} configured — use <strong>Reports &amp; Email</strong> to send alerts.
                  </div>
                </div>
              )
            }
          </div>

          {/* Daily Email Automation Setup */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'20px', gridColumn:'span 2' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'4px' }}>
              <h3 style={{ margin:0, fontSize:'14px' }}>Daily Email Automation Setup</h3>
              <span style={{ background:'#fef3c7', color:'#92400e', fontSize:'10.5px', fontWeight:700, padding:'3px 10px', borderRadius:'10px' }}>One-time setup</span>
            </div>
            <p style={{ margin:'0 0 16px', fontSize:'12px', color:'#64748b' }}>
              Set this up once to receive automatic daily email alerts at 08:00 UAE time. Uses <strong>Resend</strong> (free — 3,000 emails/month) and Supabase's built-in scheduler.
            </p>

            {/* Step 1 */}
            <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', marginBottom:'10px', overflow:'hidden' }}>
              <div style={{ background:'#f8fafc', padding:'10px 14px', borderBottom:'1px solid var(--bd1)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ background:'#2563eb', color:'#fff', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, flexShrink:0 }}>1</span>
                <span style={{ fontSize:'13px', fontWeight:600 }}>Add name column to recipients table</span>
                <button className="hr-btn" onClick={()=>copySql('step1', SETTINGS_SQL_RECIPIENTS)} style={{ ...S.btnSec, fontSize:'11px', padding:'4px 10px', marginLeft:'auto' }}><EmojiLabel text={copiedSql==='step1'?'✓ Copied':'Copy SQL'} /></button>
              </div>
              <div style={{ padding:'10px 14px' }}>
                <p style={{ margin:'0 0 8px', fontSize:'12px', color:'#64748b' }}>Run this in your <strong>Supabase → SQL Editor</strong> to add name/role columns to the existing recipients table:</p>
                <textarea readOnly value={SETTINGS_SQL_RECIPIENTS} style={{ width:'100%', minHeight:'80px', padding:'8px 10px', border:'1px solid var(--bd1)', borderRadius:'6px', fontFamily:'monospace', fontSize:'11px', background:'#fafbfc', color:'#334155', resize:'none' }} />
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', marginBottom:'10px', overflow:'hidden' }}>
              <div style={{ background:'#f8fafc', padding:'10px 14px', borderBottom:'1px solid var(--bd1)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ background:'#2563eb', color:'#fff', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, flexShrink:0 }}>2</span>
                <span style={{ fontSize:'13px', fontWeight:600 }}>Get a free Resend API key</span>
              </div>
              <div style={{ padding:'10px 14px', fontSize:'12px', color:'#475569', lineHeight:1.7 }}>
                <span>Go to </span><a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color:'#2563eb', fontWeight:600 }}>resend.com</a>
                <span> → Sign up free → Create API Key → Copy it. Then in Supabase go to </span>
                <strong>Project Settings → Edge Functions → Secrets</strong>
                <span> and add: </span>
                <code style={{ background:'#f1f5f9', padding:'2px 6px', borderRadius:'4px', fontFamily:'monospace', fontSize:'11px' }}>RESEND_API_KEY = your_key_here</code>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', marginBottom:'10px', overflow:'hidden' }}>
              <div style={{ background:'#f8fafc', padding:'10px 14px', borderBottom:'1px solid var(--bd1)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ background:'#2563eb', color:'#fff', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, flexShrink:0 }}>3</span>
                <span style={{ fontSize:'13px', fontWeight:600 }}>Deploy the Edge Function</span>
                <button className="hr-btn" onClick={()=>copySql('step3', SETTINGS_EDGE_FN)} style={{ ...S.btnSec, fontSize:'11px', padding:'4px 10px', marginLeft:'auto' }}><EmojiLabel text={copiedSql==='step3'?'✓ Copied':'Copy Code'} /></button>
              </div>
              <div style={{ padding:'10px 14px' }}>
                <p style={{ margin:'0 0 8px', fontSize:'12px', color:'#64748b' }}>Create file <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:'3px', fontFamily:'monospace' }}>supabase/functions/daily-alert/index.ts</code> with this code, then run <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:'3px', fontFamily:'monospace' }}>supabase functions deploy daily-alert</code>:</p>
                <textarea readOnly value={SETTINGS_EDGE_FN} style={{ width:'100%', minHeight:'160px', padding:'8px 10px', border:'1px solid var(--bd1)', borderRadius:'6px', fontFamily:'monospace', fontSize:'10.5px', background:'#fafbfc', color:'#334155', resize:'vertical' }} />
              </div>
            </div>

            {/* Step 4 */}
            <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden' }}>
              <div style={{ background:'#f8fafc', padding:'10px 14px', borderBottom:'1px solid var(--bd1)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ background:'#059669', color:'#fff', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, flexShrink:0 }}>4</span>
                <span style={{ fontSize:'13px', fontWeight:600 }}>Schedule it with pg_cron (runs daily at 08:00 UAE)</span>
                <button className="hr-btn" onClick={()=>copySql('step4', SETTINGS_SQL_PGCRON)} style={{ ...S.btnSec, fontSize:'11px', padding:'4px 10px', marginLeft:'auto' }}><EmojiLabel text={copiedSql==='step4'?'✓ Copied':'Copy SQL'} /></button>
              </div>
              <div style={{ padding:'10px 14px' }}>
                <p style={{ margin:'0 0 8px', fontSize:'12px', color:'#64748b' }}>Run this in <strong>Supabase → SQL Editor</strong>. Replace <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:'3px', fontFamily:'monospace' }}>YOUR_SERVICE_ROLE_KEY</code> with your key from Project Settings → API:</p>
                <textarea readOnly value={SETTINGS_SQL_PGCRON} style={{ width:'100%', minHeight:'160px', padding:'8px 10px', border:'1px solid var(--bd1)', borderRadius:'6px', fontFamily:'monospace', fontSize:'10.5px', background:'#fafbfc', color:'#334155', resize:'vertical' }} />
              </div>
            </div>

            <div style={{ marginTop:'12px', padding:'12px 14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px', fontSize:'12px', color:'#1e40af', lineHeight:1.6 }}><EmojiIcon e="💡" /><strong>Once set up:</strong> Every morning at 08:00 UAE time, the system automatically checks all employee document expiries and training certs, builds the alert email, and sends it to all recipients configured above — with zero manual action needed.
            </div>
          </div>

          {/* Activity Log + Recycle Bin Setup */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'20px', gridColumn:'span 2' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'4px' }}>
              <h3 style={{ margin:0, fontSize:'14px' }}><EmojiIcon e="🗂️" /> Activity Log &amp; Recycle Bin Setup</h3>
              <span style={{ background:'#fef3c7', color:'#92400e', fontSize:'10.5px', fontWeight:700, padding:'3px 10px', borderRadius:'10px' }}>One-time setup</span>
            </div>
            <p style={{ margin:'0 0 16px', fontSize:'12px', color:'#64748b' }}>
              With multiple people using the portal, every save/edit/delete is now recorded under <strong>Activity Log</strong> (who did what, and when). Deleted records go to the <strong>Recycle Bin</strong> instead of vanishing — they stay recoverable for 30 days, with an email warning 2 days before they're permanently purged. The app already works without this SQL run (deletes just won't be recoverable yet) — run this once to turn the safety net on.
            </p>
            <div style={{ border:'1px solid var(--bd1)', borderRadius:'8px', overflow:'hidden' }}>
              <div style={{ background:'#f8fafc', padding:'10px 14px', borderBottom:'1px solid var(--bd1)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ background:'#2563eb', color:'#fff', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, flexShrink:0 }}>1</span>
                <span style={{ fontSize:'13px', fontWeight:600 }}>Create audit_log table + recycle-bin columns</span>
                <button className="hr-btn" onClick={()=>copySql('stepAudit', SETTINGS_SQL_AUDIT_RECYCLE)} style={{ ...S.btnSec, fontSize:'11px', padding:'4px 10px', marginLeft:'auto' }}><EmojiLabel text={copiedSql==='stepAudit'?'✓ Copied':'Copy SQL'} /></button>
              </div>
              <div style={{ padding:'10px 14px' }}>
                <p style={{ margin:'0 0 8px', fontSize:'12px', color:'#64748b' }}>Run this once in your <strong>Supabase → SQL Editor</strong>. It only adds a new table and new (nullable) columns — no existing data is touched:</p>
                <textarea readOnly value={SETTINGS_SQL_AUDIT_RECYCLE} style={{ width:'100%', minHeight:'160px', padding:'8px 10px', border:'1px solid var(--bd1)', borderRadius:'6px', fontFamily:'monospace', fontSize:'10.5px', background:'#fafbfc', color:'#334155', resize:'vertical' }} />
              </div>
            </div>
            <div style={{ marginTop:'12px', padding:'12px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', fontSize:'12px', color:'#166534', lineHeight:1.6 }}>
              <EmojiIcon e="💡" /><strong>Also update the daily email function:</strong> after running the SQL above, redeploy the Edge Function from Step 3 (it now includes the recycle-bin warning email + 30-day auto-purge) using the same <code style={{ background:'#dcfce7', padding:'1px 5px', borderRadius:'3px', fontFamily:'monospace' }}>supabase functions deploy daily-alert</code> command.
            </div>
          </div>

          {/* DB Setup */}
          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'20px', gridColumn:'span 2' }}>
            <h3 style={{ margin:'0 0 8px', fontSize:'14px' }}><EmojiIcon e="🛢️" /> DB Setup — Contact Directory &amp; Training Tables</h3>
            <p style={{ margin:'0 0 10px', fontSize:'12px', color:'#64748b' }}>Run these SQL scripts once in your Supabase SQL Editor if the tables don't exist yet.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:'#475569', marginBottom:'6px' }}>employee_contacts table</div>
                <textarea readOnly value={`CREATE TABLE IF NOT EXISTS employee_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text,
  full_name text,
  mobile_uae text,
  mobile_home text,
  email text,
  whatsapp text,
  home_address text,
  uae_address text,
  emergency_name text,
  emergency_relation text,
  emergency_country text,
  emergency_mobile text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employee_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do all" ON employee_contacts
  FOR ALL USING (auth.role() = 'authenticated');`}
                  style={{ width:'100%', minHeight:'200px', padding:'10px', border:'1px solid var(--bd1)', borderRadius:'6px', fontFamily:'monospace', fontSize:'11px', background:'#fafbfc', color:'#334155' }} />
              </div>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:'#475569', marginBottom:'6px' }}>employee_trainings table</div>
                <textarea readOnly value={`CREATE TABLE IF NOT EXISTS employee_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text,
  full_name text,
  position text,
  cicpa_locations text,
  training_records jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emp_trainings_emp_id
  ON employee_trainings(employee_id);
ALTER TABLE employee_trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do all" ON employee_trainings
  FOR ALL USING (auth.role() = 'authenticated');`}
                  style={{ width:'100%', minHeight:'200px', padding:'10px', border:'1px solid var(--bd1)', borderRadius:'6px', fontFamily:'monospace', fontSize:'11px', background:'#fafbfc', color:'#334155' }} />
              </div>

              <div style={{ gridColumn:'span 2' }}>
                <div style={{ fontSize:'11.5px', fontWeight:600, color:'#475569', marginBottom:'8px' }}>🧑‍💼 Hiring Pipeline Table (NEW — run once in Supabase SQL Editor)</div>
                <textarea readOnly value={`CREATE TABLE IF NOT EXISTS hiring_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name text,
  passport_no text,
  nationality text,
  position text,
  department text,
  current_location text,
  phone text,
  email text,
  whatsapp text,
  referred_by text,
  referred_contact text,
  interview_date date,
  interview_type text,
  interviewed_by text,
  interview_score numeric,
  interview_notes text,
  available_from date,
  basic_salary numeric,
  allowance numeric,
  total_salary numeric,
  accommodation text,
  air_ticket text,
  offer_letter_date date,
  offer_accepted_date date,
  offer_status text,
  visa_medical_date date,
  visa_documents_sent_date date,
  visa_stamped_date date,
  expected_arrival_date date,
  status text DEFAULT 'Active',
  step text DEFAULT 'resume',
  step_due_date date,
  resume_url text,
  offer_signed_url text,
  passport_img_url text,
  certificates_url text,
  experience text,
  skills text,
  dob_candidate date,
  passport_expiry_candidate date,
  home_address text,
  marital_status text,
  religion text,
  languages text,
  education text,
  current_employer text,
  current_designation text,
  work_history text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE hiring_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users all" ON hiring_pipeline
  FOR ALL USING (auth.role() = 'authenticated');

-- Run these if upgrading an existing table:
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS experience text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS skills text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS dob_candidate date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS passport_expiry_candidate date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS home_address text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS marital_status text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS religion text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS languages text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS education text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS current_employer text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS current_designation text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS work_history text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS place_of_issue text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS current_location text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS is_supplier_hire text DEFAULT 'no';
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_name text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_contact_name text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_phone text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_whatsapp text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_email text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_address text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS rate_per_hour numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS accommodation_by text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS transport_by text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS food_by text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_notes text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS residence_visa_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visa_cancel_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS work_permit_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS work_permit_ref text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS contract_draft_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS evisa_received_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS entry_permit_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS entry_permit_expiry date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS entry_permit_ref text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS insurance_arranged_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS insurance_policy_no text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS entry_permit_sent_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS arrival_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS medical_fitness_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS medical_fitness_result text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS eid_biometric_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS eid_application_ref text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS contract_registered_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS wps_enrolled_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visa_stamp_applied_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visa_stamped_in_passport_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS passport_returned_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS eid_issued_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS labour_card_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS labour_card_ref text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visa_total_cost numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS hiring_scenario text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visa_arranged_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS status_change_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS position_selected text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS manual_stage text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS pipeline_location text DEFAULT 'pipeline';
-- pipeline_location: 'pipeline' (default, counted in Hiring Pipeline) or 'resume_db'
-- (archived in the Resume Database — On Hold, Not Suitable, or stored for future use).

-- New columns for employees table (auto-populated when candidate joins)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hired_from text DEFAULT 'Direct';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS supplier_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rate_per_hour numeric;

-- Mob/Demob: demobilization date
ALTER TABLE mob_demob ADD COLUMN IF NOT EXISTS demobilization_date date;

-- New columns for eVisa, MOHRE Contract, Bank Account
ALTER TABLE employees ADD COLUMN IF NOT EXISTS evisa_no text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS evisa_expiry date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS evisa_img text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mohre_contract_no text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mohre_contract_start date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mohre_contract_end date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mohre_contract_img text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_no text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_iban text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_img text;

-- Temp Employee ID + optional security deposit/advance, captured when Visa Processing starts
-- (after Offer Signed). Deposit is at management's discretion — not mandatory.
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS temp_employee_id text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS deposit_required boolean DEFAULT false;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS deposit_amount numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS deposit_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS deposit_notes text;

-- === TICKET & TRANSPORT COLUMNS (added index210) ===
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_pnr text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_airline text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_flight_no text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_from_city text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_from_airport text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_from_terminal text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_to_city text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_to_airport text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_to_terminal text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_depart_datetime timestamptz;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_arrive_datetime timestamptz;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_seat text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_class text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_data_json text;

-- === TRANSPORT ARRANGEMENT COLUMNS (index211) ===
-- Visit Visa tracking
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visit_visa_url text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visit_visa_issue_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visit_visa_expiry_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visit_visa_permit_no text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visit_visa_type text DEFAULT 'Tourism - Single - 30 Days';
-- D-Return Ticket & D-Hotel Booking (SATCO sends to candidate)
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS onward_ticket_url text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS d_return_ticket_url text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS d_return_ticket_sent_date date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS d_hotel_booking_url text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS d_hotel_booking_sent_date date;
-- Arrival tracking
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS date_of_arrival date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS arrival_manually_set boolean DEFAULT false;
-- Alert sent flags
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visa_expiry_alert_sent boolean DEFAULT false;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS ticket_reminder_sent boolean DEFAULT false;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS pickup_alert_sent boolean DEFAULT false;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS post_arrival_alert_sent boolean DEFAULT false;
-- =================================================================
-- DAILY ALERT EDGE FUNCTION -- add to daily-alert/index.ts:
-- A) Visa expiring within 14 days (not yet arrived):
--    WHERE visit_visa_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+14
--    AND date_of_arrival IS NULL AND visa_expiry_alert_sent=false
-- B) 7 days after visa issue, no ticket booked:
--    WHERE visit_visa_issue_date = CURRENT_DATE-7
--    AND ticket_depart_datetime IS NULL AND ticket_reminder_sent=false
-- C) 2 days before departure (airport pickup):
--    WHERE ticket_depart_datetime::DATE = CURRENT_DATE+2
--    AND pickup_alert_sent=false
-- D) 22 days after arrival, not yet joined (8 days to resolve):
--    WHERE date_of_arrival = CURRENT_DATE-22
--    AND status != 'Joined' AND post_arrival_alert_sent=false
-- After sending each: UPDATE hiring_pipeline SET <flag>=true WHERE id=...
-- =================================================================

-- Lets SATCO-Finance show in-process candidates (with a Temp Employee ID) in its Employee ID
-- picker, WITHOUT exposing passport numbers, salary, or any other hiring_pipeline column —
-- hiring_pipeline itself stays locked to authenticated users only (see "Auth users all" policy
-- above). Only these 4 columns, only rows with a temp_employee_id, only while not yet Joined.
-- CREATE OR REPLACE VIEW cannot rename existing output columns in Postgres — DROP first.
DROP VIEW IF EXISTS v_temp_candidates;
CREATE VIEW v_temp_candidates
WITH (security_invoker = false) AS
SELECT
  temp_employee_id,
  candidate_name,
  position_selected,
  position,
  COALESCE(position_selected, position) AS position_display,
  status
FROM hiring_pipeline
WHERE temp_employee_id IS NOT NULL
  AND status <> 'Joined';
GRANT SELECT ON v_temp_candidates TO anon;

-- === SIMPLIFIED VISA PIPELINE (one new column — everything else reuses existing fields) ===
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS typing_center_date date;`}
                  style={{ width:'100%', minHeight:'200px', padding:'10px', border:'1px solid var(--bd1)', borderRadius:'6px', fontFamily:'monospace', fontSize:'11px', background:'#fafbfc', color:'#334155' }} />
              </div>
            </div>
          </div>

          <div style={{ background:'#fff', border:'1px solid var(--bd1)', borderRadius:'12px', padding:'20px', gridColumn:'span 2' }}>
            <h3 style={{ margin:'0 0 8px', fontSize:'14px' }}>About</h3>
            <div style={{ fontSize:'12.5px', color:'#64748b', lineHeight:1.6 }}>Database holds <strong>{employeeCount}</strong> employee(s), shared live across your whole team. Every change you make is instantly saved to the cloud and visible to all logged-in members.</div>
          </div>

        </div>
      );
    }

  
