-- ============================================================
-- SATCO ARABIA — HR PORTAL + INTERVIEW SHEET
-- Complete Supabase Schema  |  v2.0  |  June 2025
-- ============================================================
-- HOW TO USE:
--   1. Open Supabase → SQL Editor
--   2. Paste this entire file and click RUN
--   3. Safe to run multiple times — all statements use
--      CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1.  EMPLOYEES TABLE  (core HR directory)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS employees (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           text UNIQUE,
  full_name             text,
  visa_trade            text,
  department            text,
  nationality           text,
  position              text,
  work_experience       text,
  joining_date          date,
  basic_salary          numeric,
  allowance             numeric,
  status                text,
  dob                   date,
  passport_no           text,
  passport_expiry       date,
  eid_no                text,
  eid_hardcopy_recv     date,
  eid_expiry            date,
  visa_expiry           date,
  reference_by          text,
  reference_contact     text,
  email                 text,
  india_contact         text,
  uae_contact           text,
  location              text,
  passport_handover     text,
  mobile                text,
  manager_email         text,
  insurance_id          text,
  insurance_effective   date,
  insurance_expiry      date,
  cicpa_no              text,
  cicpa_expiry          date,
  cicpa_locations       text,
  passport_img          text,
  eid_img               text,
  visa_img              text,
  insurance_img         text,
  cicpa_img             text,
  -- eVisa & MOHRE Contract
  evisa_no              text,
  evisa_expiry          date,
  evisa_img             text,
  mohre_contract_no     text,
  mohre_contract_start  date,
  mohre_contract_end    date,
  mohre_contract_img    text,
  -- Bank Details
  bank_name             text,
  bank_account_no       text,
  bank_iban             text,
  bank_img              text,
  -- Hiring source (populated when candidate joins via pipeline)
  hired_from            text DEFAULT 'Direct',
  supplier_name         text,
  rate_per_hour         numeric,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_employee_id  ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_passport_no  ON employees(passport_no);
CREATE INDEX IF NOT EXISTS idx_employees_status       ON employees(status);

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users all on employees" ON employees;
CREATE POLICY "Auth users all on employees" ON employees
  FOR ALL USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- 2.  EMPLOYEE CONTACTS TABLE
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS employee_contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number     text,
  full_name           text,
  mobile_uae          text,
  mobile_home         text,
  email               text,
  whatsapp            text,
  home_address        text,
  uae_address         text,
  emergency_name      text,
  emergency_relation  text,
  emergency_country   text,
  emergency_mobile    text,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE employee_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users all on employee_contacts" ON employee_contacts;
CREATE POLICY "Auth users all on employee_contacts" ON employee_contacts
  FOR ALL USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- 3.  EMPLOYEE TRAININGS TABLE
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS employee_trainings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      text,
  full_name        text,
  position         text,
  cicpa_locations  text,
  training_records jsonb DEFAULT '{}',
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_trainings_emp_id
  ON employee_trainings(employee_id);

ALTER TABLE employee_trainings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users all on employee_trainings" ON employee_trainings;
CREATE POLICY "Auth users all on employee_trainings" ON employee_trainings
  FOR ALL USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- 4.  ALERT RECIPIENTS TABLE  (email automation)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recipients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text UNIQUE NOT NULL,
  name       text,
  role       text DEFAULT 'hr',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users all on recipients" ON recipients;
CREATE POLICY "Auth users all on recipients" ON recipients
  FOR ALL USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- 5.  HIRING PIPELINE TABLE
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hiring_pipeline (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Personal & Passport ──────────────────────────────────
  candidate_name            text,
  passport_no               text,
  passport_expiry_candidate date,
  place_of_issue            text,
  nationality               text,
  dob_candidate             date,
  marital_status            text,
  religion                  text,
  languages                 text,
  home_address              text,

  -- ── Contact ──────────────────────────────────────────────
  phone                     text,
  whatsapp                  text,
  email                     text,
  current_location          text,
  referred_by               text,
  referred_contact          text,

  -- ── Professional ─────────────────────────────────────────
  position                  text,
  department                text,
  experience                text,
  current_employer          text,
  current_designation       text,
  skills                    text,
  education                 text,
  work_history              text,       -- JSON string: [{company, designation, location, from, to, industry}]

  -- ── Middle East Experience ────────────────────────────────
  me_experience             text,       -- 'yes' | 'no'
  me_history                text,       -- JSON string: [{country, company, site, role, duration, adnocTaqa}]
  me_notes                  text,

  -- ── Interview Assessment ──────────────────────────────────
  interview_date            date,
  interview_type            text,
  interviewed_by            text,
  interview_score           numeric,    -- total out of 30 (sum of 6 criteria × 5)
  interview_score_technical numeric,    -- individual criteria scores (each 1–5)
  interview_score_comm      numeric,
  interview_score_safety    numeric,
  interview_score_exp       numeric,
  interview_score_attitude  numeric,
  interview_score_docs      numeric,
  interview_notes           text,
  interview_qa              text,       -- JSON string: [{question, answer}]
  interview_mode            text,       -- 'In-person (Abu Dhabi)' | 'Video Call (WhatsApp)' | etc.
  interview_verdict         text,       -- 'selected' | 'onhold' | 'rejected'
  verdict_reason            text,

  -- ── Offer & Salary ────────────────────────────────────────
  basic_salary              numeric,
  allowance                 numeric,
  total_salary              numeric,
  accommodation             text,
  accommodation_by          text,
  transport_by              text,
  food_by                   text,
  air_ticket                text,
  deployment_site           text,
  visa_category             text,
  available_from            text,
  offer_letter_date         date,
  offer_accepted_date       date,
  offer_status              text,

  -- ── Medical & Health ─────────────────────────────────────
  medical_conditions        text,
  on_medication             text,
  colour_blindness          text,
  vision_aids               text,
  fit_for_height            text,
  fit_for_cse               text,
  medical_notes             text,
  gamka_result              text,
  gamka_date                date,

  -- ── Family ───────────────────────────────────────────────
  dependants_count          text,
  children_count            text,
  family_in_uae             text,
  family_details            text,       -- JSON string: [{relationship, name, age, occupation, contact}]
  emergency_contact         text,

  -- ── Certifications ───────────────────────────────────────
  certifications_held       text,       -- JSON string: {hse:{cert_name: {checked, expiry}}, prof:{...}}
  other_certifications      text,

  -- ── Pipeline Status & Dates ──────────────────────────────
  status                    text DEFAULT 'Active',
  step                      text DEFAULT 'resume',
  step_due_date             date,
  visa_medical_date         date,
  visa_documents_sent_date  date,
  visa_stamped_date         date,
  expected_arrival_date     date,
  remarks                   text,

  -- ── Documents (base64 or URL) ─────────────────────────────
  resume_url                text,
  passport_img_url          text,
  offer_signed_url          text,
  certificates_url          text,
  interview_sheet_url       text,       -- PDF/base64 of printed interview sheet

  -- ── Supplier / Agency ────────────────────────────────────
  is_supplier_hire          text DEFAULT 'no',
  supplier_name             text,
  supplier_contact_name     text,
  supplier_phone            text,
  supplier_whatsapp         text,
  supplier_email            text,
  supplier_address          text,
  rate_per_hour             numeric,
  supplier_notes            text,

  -- ── Meta ─────────────────────────────────────────────────
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hiring_status    ON hiring_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_hiring_step      ON hiring_pipeline(step);
CREATE INDEX IF NOT EXISTS idx_hiring_passport  ON hiring_pipeline(passport_no);
CREATE INDEX IF NOT EXISTS idx_hiring_name      ON hiring_pipeline(candidate_name);
CREATE INDEX IF NOT EXISTS idx_hiring_created   ON hiring_pipeline(created_at DESC);

-- RLS
ALTER TABLE hiring_pipeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users all on hiring_pipeline" ON hiring_pipeline;
CREATE POLICY "Auth users all on hiring_pipeline" ON hiring_pipeline
  FOR ALL USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- 6.  UPGRADE PATCHES
--     Safe to run on both fresh installs and upgrades.
--     ADD COLUMN IF NOT EXISTS never errors on existing cols.
-- ════════════════════════════════════════════════════════════

-- ── 6a. employees table patches ──────────────────────────────

ALTER TABLE employees ADD COLUMN IF NOT EXISTS evisa_no              text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS evisa_expiry          date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS evisa_img             text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mohre_contract_no     text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mohre_contract_start  date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mohre_contract_end    date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mohre_contract_img    text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name             text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_no       text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_iban             text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_img              text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hired_from            text DEFAULT 'Direct';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS supplier_name         text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rate_per_hour         numeric;

-- ── 6b. recipients table patches ─────────────────────────────

ALTER TABLE recipients ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS role text DEFAULT 'hr';

-- ── 6c. hiring_pipeline — original columns (v1 installs) ─────

ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS experience                text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS skills                    text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS dob_candidate             date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS passport_expiry_candidate date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS home_address              text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS marital_status            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS religion                  text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS languages                 text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS education                 text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS current_employer          text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS current_designation       text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS work_history              text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS place_of_issue            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS is_supplier_hire          text DEFAULT 'no';
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_name             text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_contact_name     text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_phone            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_whatsapp         text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_email            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_address          text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS rate_per_hour             numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS accommodation_by          text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS transport_by              text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS food_by                   text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS supplier_notes            text;

-- ── 6d. hiring_pipeline — interview sheet columns (v2 NEW) ───

ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS me_experience             text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS me_history                text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS me_notes                  text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_score_technical numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_score_comm      numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_score_safety    numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_score_exp       numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_score_attitude  numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_score_docs      numeric;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_qa              text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_mode            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_verdict         text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS verdict_reason            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS medical_conditions        text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS on_medication             text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS colour_blindness          text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS vision_aids               text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS fit_for_height            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS fit_for_cse               text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS medical_notes             text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS gamka_result              text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS gamka_date                date;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS dependants_count          text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS children_count            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS family_in_uae             text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS family_details            text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS emergency_contact         text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS certifications_held       text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS other_certifications      text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS deployment_site           text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS visa_category             text;
ALTER TABLE hiring_pipeline ADD COLUMN IF NOT EXISTS interview_sheet_url       text;

-- ════════════════════════════════════════════════════════════
-- 7.  STORAGE BUCKET
--     Run in Supabase SQL Editor if bucket doesn't exist yet.
--     (Supabase creates bucket via dashboard too — either works)
-- ════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-documents',
  'hr-documents',
  false,
  52428800,  -- 50 MB per file
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "Auth users can upload hr-documents" ON storage.objects;
CREATE POLICY "Auth users can upload hr-documents" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND bucket_id = 'hr-documents'
  );

DROP POLICY IF EXISTS "Auth users can read hr-documents" ON storage.objects;
CREATE POLICY "Auth users can read hr-documents" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND bucket_id = 'hr-documents'
  );

DROP POLICY IF EXISTS "Auth users can delete hr-documents" ON storage.objects;
CREATE POLICY "Auth users can delete hr-documents" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND bucket_id = 'hr-documents'
  );

-- ════════════════════════════════════════════════════════════
-- 8.  AUTO-UPDATE updated_at TRIGGER
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- employees
DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- employee_trainings
DROP TRIGGER IF EXISTS trg_trainings_updated_at ON employee_trainings;
CREATE TRIGGER trg_trainings_updated_at
  BEFORE UPDATE ON employee_trainings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- hiring_pipeline
DROP TRIGGER IF EXISTS trg_hiring_updated_at ON hiring_pipeline;
CREATE TRIGGER trg_hiring_updated_at
  BEFORE UPDATE ON hiring_pipeline
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════
-- 9.  USEFUL VIEWS  (optional — helps with reporting)
-- ════════════════════════════════════════════════════════════

-- 9a. Expiring documents in next 90 days
CREATE OR REPLACE VIEW v_expiring_documents AS
SELECT
  employee_id,
  full_name,
  'Passport'    AS document_type,
  passport_expiry AS expiry_date,
  (passport_expiry - CURRENT_DATE) AS days_remaining
FROM employees
WHERE passport_expiry IS NOT NULL
  AND passport_expiry <= CURRENT_DATE + INTERVAL '90 days'
UNION ALL
SELECT employee_id, full_name, 'Emirates ID', eid_expiry,
  (eid_expiry - CURRENT_DATE)
FROM employees WHERE eid_expiry IS NOT NULL
  AND eid_expiry <= CURRENT_DATE + INTERVAL '90 days'
UNION ALL
SELECT employee_id, full_name, 'Visa', visa_expiry,
  (visa_expiry - CURRENT_DATE)
FROM employees WHERE visa_expiry IS NOT NULL
  AND visa_expiry <= CURRENT_DATE + INTERVAL '90 days'
UNION ALL
SELECT employee_id, full_name, 'Insurance', insurance_expiry,
  (insurance_expiry - CURRENT_DATE)
FROM employees WHERE insurance_expiry IS NOT NULL
  AND insurance_expiry <= CURRENT_DATE + INTERVAL '90 days'
UNION ALL
SELECT employee_id, full_name, 'CICPA Gate Pass', cicpa_expiry,
  (cicpa_expiry - CURRENT_DATE)
FROM employees WHERE cicpa_expiry IS NOT NULL
  AND cicpa_expiry <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY days_remaining ASC;

-- 9b. Hiring pipeline summary by step
CREATE OR REPLACE VIEW v_hiring_summary AS
SELECT
  step,
  status,
  COUNT(*)                                    AS candidate_count,
  ROUND(AVG(interview_score), 1)              AS avg_interview_score,
  MIN(created_at)::date                       AS oldest_record,
  MAX(created_at)::date                       AS newest_record
FROM hiring_pipeline
GROUP BY step, status
ORDER BY
  CASE step
    WHEN 'resume'       THEN 1
    WHEN 'interview'    THEN 2
    WHEN 'offer_sent'   THEN 3
    WHEN 'offer_signed' THEN 4
    WHEN 'visa_medical' THEN 5
    WHEN 'docs_sent'    THEN 6
    WHEN 'visa_stamped' THEN 7
    WHEN 'travel'       THEN 8
    WHEN 'joined'       THEN 9
    ELSE 10
  END,
  status;

-- 9c. Candidates with interview score breakdown
CREATE OR REPLACE VIEW v_interview_scores AS
SELECT
  id,
  candidate_name,
  position,
  nationality,
  current_location,
  interview_date,
  interviewed_by,
  interview_mode,
  interview_score_technical AS technical,
  interview_score_comm      AS communication,
  interview_score_safety    AS safety,
  interview_score_exp       AS experience_match,
  interview_score_attitude  AS attitude,
  interview_score_docs      AS certifications,
  interview_score           AS total_out_of_30,
  CASE
    WHEN interview_score >= 26 THEN 'Excellent'
    WHEN interview_score >= 21 THEN 'Good'
    WHEN interview_score >= 17 THEN 'Average'
    WHEN interview_score >  0  THEN 'Below Threshold'
    ELSE 'Not Scored'
  END                       AS grade,
  interview_verdict,
  me_experience,
  gamka_result,
  status
FROM hiring_pipeline
WHERE interview_date IS NOT NULL
ORDER BY interview_date DESC;

-- ════════════════════════════════════════════════════════════
-- 10. HIRING_FIELDS REFERENCE
--     (for index71.html / SATCO-HR app — keep in sync)
--     These are ALL columns the app's HIRING_FIELDS whitelist
--     must include so saves work correctly.
-- ════════════════════════════════════════════════════════════

/*
HIRING_FIELDS whitelist for index71.html (paste into your JS):

const HIRING_FIELDS = [
  // Personal
  'candidate_name','passport_no','passport_expiry_candidate','place_of_issue',
  'nationality','dob_candidate','marital_status','religion','languages','home_address',
  // Contact
  'phone','whatsapp','email','current_location','referred_by','referred_contact',
  // Professional
  'position','department','experience','current_employer','current_designation',
  'skills','education','work_history',
  // Middle East Experience
  'me_experience','me_history','me_notes',
  // Interview
  'interview_date','interview_type','interviewed_by','interview_score',
  'interview_score_technical','interview_score_comm','interview_score_safety',
  'interview_score_exp','interview_score_attitude','interview_score_docs',
  'interview_notes','interview_qa','interview_mode','interview_verdict','verdict_reason',
  // Offer & Salary
  'basic_salary','allowance','total_salary',
  'accommodation','accommodation_by','transport_by','food_by','air_ticket',
  'deployment_site','visa_category','available_from',
  'offer_letter_date','offer_accepted_date','offer_status',
  // Medical
  'medical_conditions','on_medication','colour_blindness','vision_aids',
  'fit_for_height','fit_for_cse','medical_notes','gamka_result','gamka_date',
  // Family
  'dependants_count','children_count','family_in_uae','family_details','emergency_contact',
  // Certifications
  'certifications_held','other_certifications',
  // Pipeline
  'status','step','step_due_date',
  'visa_medical_date','visa_documents_sent_date','visa_stamped_date','expected_arrival_date',
  'remarks',
  // Documents
  'resume_url','passport_img_url','offer_signed_url','certificates_url','interview_sheet_url',
  // Supplier
  'is_supplier_hire','supplier_name','supplier_contact_name','supplier_phone',
  'supplier_whatsapp','supplier_email','supplier_address',
  'rate_per_hour','supplier_notes',
];
*/

-- ════════════════════════════════════════════════════════════
-- END OF SCHEMA
-- ════════════════════════════════════════════════════════════
