-- =====================================================================
-- MyQA@JN — AI-Powered School QA Resolution Agent — DATABASE SCHEMA (MySQL)
-- Jemaah Nazir (JN) School-Audit Discrepancy Detection Platform
-- ---------------------------------------------------------------------
-- This supersedes IEG_Cohort4_Database_Schema_MySQL.sql for this
-- project — that file modeled an unrelated generic "MOE multi-agent
-- student/teacher" domain (dim_student, if01-if06, 25 project tables)
-- which does not match prestij25-jn-system.
--
-- This schema is a 1:1 MySQL translation of the authoritative data
-- model already implemented in Prisma at
-- prestij25-jn-system/backend/prisma/schema.prisma.
--
--   * Safe to run on a brand-new, empty database
--   * Safe to RE-RUN: CREATE TABLE IF NOT EXISTS on every table,
--     DROP VIEW IF EXISTS before every view
--   * Tables ordered by dependency (parents before children)
--   * JSON-string columns (SQLite workaround) upgraded to native
--     MySQL JSON columns
--   * Enum-like fields kept as VARCHAR + CHECK, matching Prisma's
--     string-based "enum" fields (SQLite has no native enum support)
-- Target dialect: MySQL 8+ / MariaDB 10.4+
--   * CHECK constraints enforced on MySQL 8.0.16+/MariaDB 10.2+
--   * Engine defaults to InnoDB for full FK support
-- =====================================================================

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                            CHAR(36)      PRIMARY KEY,
    name                          VARCHAR(150)  NOT NULL,
    email                         VARCHAR(150)  NOT NULL UNIQUE,
    password_hash                 VARCHAR(255)  NOT NULL,
    role                          VARCHAR(30)   NOT NULL CHECK (role IN ('admin','peneraju_sektor','top_management')),
    sector                        VARCHAR(20)   CHECK (sector IN ('SDTM','SPIP','SPHEMK','SDP','SPK','SPKN')),
    is_active                     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
    id                            CHAR(36)      PRIMARY KEY,
    school_code                   VARCHAR(50)   NOT NULL UNIQUE,
    school_name                   VARCHAR(150)  NOT NULL,
    school_type                   VARCHAR(20)   NOT NULL CHECK (school_type IN ('SK','SMK','SJK','MRSM','SBP','SKK')),
    state                         VARCHAR(50),
    district                      VARCHAR(80),
    jn_audit_score                DECIMAL(5,2),
    last_audit_date               DATE,
    integrity_risk_index          DECIMAL(4,3)  NOT NULL DEFAULT 0 CHECK (integrity_risk_index BETWEEN 0 AND 1),
    canteen_hygiene_score         DECIMAL(5,2),
    emis_access_suspended         BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    id                            CHAR(36)      PRIMARY KEY,
    case_id                       VARCHAR(40)   NOT NULL UNIQUE,
    school_id                     CHAR(36)      NOT NULL,
    submitted_by                  CHAR(36)      NOT NULL,
    operational_score             DECIMAL(5,2)  NOT NULL,
    jn_audit_score                DECIMAL(5,2)  NOT NULL,
    discrepancy_index             DECIMAL(5,4)  NOT NULL,
    di_classification             VARCHAR(30)   NOT NULL CHECK (di_classification IN ('DATA_ALIGNED','MINOR_DISCREPANCY','MODERATE_DISCREPANCY','SEVERE_DISCREPANCY','EXTREME_DISCREPANCY')),
    alert_level                   VARCHAR(10)   NOT NULL CHECK (alert_level IN ('GREEN','BLUE','YELLOW','ORANGE','RED')),
    anomaly_detected              BOOLEAN       NOT NULL,
    incident_text                 TEXT          NOT NULL,
    category                      VARCHAR(80)   NOT NULL,
    severity                      VARCHAR(20)   NOT NULL,
    agent_a_confidence            DECIMAL(4,3)  NOT NULL DEFAULT 0,
    agent_b_confidence            DECIMAL(4,3)  NOT NULL DEFAULT 0,
    risk_flags                    JSON          NOT NULL,
    anomaly_score                 DECIMAL(5,4)  NOT NULL DEFAULT 0,
    status                        VARCHAR(20)   NOT NULL DEFAULT 'pending',
    payload_checksum               VARCHAR(64)   NOT NULL,
    source_system                 VARCHAR(50),
    agent_a_output                JSON,
    agent_b_output                JSON,
    created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cases_school_id FOREIGN KEY (school_id) REFERENCES schools(id),
    CONSTRAINT fk_cases_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- executive_briefs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS executive_briefs (
    id                            CHAR(36)      PRIMARY KEY,
    case_id                       CHAR(36)      NOT NULL UNIQUE,
    enforcement_actions           JSON          NOT NULL,
    policy_recommendations        JSON          NOT NULL,
    legal_references               JSON          NOT NULL,
    directive_text                TEXT          NOT NULL,
    rag_sources                   JSON,
    llm_model_used                VARCHAR(80),
    llm_prompt_hash                VARCHAR(64),
    reviewed_by                   CHAR(36),
    reviewed_at                   TIMESTAMP     NULL,
    signed_by_ketua_jn             BOOLEAN       NOT NULL DEFAULT FALSE,
    signed_by_audit_director       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_executive_briefs_case_id FOREIGN KEY (case_id) REFERENCES cases(id),
    CONSTRAINT fk_executive_briefs_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- data_sources
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_sources (
    id                            CHAR(36)      PRIMARY KEY,
    name                          VARCHAR(150)  NOT NULL,
    source_code                   VARCHAR(50)   NOT NULL UNIQUE,
    source_type                   VARCHAR(20)   NOT NULL CHECK (source_type IN ('api','document','manual')),
    source_category               VARCHAR(20)   NOT NULL DEFAULT 'outsource' CHECK (source_category IN ('jn_baseline','outsource')),
    is_active                     BOOLEAN       NOT NULL DEFAULT TRUE,
    api_url                       VARCHAR(500),
    api_auth_type                 VARCHAR(20)   CHECK (api_auth_type IN ('bearer','apikey','none')),
    api_auth_token                 VARCHAR(500),
    pull_schedule                 VARCHAR(20)   NOT NULL DEFAULT 'manual' CHECK (pull_schedule IN ('monthly','manual')),
    field_mappings                 JSON          NOT NULL,
    description                   TEXT,
    created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- ingestion_runs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_runs (
    id                            CHAR(36)      PRIMARY KEY,
    source_id                     CHAR(36),
    run_type                      VARCHAR(20)   NOT NULL CHECK (run_type IN ('scheduled','manual')),
    run_category                  VARCHAR(20)   NOT NULL DEFAULT 'outsource' CHECK (run_category IN ('jn_baseline','outsource')),
    triggered_by                  CHAR(36),
    started_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at                  TIMESTAMP     NULL,
    status                        VARCHAR(20)   NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','partial','failed')),
    records_created                INT           NOT NULL DEFAULT 0,
    cases_auto_created              INT           NOT NULL DEFAULT 0,
    error_log                     JSON,
    summary                       JSON,
    CONSTRAINT fk_ingestion_runs_source_id FOREIGN KEY (source_id) REFERENCES data_sources(id),
    CONSTRAINT fk_ingestion_runs_triggered_by FOREIGN KEY (triggered_by) REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- ingestion_records
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_records (
    id                            CHAR(36)      PRIMARY KEY,
    run_id                        CHAR(36)      NOT NULL,
    source_id                     CHAR(36)      NOT NULL,
    school_id                     CHAR(36),
    school_code_raw                VARCHAR(50)   NOT NULL,
    data_type                     VARCHAR(20)   NOT NULL DEFAULT 'quantitative' CHECK (data_type IN ('quantitative','qualitative','mixed')),
    jn_audit_score                DECIMAL(5,2),
    extracted_scores               JSON          NOT NULL,
    mapped_scores                  JSON          NOT NULL,
    composite_operational_score     DECIMAL(5,2),
    discrepancy_index             DECIMAL(5,4),
    di_classification             VARCHAR(30),
    agent0_confidence              DECIMAL(4,3)  NOT NULL DEFAULT 0,
    conversion_method              VARCHAR(20)   NOT NULL DEFAULT 'direct' CHECK (conversion_method IN ('direct','ai_converted','hybrid')),
    qualitative_text               TEXT,
    source_file_name               VARCHAR(255),
    pull_date                     DATE          NOT NULL,
    status                        VARCHAR(20)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','case_created','error')),
    reviewed_by                   CHAR(36),
    reviewed_at                   TIMESTAMP     NULL,
    review_notes                   TEXT,
    linked_case_id                 CHAR(36),
    error_message                  TEXT,
    created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ingestion_records_run_id FOREIGN KEY (run_id) REFERENCES ingestion_runs(id),
    CONSTRAINT fk_ingestion_records_source_id FOREIGN KEY (source_id) REFERENCES data_sources(id),
    CONSTRAINT fk_ingestion_records_school_id FOREIGN KEY (school_id) REFERENCES schools(id),
    CONSTRAINT fk_ingestion_records_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id),
    CONSTRAINT fk_ingestion_records_linked_case_id FOREIGN KEY (linked_case_id) REFERENCES cases(id)
);

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id                            CHAR(36)      PRIMARY KEY,
    user_id                       CHAR(36)      NOT NULL,
    action                        VARCHAR(80)   NOT NULL,
    resource_type                  VARCHAR(50)   NOT NULL,
    resource_id                   CHAR(36),
    details                       JSON,
    created_at                    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =====================================================================
-- SUMMARY VIEWS
-- =====================================================================

-- Cases with a high discrepancy index (severe/extreme), for JN escalation review
DROP VIEW IF EXISTS v_cases_high_discrepancy;
CREATE VIEW v_cases_high_discrepancy AS
    SELECT c.*, s.school_code, s.school_name
    FROM cases c
    JOIN schools s ON s.id = c.school_id
    WHERE c.di_classification IN ('SEVERE_DISCREPANCY','EXTREME_DISCREPANCY');

-- Ingestion records awaiting Peneraju Sektor approve/reject
DROP VIEW IF EXISTS v_ingestion_pending_review;
CREATE VIEW v_ingestion_pending_review AS
    SELECT r.*, ds.name AS source_name, s.school_code
    FROM ingestion_records r
    JOIN data_sources ds ON ds.id = r.source_id
    LEFT JOIN schools s ON s.id = r.school_id
    WHERE r.status = 'pending';

-- Executive briefs not yet fully signed off
DROP VIEW IF EXISTS v_briefs_unsigned;
CREATE VIEW v_briefs_unsigned AS
    SELECT b.*, c.case_id, c.di_classification
    FROM executive_briefs b
    JOIN cases c ON c.id = b.case_id
    WHERE NOT (b.signed_by_ketua_jn AND b.signed_by_audit_director);

-- Most recent audit log activity per user
DROP VIEW IF EXISTS v_audit_recent_actions;
CREATE VIEW v_audit_recent_actions AS
    SELECT a.*, u.name AS user_name, u.role
    FROM audit_logs a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC;
