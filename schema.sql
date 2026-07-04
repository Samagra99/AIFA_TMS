-- ============================================================================
-- AMRAVATI FTO MANAGEMENT PLATFORM
-- PostgreSQL Database Schema  v1.0
-- Compliance: DGCA CAR-ML · CAR-M · SMS · PDPB 2023
-- ============================================================================
-- Convention:
--   • UUID primary keys everywhere (uuid_generate_v4())
--   • Soft-delete via is_active / is_superseded — no hard deletes on regulated data
--   • All tables carry created_at / updated_at TIMESTAMPTZ
--   • Audit trail via append-only audit_log table + triggers
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMERATIONS
-- ============================================================================

CREATE TYPE user_role AS ENUM (
    'superadmin', 'cfi', 'instructor', 'dispatcher',
    'student', 'camo', 'safety_officer', 'finance'
);

CREATE TYPE base_type AS ENUM ('hub', 'satellite');

CREATE TYPE aircraft_status AS ENUM (
    'airworthy', 'aog', 'scheduled_maintenance',
    'ferry_required', 'deregistered'
);

CREATE TYPE flight_status AS ENUM (
    'scheduled', 'confirmed', 'dispatched',
    'airborne', 'completed', 'cancelled', 'aborted'
);

CREATE TYPE flight_type AS ENUM (
    'dual', 'solo', 'cross_country_dual', 'cross_country_solo',
    'night_dual', 'night_solo', 'instrument', 'ferry', 'proficiency_check'
);

CREATE TYPE snag_category AS ENUM ('go', 'no_go', 'observation');

CREATE TYPE maintenance_type AS ENUM (
    'line', '50hr', '100hr', '200hr', '600hr',
    'annual', 'biennial', 'unscheduled', 'ad_compliance', 'sb_compliance'
);

CREATE TYPE document_type AS ENUM (
    'spl', 'medical_class1', 'medical_class2', 'frtol',
    'atpl_theory', 'cpl', 'atpl', 'instructor_rating',
    'crs', 'aircraft_certificate', 'insurance'
);

CREATE TYPE document_status AS ENUM (
    'valid', 'expiring_soon', 'expired', 'pending_renewal'
);

CREATE TYPE occurrence_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE occurrence_type AS ENUM (
    'incident', 'accident', 'near_miss', 'hazard_report',
    'airspace_infringement', 'bird_strike', 'technical_defect'
);

CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'waived');

CREATE TYPE compliance_status AS ENUM (
    'pending', 'complied', 'not_applicable', 'recurring'
);

-- ============================================================================
-- SCHEMA A: INFRASTRUCTURE
-- ============================================================================

CREATE TABLE bases (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                    VARCHAR(100) NOT NULL,
    icao_code               CHAR(4)      NOT NULL UNIQUE,
    iata_code               CHAR(3),
    base_type               base_type    NOT NULL DEFAULT 'satellite',
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    latitude                DECIMAL(9,6) NOT NULL,
    longitude               DECIMAL(9,6) NOT NULL,
    elevation_ft            INTEGER      NOT NULL DEFAULT 0,
    -- Maintenance hub logic -----------------------------------------------
    -- Aircraft at this base must retain at least this many hours before
    -- their next mandatory inspection to allow further training sorties.
    ferry_buffer_hours      DECIMAL(4,2) NOT NULL DEFAULT 2.50
                            CHECK (ferry_buffer_hours >= 0),
    -- Contact
    address                 TEXT,
    phone                   VARCHAR(20),
    -- Audit
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN bases.ferry_buffer_hours IS
  'Hours held in reserve for the ferry flight back to the maintenance hub. '
  'The scheduling engine blocks further training at a satellite base once '
  'an aircraft''s remaining hours fall at or below this threshold.';

-- ── Aircraft ──────────────────────────────────────────────────────────────────

CREATE TABLE aircraft_types (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    make_model                  VARCHAR(100) NOT NULL,     -- e.g. "Cessna 152"
    icao_designator             VARCHAR(10),               -- e.g. "C152"
    engine_make_model           VARCHAR(100),              -- e.g. "Lycoming O-235-L2C"
    fuel_type                   VARCHAR(20)  NOT NULL DEFAULT 'AVGAS 100LL',
    oil_type                    VARCHAR(50),
    -- Crosswind limits
    max_crosswind_demo_kt       DECIMAL(4,1) NOT NULL DEFAULT 15.0,
    max_crosswind_student_kt    DECIMAL(4,1) NOT NULL DEFAULT 12.0,
    -- Density altitude threshold above which solo flights are flagged (ft)
    da_solo_warning_ft          INTEGER      NOT NULL DEFAULT 5500,
    -- Mandatory maintenance intervals (hours)
    interval_50hr               DECIMAL(6,1) NOT NULL DEFAULT  50.0,
    interval_100hr              DECIMAL(6,1) NOT NULL DEFAULT 100.0,
    interval_200hr              DECIMAL(6,1) NOT NULL DEFAULT 200.0,
    interval_600hr              DECIMAL(6,1) NOT NULL DEFAULT 600.0,
    -- Mandatory maintenance intervals (calendar months)
    interval_annual_months      INTEGER      NOT NULL DEFAULT 12,
    interval_biennial_months    INTEGER      NOT NULL DEFAULT 24,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE aircraft (
    id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tail_number             VARCHAR(10)   NOT NULL UNIQUE,   -- e.g. "VT-ABC"
    aircraft_type_id        UUID          NOT NULL REFERENCES aircraft_types(id),
    home_base_id            UUID          NOT NULL REFERENCES bases(id),
    current_base_id         UUID          NOT NULL REFERENCES bases(id),
    -- Airworthiness -----------------------------------------------------------
    status                  aircraft_status NOT NULL DEFAULT 'airworthy',
    aog_reason              TEXT,
    aog_since               TIMESTAMPTZ,
    -- Hour counters (monotonically increasing; never decremented) -------------
    hobbs_total             DECIMAL(8,1)  NOT NULL DEFAULT 0.0  CHECK (hobbs_total >= 0),
    tacho_total             DECIMAL(8,1)  NOT NULL DEFAULT 0.0  CHECK (tacho_total >= 0),
    -- Next scheduled maintenance thresholds (hours) ---------------------------
    next_50hr_at            DECIMAL(8,1),
    next_100hr_at           DECIMAL(8,1),
    next_200hr_at           DECIMAL(8,1),
    next_600hr_at           DECIMAL(8,1),
    -- Next scheduled maintenance thresholds (calendar) ------------------------
    next_annual_due         DATE,
    next_biennial_due       DATE,
    -- Registration
    cert_of_registration    VARCHAR(50),
    cert_of_airworthiness   VARCHAR(50),
    coa_expiry              DATE,
    serial_number           VARCHAR(50),
    year_of_manufacture     INTEGER,
    -- Meta
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    notes                   TEXT,
    created_by              UUID,                           -- FK added post-creation
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aircraft_status       ON aircraft(status);
CREATE INDEX idx_aircraft_home_base    ON aircraft(home_base_id);
CREATE INDEX idx_aircraft_current_base ON aircraft(current_base_id);
CREATE INDEX idx_aircraft_type         ON aircraft(aircraft_type_id);

COMMENT ON COLUMN aircraft.hobbs_total IS
  'Total engine hours (Hobbs meter). Incremented after every sortie via trigger. '
  'Never manually editable. Source of truth for maintenance scheduling.';

COMMENT ON COLUMN aircraft.next_50hr_at IS
  'Hobbs hours at which the next 50-hr inspection falls due. Scheduling engine '
  'compares (next_50hr_at - hobbs_total) against the base ferry_buffer_hours '
  'and blocks further satellite training once the buffer is consumed.';

-- ============================================================================
-- SCHEMA B: USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    phone               VARCHAR(20)  UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    role                user_role    NOT NULL,
    home_base_id        UUID         REFERENCES bases(id),
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    is_email_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login          TIMESTAMPTZ,
    -- Increment to invalidate all existing JWTs for this user
    token_version       INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_role      ON users(role);
CREATE INDEX idx_users_home_base ON users(home_base_id);

-- Rotatable refresh tokens (stored hashed)
CREATE TABLE refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    device_info TEXT,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ── Instructors (extends users where role IN ('cfi','instructor')) ─────────────

CREATE TABLE instructors (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    cfi_licence_number          VARCHAR(50),
    cfi_expiry                  DATE,
    -- FDTL remaining (reset nightly by Celery task per DGCA FDTL schedule) ----
    fdtl_daily_remaining_min    INTEGER     NOT NULL DEFAULT 480    -- 8 hrs
                                CHECK (fdtl_daily_remaining_min >= 0),
    fdtl_weekly_remaining_min   INTEGER     NOT NULL DEFAULT 1800   -- 30 hrs
                                CHECK (fdtl_weekly_remaining_min >= 0),
    fdtl_monthly_remaining_min  INTEGER     NOT NULL DEFAULT 6000   -- 100 hrs
                                CHECK (fdtl_monthly_remaining_min >= 0),
    fdtl_last_reset_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
    -- Ratings
    instrument_rating           BOOLEAN     NOT NULL DEFAULT FALSE,
    multi_engine_rating         BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Array of aircraft_type_id UUIDs this instructor is type-rated on
    type_rating_ids             UUID[]      NOT NULL DEFAULT '{}',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Students (extends users where role = 'student') ───────────────────────────

CREATE TABLE students (
    id                      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- Licensing & medical
    spl_number              VARCHAR(50),
    spl_issue_date          DATE,
    spl_expiry              DATE,
    medical_class           SMALLINT     CHECK (medical_class IN (1, 2)),
    medical_expiry          DATE,
    frtol_number            VARCHAR(50),
    frtol_expiry            DATE,
    -- Logbook totals (auto-calculated by trigger; never directly editable) ----
    hours_total             DECIMAL(7,1) NOT NULL DEFAULT 0.0,
    hours_pic               DECIMAL(7,1) NOT NULL DEFAULT 0.0,
    hours_dual              DECIMAL(7,1) NOT NULL DEFAULT 0.0,
    hours_solo              DECIMAL(7,1) NOT NULL DEFAULT 0.0,
    hours_cross_country     DECIMAL(7,1) NOT NULL DEFAULT 0.0,
    hours_night             DECIMAL(7,1) NOT NULL DEFAULT 0.0,
    hours_instrument        DECIMAL(7,1) NOT NULL DEFAULT 0.0,
    -- Solo authorisation
    solo_approved           BOOLEAN      NOT NULL DEFAULT FALSE,
    solo_approved_by        UUID         REFERENCES instructors(id),
    solo_approved_at        TIMESTAMPTZ,
    solo_max_crosswind_kt   DECIMAL(4,1) NOT NULL DEFAULT 7.0,
    -- Enrolment
    batch_number            VARCHAR(20),
    enrollment_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
    target_licence          VARCHAR(10)  NOT NULL DEFAULT 'CPL',
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_spl_expiry     ON students(spl_expiry);
CREATE INDEX idx_students_medical_expiry ON students(medical_expiry);

CREATE TABLE student_documents (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID            NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    document_type   document_type   NOT NULL,
    document_number VARCHAR(100),
    issue_date      DATE,
    expiry_date     DATE,
    status          document_status NOT NULL DEFAULT 'valid',
    file_path       TEXT,            -- MinIO object key
    file_hash       VARCHAR(64),     -- SHA-256 for tamper detection
    uploaded_by     UUID            NOT NULL REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    notes           TEXT,
    -- Regulatory: records must be retained; never hard-deleted
    is_superseded   BOOLEAN         NOT NULL DEFAULT FALSE,
    superseded_by   UUID            REFERENCES student_documents(id)
);

CREATE INDEX idx_student_docs_expiry  ON student_documents(expiry_date)
    WHERE is_superseded = FALSE;
CREATE INDEX idx_student_docs_student ON student_documents(student_id);

-- ============================================================================
-- SCHEMA C: DGCA-APPROVED SYLLABUS CURRICULUM
-- ============================================================================

CREATE TABLE syllabus_stages (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    licence_type    VARCHAR(10) NOT NULL DEFAULT 'CPL',   -- PPL | CPL
    stage_number    SMALLINT    NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    sequence_order  SMALLINT    NOT NULL,
    UNIQUE (licence_type, stage_number)
);

CREATE TABLE syllabus_lessons (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id        UUID        NOT NULL REFERENCES syllabus_stages(id) ON DELETE CASCADE,
    lesson_number   SMALLINT    NOT NULL,
    title           VARCHAR(200) NOT NULL,
    sequence_order  SMALLINT    NOT NULL,
    UNIQUE (stage_id, lesson_number)
);

CREATE TABLE syllabus_exercises (
    id                      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id               UUID         NOT NULL REFERENCES syllabus_lessons(id) ON DELETE CASCADE,
    exercise_code           VARCHAR(20)  NOT NULL,     -- e.g. "EX-4A"
    title                   VARCHAR(200) NOT NULL,     -- e.g. "Steep Turns"
    description             TEXT,
    flight_type_required    flight_type  NOT NULL DEFAULT 'dual',
    -- Array of exercise_id UUIDs that must be passed before this one
    prerequisite_ids        UUID[]       NOT NULL DEFAULT '{}',
    pass_grade              SMALLINT     NOT NULL DEFAULT 3
                            CHECK (pass_grade BETWEEN 1 AND 5),
    sequence_order          SMALLINT     NOT NULL,
    UNIQUE (lesson_id, exercise_code)
);

-- ============================================================================
-- SCHEMA D: SCHEDULING & ROSTER
-- ============================================================================

CREATE TABLE flights (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_id             UUID         NOT NULL REFERENCES bases(id),
    student_id          UUID         REFERENCES students(id),     -- NULL = ferry
    instructor_id       UUID         NOT NULL REFERENCES instructors(id),
    aircraft_id         UUID         NOT NULL REFERENCES aircraft(id),
    flight_type         flight_type  NOT NULL,
    is_ferry            BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Scheduling window
    scheduled_start     TIMESTAMPTZ  NOT NULL,
    scheduled_end       TIMESTAMPTZ  NOT NULL,
    status              flight_status NOT NULL DEFAULT 'scheduled',
    -- Weather snapshot at dispatch time (FK added after weather_cache creation)
    weather_snapshot_id UUID,
    -- Cancellation
    cancelled_at        TIMESTAMPTZ,
    cancelled_by        UUID         REFERENCES users(id),
    cancellation_reason TEXT,
    notes               TEXT,
    -- Audit
    created_by          UUID         NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- ── Hard constraints ──────────────────────────────────────────────────────
    CONSTRAINT chk_flight_window     CHECK (scheduled_end > scheduled_start),
    CONSTRAINT chk_student_for_training CHECK (
        is_ferry = TRUE OR student_id IS NOT NULL
    )
);

CREATE INDEX idx_flights_base_date   ON flights(base_id, scheduled_start);
CREATE INDEX idx_flights_aircraft    ON flights(aircraft_id, scheduled_start);
CREATE INDEX idx_flights_instructor  ON flights(instructor_id, scheduled_start);
CREATE INDEX idx_flights_student     ON flights(student_id);
CREATE INDEX idx_flights_status      ON flights(status);

-- Planned exercises per flight (M2M)
CREATE TABLE flight_exercises (
    id              UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_id       UUID     NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    exercise_id     UUID     NOT NULL REFERENCES syllabus_exercises(id),
    sequence_order  SMALLINT NOT NULL DEFAULT 1,
    UNIQUE (flight_id, exercise_id)
);

-- FDTL duty periods — one row per actual duty block, updated post-flight
CREATE TABLE instructor_duty_logs (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    instructor_id       UUID        NOT NULL REFERENCES instructors(id),
    flight_id           UUID        REFERENCES flights(id),
    duty_start          TIMESTAMPTZ NOT NULL,
    duty_end            TIMESTAMPTZ,
    flight_minutes      INTEGER     NOT NULL DEFAULT 0,
    total_duty_minutes  INTEGER,
    base_id             UUID        REFERENCES bases(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duty_logs_instructor ON instructor_duty_logs(instructor_id, duty_start);

-- ============================================================================
-- SCHEMA E: FLIGHT DISPATCH & TECH LOG
-- ============================================================================

CREATE TABLE tech_logs (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_id                   UUID        NOT NULL UNIQUE REFERENCES flights(id),
    aircraft_id                 UUID        NOT NULL REFERENCES aircraft(id),
    -- Pre-flight meter readings
    hobbs_out                   DECIMAL(8,1),
    tacho_out                   DECIMAL(8,1),
    -- Dispatch clearance (dispatcher desk)
    dispatch_cleared_by         UUID        REFERENCES users(id),
    dispatch_cleared_at         TIMESTAMPTZ,
    -- Compliance snapshot at dispatch (immutable once set) -------------------
    student_medical_valid       BOOLEAN,
    student_spl_valid           BOOLEAN,
    instructor_fdtl_ok          BOOLEAN,
    aircraft_hours_ok           BOOLEAN,
    ferry_buffer_ok             BOOLEAN,
    crosswind_ok                BOOLEAN,
    live_wind_kt                DECIMAL(4,1),
    live_crosswind_component_kt DECIMAL(4,1),
    density_altitude_ft         INTEGER,
    -- Weather snapshot FK (added post creation)
    weather_snapshot_id         UUID,
    -- Aircraft acceptance (CFI on apron — must be offline-capable)
    accepted_by                 UUID        REFERENCES users(id),
    accepted_at                 TIMESTAMPTZ,
    acceptance_biometric_ok     BOOLEAN     NOT NULL DEFAULT FALSE,
    briefing_acknowledged_by    UUID        REFERENCES users(id),
    briefing_acknowledged_at    TIMESTAMPTZ,
    -- Post-flight readings
    hobbs_in                    DECIMAL(8,1),
    tacho_in                    DECIMAL(8,1),
    flight_duration_minutes     INTEGER,    -- auto-calculated by trigger
    nil_defects                 BOOLEAN,
    -- Status lifecycle: open → closed | aog
    status                      VARCHAR(20) NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'closed', 'aog')),
    closed_at                   TIMESTAMPTZ,
    closed_by                   UUID        REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_hobbs_in_gte_out CHECK (
        hobbs_in IS NULL OR hobbs_out IS NULL OR hobbs_in >= hobbs_out
    ),
    CONSTRAINT chk_tacho_in_gte_out CHECK (
        tacho_in IS NULL OR tacho_out IS NULL OR tacho_in >= tacho_out
    )
);

CREATE INDEX idx_tech_logs_aircraft ON tech_logs(aircraft_id);
CREATE INDEX idx_tech_logs_status   ON tech_logs(status);

CREATE TABLE snag_entries (
    id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tech_log_id           UUID          NOT NULL REFERENCES tech_logs(id) ON DELETE RESTRICT,
    aircraft_id           UUID          NOT NULL REFERENCES aircraft(id),
    description           TEXT          NOT NULL,
    category              snag_category NOT NULL,
    ata_chapter           VARCHAR(10),  -- ATA 100 chapter reference
    deferral_reference    VARCHAR(50),  -- MEL item for Go deferrals
    reported_by           UUID          NOT NULL REFERENCES users(id),
    reported_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- Resolution
    maintenance_record_id UUID,         -- FK added post maintenance_records creation
    resolved_at           TIMESTAMPTZ,
    resolved_by           UUID          REFERENCES users(id),
    resolution_notes      TEXT,
    -- Computed flag: TRUE when category = 'no_go'
    triggers_aog          BOOLEAN GENERATED ALWAYS AS (category = 'no_go') STORED,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snags_aircraft   ON snag_entries(aircraft_id);
CREATE INDEX idx_snags_category   ON snag_entries(category);
CREATE INDEX idx_snags_unresolved ON snag_entries(aircraft_id)
    WHERE resolved_at IS NULL;

-- ── AOG CASCADE TRIGGER ───────────────────────────────────────────────────────
-- When a No-Go snag is submitted:
--   1. Set aircraft status → AOG
--   2. Cancel all future scheduled/confirmed flights for that aircraft
--   3. Django Channels + Celery handles downstream push notifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_aog_cascade_on_no_go()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.category = 'no_go' THEN
        UPDATE aircraft SET
            status     = 'aog',
            aog_reason = NEW.description,
            aog_since  = NOW(),
            updated_at = NOW()
        WHERE id = NEW.aircraft_id;

        UPDATE flights SET
            status              = 'cancelled',
            cancelled_at        = NOW(),
            cancellation_reason = 'Aircraft AOG — ' || NEW.description,
            updated_at          = NOW()
        WHERE aircraft_id = NEW.aircraft_id
          AND status IN ('scheduled', 'confirmed')
          AND scheduled_start > NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aog_cascade
    AFTER INSERT ON snag_entries
    FOR EACH ROW EXECUTE FUNCTION fn_aog_cascade_on_no_go();

-- ── POST-FLIGHT HOURS TRIGGER ─────────────────────────────────────────────────
-- When hobbs_in is set on a tech_log:
--   1. Calculate flight_duration_minutes
--   2. Decrement aircraft maintenance countdown
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_aircraft_hours()
RETURNS TRIGGER AS $$
DECLARE
    v_delta_hobbs DECIMAL(8,1);
BEGIN
    IF NEW.hobbs_in IS NOT NULL AND OLD.hobbs_in IS NULL AND NEW.hobbs_out IS NOT NULL THEN
        v_delta_hobbs := NEW.hobbs_in - NEW.hobbs_out;
        NEW.flight_duration_minutes := ROUND(v_delta_hobbs * 60)::INTEGER;

        UPDATE aircraft SET
            hobbs_total = hobbs_total + v_delta_hobbs,
            updated_at  = NOW()
        WHERE id = NEW.aircraft_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_aircraft_hours
    BEFORE UPDATE ON tech_logs
    FOR EACH ROW EXECUTE FUNCTION fn_update_aircraft_hours();

-- ============================================================================
-- SCHEMA F: GRADING & LOGBOOK
-- ============================================================================

CREATE TABLE sortie_grades (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_id       UUID        NOT NULL REFERENCES flights(id) ON DELETE RESTRICT,
    exercise_id     UUID        NOT NULL REFERENCES syllabus_exercises(id),
    student_id      UUID        NOT NULL REFERENCES students(id),
    grade           SMALLINT    NOT NULL CHECK (grade BETWEEN 1 AND 5),
    instructor_notes TEXT,
    graded_by       UUID        NOT NULL REFERENCES instructors(id),
    graded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at       TIMESTAMPTZ,         -- immutable after 7 days (Celery task)
    UNIQUE (flight_id, exercise_id)
);

CREATE INDEX idx_grades_student  ON sortie_grades(student_id);
CREATE INDEX idx_grades_exercise ON sortie_grades(exercise_id);
CREATE INDEX idx_grades_flight   ON sortie_grades(flight_id);

-- ── STUDENT LOGBOOK AUTO-UPDATE ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_student_logbook()
RETURNS TRIGGER AS $$
DECLARE
    v_duration_hr DECIMAL(7,2);
    v_ftype       flight_type;
BEGIN
    SELECT tl.flight_duration_minutes, f.flight_type
    INTO   v_duration_hr, v_ftype
    FROM   flights f
    JOIN   tech_logs tl ON tl.flight_id = f.id
    WHERE  f.id = NEW.flight_id;

    v_duration_hr := COALESCE(v_duration_hr, 0) / 60.0;

    UPDATE students SET
        hours_total         = hours_total         + v_duration_hr,
        hours_pic           = hours_pic           + CASE WHEN v_ftype IN ('solo','cross_country_solo','night_solo') THEN v_duration_hr ELSE 0 END,
        hours_dual          = hours_dual          + CASE WHEN v_ftype IN ('dual','cross_country_dual','night_dual','instrument') THEN v_duration_hr ELSE 0 END,
        hours_solo          = hours_solo          + CASE WHEN v_ftype IN ('solo','cross_country_solo','night_solo') THEN v_duration_hr ELSE 0 END,
        hours_cross_country = hours_cross_country + CASE WHEN v_ftype IN ('cross_country_dual','cross_country_solo') THEN v_duration_hr ELSE 0 END,
        hours_night         = hours_night         + CASE WHEN v_ftype IN ('night_dual','night_solo') THEN v_duration_hr ELSE 0 END,
        hours_instrument    = hours_instrument    + CASE WHEN v_ftype = 'instrument' THEN v_duration_hr ELSE 0 END,
        updated_at          = NOW()
    WHERE id = NEW.student_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_student_logbook
    AFTER INSERT ON sortie_grades
    FOR EACH ROW EXECUTE FUNCTION fn_update_student_logbook();

-- ============================================================================
-- SCHEMA G: MAINTENANCE (CAR-ML / CAMO HUB)
-- ============================================================================

CREATE TABLE maintenance_records (
    id                  UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    aircraft_id         UUID             NOT NULL REFERENCES aircraft(id),
    base_id             UUID             NOT NULL REFERENCES bases(id),
    maintenance_type    maintenance_type NOT NULL,
    -- When performed
    performed_at_hours  DECIMAL(8,1)     NOT NULL,
    performed_at_date   DATE             NOT NULL,
    -- Next due thresholds
    next_due_hours      DECIMAL(8,1),
    next_due_date       DATE,
    -- Reference
    work_order_number   VARCHAR(50) UNIQUE,
    ad_sb_reference     VARCHAR(100),
    description         TEXT             NOT NULL,
    parts_replaced      JSONB            NOT NULL DEFAULT '[]',
    -- [{part_number, description, serial_number, quantity, cost_inr}]
    labour_hours        DECIMAL(5,1),
    total_cost_inr      DECIMAL(12,2),
    -- AME sign-off (CAR-M)
    performed_by        UUID             REFERENCES users(id),
    ame_licence_number  VARCHAR(50),
    -- CRS — Certificate of Release to Service (CAMO hub only) ----------------
    crs_issued          BOOLEAN          NOT NULL DEFAULT FALSE,
    crs_issued_by       UUID             REFERENCES users(id),
    crs_issued_at       TIMESTAMPTZ,
    crs_document_path   TEXT,
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_crs_has_issuer CHECK (
        crs_issued = FALSE OR crs_issued_by IS NOT NULL
    )
);

CREATE INDEX idx_maint_aircraft ON maintenance_records(aircraft_id);
CREATE INDEX idx_maint_type     ON maintenance_records(maintenance_type);
CREATE INDEX idx_maint_crs      ON maintenance_records(aircraft_id) WHERE crs_issued = TRUE;

-- ── CRS TRIGGER: unlock aircraft when CRS is issued ──────────────────────────
CREATE OR REPLACE FUNCTION fn_unlock_aircraft_on_crs()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.crs_issued = TRUE AND OLD.crs_issued = FALSE THEN
        UPDATE aircraft SET
            status     = 'airworthy',
            aog_reason = NULL,
            aog_since  = NULL,
            updated_at = NOW()
        WHERE id = NEW.aircraft_id AND status IN ('aog', 'scheduled_maintenance');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unlock_on_crs
    AFTER UPDATE ON maintenance_records
    FOR EACH ROW EXECUTE FUNCTION fn_unlock_aircraft_on_crs();

-- Airworthiness Directives & Service Bulletins per tail ─────────────────────
CREATE TABLE ad_sb_directives (
    id                      UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
    aircraft_id             UUID               NOT NULL REFERENCES aircraft(id),
    reference_number        VARCHAR(100)       NOT NULL,
    issuing_authority       VARCHAR(50)        NOT NULL,  -- DGCA | FAA | EASA
    title                   TEXT               NOT NULL,
    description             TEXT,
    directive_type          VARCHAR(10)        NOT NULL CHECK (directive_type IN ('AD','SB','SL')),
    compliance_status       compliance_status  NOT NULL DEFAULT 'pending',
    compliance_due_date     DATE,
    compliance_due_hours    DECIMAL(8,1),
    complied_via_record_id  UUID               REFERENCES maintenance_records(id),
    next_recurrence_date    DATE,
    next_recurrence_hours   DECIMAL(8,1),
    notes                   TEXT,
    created_at              TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ad_sb_aircraft ON ad_sb_directives(aircraft_id);
CREATE INDEX idx_ad_sb_pending  ON ad_sb_directives(compliance_due_date)
    WHERE compliance_status = 'pending';

-- AME duty & fatigue records (CAR-M requirement) ─────────────────────────────
CREATE TABLE ame_duty_logs (
    id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    ame_user_id           UUID        NOT NULL REFERENCES users(id),
    shift_start           TIMESTAMPTZ NOT NULL,
    shift_end             TIMESTAMPTZ,
    base_id               UUID        NOT NULL REFERENCES bases(id),
    maintenance_record_id UUID        REFERENCES maintenance_records(id),
    total_hours           DECIMAL(5,2),
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ame_duty_user ON ame_duty_logs(ame_user_id, shift_start);

-- ============================================================================
-- SCHEMA H: INVENTORY (HUB-AND-SPOKE)
-- ============================================================================

CREATE TABLE inventory_items (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_id          UUID        NOT NULL REFERENCES bases(id),
    part_number      VARCHAR(100) NOT NULL,
    description      TEXT        NOT NULL,
    aircraft_type_id UUID        REFERENCES aircraft_types(id),  -- NULL = generic
    quantity_on_hand DECIMAL(10,3) NOT NULL DEFAULT 0,
    unit             VARCHAR(20) NOT NULL DEFAULT 'each',
    min_stock_level  DECIMAL(10,3) NOT NULL DEFAULT 1,
    unit_cost_inr    DECIMAL(12,2),
    supplier_name    VARCHAR(200),
    storage_location VARCHAR(50),
    is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (base_id, part_number)
);

CREATE INDEX idx_inventory_base      ON inventory_items(base_id);
CREATE INDEX idx_inventory_low_stock ON inventory_items(base_id)
    WHERE quantity_on_hand <= min_stock_level AND is_active = TRUE;

CREATE TABLE inventory_requisitions (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    requesting_base_id  UUID        NOT NULL REFERENCES bases(id),
    fulfilling_base_id  UUID        NOT NULL REFERENCES bases(id),
    item_id             UUID        NOT NULL REFERENCES inventory_items(id),
    quantity_requested  DECIMAL(10,3) NOT NULL,
    quantity_fulfilled  DECIMAL(10,3),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','dispatched','received','cancelled')),
    requested_by        UUID        NOT NULL REFERENCES users(id),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by         UUID        REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    dispatch_method     VARCHAR(50),        -- 'ferry_flight' | 'ground_transport' | 'courier'
    dispatch_flight_id  UUID        REFERENCES flights(id),
    received_at         TIMESTAMPTZ,
    received_by         UUID        REFERENCES users(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SCHEMA I: SAFETY MANAGEMENT SYSTEM (SMS)
-- ============================================================================

CREATE TABLE occurrence_reports (
    id                  UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Auto-generated sequence: OCC-YYYYMM-NNN
    report_number       VARCHAR(20)        NOT NULL UNIQUE,
    base_id             UUID               NOT NULL REFERENCES bases(id),
    aircraft_id         UUID               REFERENCES aircraft(id),
    flight_id           UUID               REFERENCES flights(id),
    occurrence_type     occurrence_type    NOT NULL,
    severity            occurrence_severity NOT NULL,
    event_datetime      TIMESTAMPTZ        NOT NULL,
    event_location      TEXT,
    description         TEXT               NOT NULL,
    immediate_actions   TEXT,
    contributing_factors TEXT[]            NOT NULL DEFAULT '{}',
    -- People
    submitted_by        UUID               NOT NULL REFERENCES users(id),
    submitted_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    investigating_officer UUID             REFERENCES users(id),
    investigation_notes TEXT,
    corrective_actions  TEXT,
    closed_at           TIMESTAMPTZ,
    closed_by           UUID               REFERENCES users(id),
    -- DGCA submission
    dgca_submitted      BOOLEAN            NOT NULL DEFAULT FALSE,
    dgca_submitted_at   TIMESTAMPTZ,
    dgca_reference      VARCHAR(50),
    -- Immutability (locked 48 hrs after submission — enforced via app layer)
    locked_at           TIMESTAMPTZ,
    is_locked           BOOLEAN GENERATED ALWAYS AS (locked_at IS NOT NULL) STORED,
    created_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_occurrences_base     ON occurrence_reports(base_id);
CREATE INDEX idx_occurrences_aircraft ON occurrence_reports(aircraft_id);
CREATE INDEX idx_occurrences_severity ON occurrence_reports(severity);

-- Proactive hazard register (risk matrix Severity × Likelihood) ──────────────
CREATE TABLE hazard_entries (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_id          UUID        REFERENCES bases(id),
    title            VARCHAR(200) NOT NULL,
    description      TEXT        NOT NULL,
    likelihood       SMALLINT    NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
    severity         SMALLINT    NOT NULL CHECK (severity BETWEEN 1 AND 5),
    risk_score       SMALLINT GENERATED ALWAYS AS (likelihood * severity) STORED,
    controls         TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','mitigated','accepted','closed')),
    owner_id         UUID        REFERENCES users(id),
    review_date      DATE,
    identified_by    UUID        NOT NULL REFERENCES users(id),
    identified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SCHEMA J: FINANCE
-- ============================================================================

CREATE TABLE billing_records (
    id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id       UUID           NOT NULL REFERENCES students(id),
    description      VARCHAR(200)   NOT NULL,
    billing_type     VARCHAR(30)    NOT NULL
                     CHECK (billing_type IN ('course_fee','block_hours','exam_fee','misc')),
    amount_inr       DECIMAL(12,2)  NOT NULL,
    gst_rate         DECIMAL(5,2)   NOT NULL DEFAULT 18.00,
    gst_amount       DECIMAL(12,2)  GENERATED ALWAYS AS (amount_inr * gst_rate / 100) STORED,
    total_amount_inr DECIMAL(12,2)  GENERATED ALWAYS AS (amount_inr + (amount_inr * gst_rate / 100)) STORED,
    hsn_sac_code     VARCHAR(10)    NOT NULL DEFAULT '999293',
    invoice_number   VARCHAR(30)    UNIQUE,
    invoice_date     DATE,
    invoice_path     TEXT,          -- MinIO object key
    status           payment_status NOT NULL DEFAULT 'pending',
    paid_at          TIMESTAMPTZ,
    payment_method   VARCHAR(30),
    payment_reference VARCHAR(100),
    created_by       UUID           NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_student ON billing_records(student_id);
CREATE INDEX idx_billing_status  ON billing_records(status);

CREATE TABLE emi_plans (
    id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id            UUID        NOT NULL REFERENCES students(id),
    billing_record_id     UUID        NOT NULL REFERENCES billing_records(id),
    total_instalments     SMALLINT    NOT NULL,
    amount_per_instalment DECIMAL(12,2) NOT NULL,
    start_date            DATE        NOT NULL,
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE emi_instalments (
    id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    emi_plan_id       UUID           NOT NULL REFERENCES emi_plans(id) ON DELETE CASCADE,
    instalment_number SMALLINT       NOT NULL,
    due_date          DATE           NOT NULL,
    amount_inr        DECIMAL(12,2)  NOT NULL,
    status            payment_status NOT NULL DEFAULT 'pending',
    paid_at           TIMESTAMPTZ,
    payment_method    VARCHAR(30),
    payment_reference VARCHAR(100),
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE (emi_plan_id, instalment_number)
);

-- ============================================================================
-- SCHEMA K: WEATHER & NOTAM CACHE
-- ============================================================================

CREATE TABLE weather_cache (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    icao_code           CHAR(4)     NOT NULL,
    metar_raw           TEXT,
    taf_raw             TEXT,
    -- Decoded values for scheduling rule evaluation
    wind_direction_deg  SMALLINT,
    wind_speed_kt       SMALLINT,
    wind_gust_kt        SMALLINT,
    visibility_m        INTEGER,
    temp_celsius        DECIMAL(4,1),
    dewpoint_celsius    DECIMAL(4,1),
    qnh_hpa             DECIMAL(6,1),
    cloud_layers        JSONB,       -- [{coverage:"BKN", height_ft:2500}, ...]
    -- Calculated fields
    density_altitude_ft INTEGER,
    pressure_alt_ft     INTEGER,
    -- Meta
    observation_time    TIMESTAMPTZ,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_stale            BOOLEAN GENERATED ALWAYS AS (
        fetched_at < NOW() - INTERVAL '90 minutes'
    ) STORED
);

CREATE INDEX idx_weather_icao_time ON weather_cache(icao_code, fetched_at DESC);

CREATE TABLE notam_cache (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    icao_code     CHAR(4)     NOT NULL,
    notam_id      VARCHAR(50) NOT NULL,
    series        CHAR(1),
    notam_type    VARCHAR(10),
    purpose       VARCHAR(10),
    scope         VARCHAR(10),
    lower_limit   VARCHAR(20),
    upper_limit   VARCHAR(20),
    area          TEXT,
    notam_text    TEXT        NOT NULL,
    effective_from TIMESTAMPTZ,
    effective_to  TIMESTAMPTZ,
    is_permanent  BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (icao_code, notam_id)
);

CREATE INDEX idx_notams_icao_active ON notam_cache(icao_code, effective_to)
    WHERE is_active = TRUE;

-- ============================================================================
-- DEFERRED FOREIGN KEY ADDITIONS
-- ============================================================================

ALTER TABLE flights
    ADD CONSTRAINT fk_flights_weather
    FOREIGN KEY (weather_snapshot_id) REFERENCES weather_cache(id);

ALTER TABLE tech_logs
    ADD CONSTRAINT fk_tech_logs_weather
    FOREIGN KEY (weather_snapshot_id) REFERENCES weather_cache(id);

ALTER TABLE snag_entries
    ADD CONSTRAINT fk_snags_maintenance
    FOREIGN KEY (maintenance_record_id) REFERENCES maintenance_records(id);

ALTER TABLE aircraft
    ADD CONSTRAINT fk_aircraft_created_by
    FOREIGN KEY (created_by) REFERENCES users(id);

-- ============================================================================
-- SCHEMA L: AUDIT LOG (append-only, non-deletable)
-- ============================================================================

CREATE TABLE audit_log (
    id          BIGSERIAL    PRIMARY KEY,
    table_name  VARCHAR(100) NOT NULL,
    record_id   UUID         NOT NULL,
    action      CHAR(6)      NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    changed_by  UUID         REFERENCES users(id),
    changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    session_id  TEXT
);

CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_changed_at   ON audit_log(changed_at);
CREATE INDEX idx_audit_user         ON audit_log(changed_by);

-- Revoke DELETE on audit_log for all roles (enforced at DB level)
REVOKE DELETE ON audit_log FROM PUBLIC;

-- ── Generic audit trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to all safety-regulated tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'aircraft', 'flights', 'tech_logs', 'snag_entries',
        'maintenance_records', 'ad_sb_directives',
        'student_documents', 'sortie_grades',
        'occurrence_reports', 'billing_records'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_audit_%1$s
             AFTER INSERT OR UPDATE OR DELETE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger()',
            t
        );
    END LOOP;
END;
$$;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Fleet status — primary view for dispatch dashboard ─────────────────────────
CREATE VIEW v_fleet_status AS
SELECT
    a.id,
    a.tail_number,
    at.make_model,
    bh.name                                     AS home_base,
    bc.name                                     AS current_base,
    bc.icao_code                                AS current_base_icao,
    a.status,
    a.aog_reason,
    a.hobbs_total,
    a.next_50hr_at,
    (a.next_50hr_at  - a.hobbs_total)           AS hrs_to_50hr,
    a.next_100hr_at,
    (a.next_100hr_at - a.hobbs_total)           AS hrs_to_100hr,
    bc.ferry_buffer_hours,
    -- True when remaining hours ≤ ferry buffer for current base
    CASE
        WHEN a.next_50hr_at  IS NOT NULL
         AND (a.next_50hr_at  - a.hobbs_total) <= bc.ferry_buffer_hours THEN TRUE
        WHEN a.next_100hr_at IS NOT NULL
         AND (a.next_100hr_at - a.hobbs_total) <= bc.ferry_buffer_hours THEN TRUE
        ELSE FALSE
    END                                         AS ferry_buffer_triggered,
    a.next_annual_due,
    (a.next_annual_due - CURRENT_DATE)          AS days_to_annual
FROM  aircraft a
JOIN  aircraft_types at ON at.id = a.aircraft_type_id
JOIN  bases bh           ON bh.id = a.home_base_id
JOIN  bases bc           ON bc.id = a.current_base_id
WHERE a.is_active = TRUE;

-- Student compliance snapshot — used by scheduling rule engine ────────────────
CREATE VIEW v_student_compliance AS
SELECT
    s.id                                        AS student_id,
    u.first_name,
    u.last_name,
    s.spl_expiry,
    s.medical_class,
    s.medical_expiry,
    s.frtol_expiry,
    (s.spl_expiry     > CURRENT_DATE)           AS spl_valid,
    (s.medical_expiry > CURRENT_DATE)           AS medical_valid,
    (s.frtol_expiry   > CURRENT_DATE
     OR s.frtol_expiry IS NULL)                 AS frtol_valid,
    s.solo_approved,
    s.solo_max_crosswind_kt,
    s.hours_total,
    s.hours_pic,
    s.hours_dual,
    s.hours_cross_country,
    s.hours_night,
    s.hours_instrument
FROM  students s
JOIN  users u ON u.id = s.user_id;

-- Documents expiring within 60 days — feeds notification Celery task ──────────
CREATE VIEW v_expiring_documents AS
SELECT
    sd.id,
    s.id                AS student_id,
    u.first_name || ' ' || u.last_name AS student_name,
    sd.document_type,
    sd.expiry_date,
    (sd.expiry_date - CURRENT_DATE)     AS days_remaining,
    CASE
        WHEN sd.expiry_date <= CURRENT_DATE              THEN 'expired'
        WHEN sd.expiry_date <= CURRENT_DATE + 30         THEN 'critical'
        WHEN sd.expiry_date <= CURRENT_DATE + 60         THEN 'warning'
        ELSE 'ok'
    END                                 AS alert_level
FROM  student_documents sd
JOIN  students s ON s.id = sd.student_id
JOIN  users    u ON u.id = s.user_id
WHERE sd.is_superseded = FALSE
  AND sd.expiry_date   IS NOT NULL
ORDER BY sd.expiry_date;

-- SMS Monthly Summary — for DGCA reporting ────────────────────────────────────
CREATE VIEW v_sms_monthly_summary AS
SELECT
    b.name                                              AS base_name,
    DATE_TRUNC('month', o.event_datetime)               AS month,
    COUNT(*)                                            AS total_occurrences,
    COUNT(*) FILTER (WHERE o.severity = 'critical')    AS critical,
    COUNT(*) FILTER (WHERE o.severity = 'high')        AS high,
    COUNT(*) FILTER (WHERE o.dgca_submitted = TRUE)    AS dgca_submitted,
    COUNT(*) FILTER (WHERE o.closed_at IS NOT NULL)    AS closed
FROM  occurrence_reports o
JOIN  bases b ON b.id = o.base_id
GROUP BY b.name, DATE_TRUNC('month', o.event_datetime)
ORDER BY month DESC, b.name;

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO bases (name, icao_code, base_type, latitude, longitude, elevation_ft, ferry_buffer_hours) VALUES
    ('Amravati (Central Maintenance Hub)', 'VAAM', 'hub',       20.7749, 77.7480, 1178, 0.00),
    ('Satellite Base 2 (TBD)',             'VATB', 'satellite', 20.0000, 78.0000, 1000, 2.50),
    ('Satellite Base 3 (TBD)',             'VATC', 'satellite', 21.0000, 79.0000, 1050, 2.50);

INSERT INTO aircraft_types (make_model, icao_designator, max_crosswind_demo_kt, max_crosswind_student_kt, da_solo_warning_ft, interval_50hr, interval_100hr, interval_200hr) VALUES
    ('Cessna 152',   'C152', 15, 10, 5500,  50, 100, 200),
    ('Cessna 172SP', 'C172', 15, 12, 6000,  50, 100, 200),
    ('Piper PA-28',  'PA28', 17, 12, 6000,  50, 100, 200);

-- ============================================================================
-- SCHEDULING RULE ENGINE — Reference Queries
-- ============================================================================

-- Check all hard constraints before confirming a flight:
-- Returns TRUE only when all checks pass.
CREATE OR REPLACE FUNCTION fn_scheduling_hard_check(
    p_student_id    UUID,
    p_instructor_id UUID,
    p_aircraft_id   UUID,
    p_duration_min  INTEGER
) RETURNS TABLE (
    check_name   TEXT,
    passed       BOOLEAN,
    detail       TEXT
) AS $$
DECLARE
    v_student  RECORD;
    v_instr    RECORD;
    v_aircraft RECORD;
    v_base     RECORD;
BEGIN
    -- Load records
    SELECT * INTO v_student  FROM v_student_compliance WHERE student_id = p_student_id;
    SELECT * INTO v_instr    FROM instructors WHERE id = p_instructor_id;
    SELECT * INTO v_aircraft FROM v_fleet_status WHERE id = p_aircraft_id;
    SELECT * INTO v_base     FROM bases WHERE icao_code = v_aircraft.current_base_icao;

    RETURN QUERY
    SELECT 'student_medical'::TEXT,
           v_student.medical_valid,
           'Medical expiry: ' || v_student.medical_expiry::TEXT;

    RETURN QUERY
    SELECT 'student_spl'::TEXT,
           v_student.spl_valid,
           'SPL expiry: ' || v_student.spl_expiry::TEXT;

    RETURN QUERY
    SELECT 'instructor_fdtl_daily'::TEXT,
           (v_instr.fdtl_daily_remaining_min >= p_duration_min),
           'Remaining daily FDTL: ' || v_instr.fdtl_daily_remaining_min::TEXT || ' min';

    RETURN QUERY
    SELECT 'instructor_fdtl_weekly'::TEXT,
           (v_instr.fdtl_weekly_remaining_min >= p_duration_min),
           'Remaining weekly FDTL: ' || v_instr.fdtl_weekly_remaining_min::TEXT || ' min';

    RETURN QUERY
    SELECT 'aircraft_not_aog'::TEXT,
           (v_aircraft.status = 'airworthy'),
           'Aircraft status: ' || v_aircraft.status::TEXT;

    RETURN QUERY
    SELECT 'ferry_buffer'::TEXT,
           (NOT v_aircraft.ferry_buffer_triggered),
           'Hours to next inspection: ' || COALESCE(LEAST(v_aircraft.hrs_to_50hr, v_aircraft.hrs_to_100hr)::TEXT, 'N/A')
           || ' · Buffer required: ' || v_aircraft.ferry_buffer_hours::TEXT;
END;
$$ LANGUAGE plpgsql;
