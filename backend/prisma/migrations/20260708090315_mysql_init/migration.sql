-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `sector` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schools` (
    `id` VARCHAR(191) NOT NULL,
    `school_code` VARCHAR(191) NOT NULL,
    `school_name` VARCHAR(191) NOT NULL,
    `school_type` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `jn_audit_score` DOUBLE NULL,
    `last_audit_date` VARCHAR(191) NULL,
    `integrity_risk_index` DOUBLE NOT NULL DEFAULT 0,
    `canteen_hygiene_score` DOUBLE NULL,
    `emis_access_suspended` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `schools_school_code_key`(`school_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cases` (
    `id` VARCHAR(191) NOT NULL,
    `case_id` VARCHAR(191) NOT NULL,
    `school_id` VARCHAR(191) NOT NULL,
    `submitted_by` VARCHAR(191) NOT NULL,
    `operational_score` DOUBLE NOT NULL,
    `jn_audit_score` DOUBLE NOT NULL,
    `discrepancy_index` DOUBLE NOT NULL,
    `di_classification` VARCHAR(191) NOT NULL,
    `alert_level` VARCHAR(191) NOT NULL,
    `anomaly_detected` BOOLEAN NOT NULL,
    `incident_text` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `agent_a_confidence` DOUBLE NOT NULL DEFAULT 0,
    `agent_b_confidence` DOUBLE NOT NULL DEFAULT 0,
    `risk_flags` TEXT NOT NULL DEFAULT '[]',
    `anomaly_score` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `payload_checksum` VARCHAR(191) NOT NULL,
    `source_system` VARCHAR(191) NULL,
    `agent_a_output` TEXT NULL,
    `agent_b_output` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cases_case_id_key`(`case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `executive_briefs` (
    `id` VARCHAR(191) NOT NULL,
    `case_id` VARCHAR(191) NOT NULL,
    `enforcement_actions` TEXT NOT NULL,
    `policy_recommendations` TEXT NOT NULL,
    `legal_references` TEXT NOT NULL,
    `directive_text` TEXT NOT NULL,
    `rag_sources` TEXT NULL,
    `llm_model_used` VARCHAR(191) NULL,
    `llm_prompt_hash` VARCHAR(191) NULL,
    `reviewed_by` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `signed_by_ketua_jn` BOOLEAN NOT NULL DEFAULT false,
    `signed_by_audit_director` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `executive_briefs_case_id_key`(`case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_sources` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `source_code` VARCHAR(191) NOT NULL,
    `source_type` VARCHAR(191) NOT NULL,
    `source_category` VARCHAR(191) NOT NULL DEFAULT 'outsource',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `api_url` VARCHAR(191) NULL,
    `api_auth_type` VARCHAR(191) NULL,
    `api_auth_token` TEXT NULL,
    `pull_schedule` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `field_mappings` TEXT NOT NULL DEFAULT '{}',
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `data_sources_source_code_key`(`source_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingestion_runs` (
    `id` VARCHAR(191) NOT NULL,
    `source_id` VARCHAR(191) NULL,
    `run_type` VARCHAR(191) NOT NULL,
    `run_category` VARCHAR(191) NOT NULL DEFAULT 'outsource',
    `triggered_by` VARCHAR(191) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'running',
    `records_created` INTEGER NOT NULL DEFAULT 0,
    `cases_auto_created` INTEGER NOT NULL DEFAULT 0,
    `error_log` TEXT NULL,
    `summary` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingestion_records` (
    `id` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NOT NULL,
    `source_id` VARCHAR(191) NOT NULL,
    `school_id` VARCHAR(191) NULL,
    `school_code_raw` VARCHAR(191) NOT NULL,
    `data_type` VARCHAR(191) NOT NULL DEFAULT 'quantitative',
    `jn_audit_score` DOUBLE NULL,
    `extracted_scores` TEXT NOT NULL DEFAULT '{}',
    `mapped_scores` TEXT NOT NULL DEFAULT '{}',
    `composite_operational_score` DOUBLE NULL,
    `discrepancy_index` DOUBLE NULL,
    `di_classification` VARCHAR(191) NULL,
    `agent0_confidence` DOUBLE NOT NULL DEFAULT 0,
    `conversion_method` VARCHAR(191) NOT NULL DEFAULT 'direct',
    `qualitative_text` TEXT NULL,
    `source_file_name` VARCHAR(191) NULL,
    `pull_date` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `reviewed_by` VARCHAR(191) NULL,
    `reviewed_at` VARCHAR(191) NULL,
    `review_notes` TEXT NULL,
    `linked_case_id` VARCHAR(191) NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `resource_type` VARCHAR(191) NOT NULL,
    `resource_id` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cases` ADD CONSTRAINT `cases_submitted_by_fkey` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `executive_briefs` ADD CONSTRAINT `executive_briefs_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `executive_briefs` ADD CONSTRAINT `executive_briefs_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingestion_runs` ADD CONSTRAINT `ingestion_runs_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingestion_runs` ADD CONSTRAINT `ingestion_runs_triggered_by_fkey` FOREIGN KEY (`triggered_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingestion_records` ADD CONSTRAINT `ingestion_records_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `ingestion_runs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingestion_records` ADD CONSTRAINT `ingestion_records_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `data_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingestion_records` ADD CONSTRAINT `ingestion_records_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingestion_records` ADD CONSTRAINT `ingestion_records_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
