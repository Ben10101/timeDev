CREATE TABLE `generated_apps` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `root_path` VARCHAR(500) NOT NULL,
    `stack_preset` VARCHAR(120) NOT NULL,
    `status` ENUM('draft', 'bootstrapping', 'ready', 'failed', 'archived') NOT NULL DEFAULT 'draft',
    `current_version` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `generated_apps_uuid_key`(`uuid`),
    UNIQUE INDEX `generated_apps_project_id_slug_key`(`project_id`, `slug`),
    INDEX `generated_apps_project_id_idx`(`project_id`),
    INDEX `generated_apps_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `generated_app_modules` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `generated_app_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `module_type` VARCHAR(80) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `status` ENUM('draft', 'bootstrapping', 'ready', 'failed', 'archived') NOT NULL DEFAULT 'ready',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `generated_app_modules_generated_app_id_idx`(`generated_app_id`),
    INDEX `generated_app_modules_module_type_idx`(`module_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `task_implementations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `generated_app_id` BIGINT UNSIGNED NOT NULL,
    `technical_spec_artifact_id` BIGINT UNSIGNED NULL,
    `implementation_plan_artifact_id` BIGINT UNSIGNED NULL,
    `status` ENUM('planned', 'in_progress', 'integrated', 'failed', 'cancelled') NOT NULL DEFAULT 'planned',
    `implementation_type` VARCHAR(80) NOT NULL,
    `target_branch` VARCHAR(120) NULL,
    `target_path` VARCHAR(500) NULL,
    `build_status` ENUM('queued', 'running', 'completed', 'failed') NULL,
    `test_status` ENUM('queued', 'running', 'completed', 'failed') NULL,
    `summary` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `task_implementations_uuid_key`(`uuid`),
    INDEX `task_implementations_task_id_idx`(`task_id`),
    INDEX `task_implementations_generated_app_id_idx`(`generated_app_id`),
    INDEX `task_implementations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `generated_files` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `generated_app_id` BIGINT UNSIGNED NOT NULL,
    `task_implementation_id` BIGINT UNSIGNED NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(80) NOT NULL,
    `change_type` ENUM('created', 'updated', 'deleted') NOT NULL,
    `checksum` VARCHAR(128) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `generated_files_generated_app_id_idx`(`generated_app_id`),
    INDEX `generated_files_task_implementation_id_idx`(`task_implementation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `generated_app_runs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `generated_app_id` BIGINT UNSIGNED NOT NULL,
    `task_implementation_id` BIGINT UNSIGNED NULL,
    `run_type` ENUM('bootstrap', 'implementation_plan', 'implementation_apply', 'validation') NOT NULL,
    `status` ENUM('queued', 'running', 'completed', 'failed') NOT NULL DEFAULT 'queued',
    `log_summary` LONGTEXT NULL,
    `started_at` DATETIME(0) NULL,
    `finished_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `generated_app_runs_uuid_key`(`uuid`),
    INDEX `generated_app_runs_generated_app_id_idx`(`generated_app_id`),
    INDEX `generated_app_runs_task_implementation_id_idx`(`task_implementation_id`),
    INDEX `generated_app_runs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `generated_apps` ADD CONSTRAINT `generated_apps_project_id_fkey`
FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `generated_app_modules` ADD CONSTRAINT `generated_app_modules_generated_app_id_fkey`
FOREIGN KEY (`generated_app_id`) REFERENCES `generated_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `task_implementations` ADD CONSTRAINT `task_implementations_task_id_fkey`
FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `task_implementations` ADD CONSTRAINT `task_implementations_generated_app_id_fkey`
FOREIGN KEY (`generated_app_id`) REFERENCES `generated_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `task_implementations` ADD CONSTRAINT `task_implementations_technical_spec_artifact_id_fkey`
FOREIGN KEY (`technical_spec_artifact_id`) REFERENCES `task_artifacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `task_implementations` ADD CONSTRAINT `task_implementations_implementation_plan_artifact_id_fkey`
FOREIGN KEY (`implementation_plan_artifact_id`) REFERENCES `task_artifacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `generated_files` ADD CONSTRAINT `generated_files_generated_app_id_fkey`
FOREIGN KEY (`generated_app_id`) REFERENCES `generated_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `generated_files` ADD CONSTRAINT `generated_files_task_implementation_id_fkey`
FOREIGN KEY (`task_implementation_id`) REFERENCES `task_implementations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `generated_app_runs` ADD CONSTRAINT `generated_app_runs_generated_app_id_fkey`
FOREIGN KEY (`generated_app_id`) REFERENCES `generated_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `generated_app_runs` ADD CONSTRAINT `generated_app_runs_task_implementation_id_fkey`
FOREIGN KEY (`task_implementation_id`) REFERENCES `task_implementations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
