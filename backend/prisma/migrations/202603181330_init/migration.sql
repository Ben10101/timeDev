-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `role` ENUM('owner', 'admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
    `status` ENUM('active', 'inactive', 'invited') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `users_uuid_key`(`uuid`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspaces` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `owner_user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `workspaces_uuid_key`(`uuid`),
    UNIQUE INDEX `workspaces_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `workspace_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `vision` TEXT NULL,
    `status` ENUM('draft', 'active', 'on_hold', 'completed', 'archived') NOT NULL DEFAULT 'draft',
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `projects_uuid_key`(`uuid`),
    INDEX `projects_workspace_id_idx`(`workspace_id`),
    INDEX `projects_created_by_idx`(`created_by`),
    UNIQUE INDEX `projects_workspace_id_slug_key`(`workspace_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_members` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `project_role` ENUM('owner', 'manager', 'editor', 'viewer') NOT NULL DEFAULT 'editor',
    `joined_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `project_members_user_id_idx`(`user_id`),
    UNIQUE INDEX `project_members_project_id_user_id_key`(`project_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `parent_task_id` BIGINT UNSIGNED NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` LONGTEXT NULL,
    `task_type` ENUM('epic', 'story', 'task', 'subtask', 'bug', 'test_case', 'agent_job') NOT NULL DEFAULT 'task',
    `status` ENUM('backlog', 'todo', 'in_progress', 'in_review', 'qa', 'done', 'blocked', 'archived') NOT NULL DEFAULT 'backlog',
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `assignee_type` ENUM('human', 'agent', 'unassigned') NOT NULL DEFAULT 'unassigned',
    `assignee_user_id` BIGINT UNSIGNED NULL,
    `assignee_agent_name` VARCHAR(100) NULL,
    `reporter_user_id` BIGINT UNSIGNED NULL,
    `position` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `story_points` DECIMAL(5, 2) NULL,
    `due_date` DATETIME(0) NULL,
    `started_at` DATETIME(0) NULL,
    `completed_at` DATETIME(0) NULL,
    `current_artifact_summary` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `tasks_uuid_key`(`uuid`),
    INDEX `tasks_project_id_status_idx`(`project_id`, `status`),
    INDEX `tasks_project_id_parent_task_id_idx`(`project_id`, `parent_task_id`),
    INDEX `tasks_assignee_user_id_idx`(`assignee_user_id`),
    INDEX `tasks_reporter_user_id_idx`(`reporter_user_id`),
    INDEX `tasks_created_by_idx`(`created_by`),
    INDEX `tasks_assignee_agent_name_idx`(`assignee_agent_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_dependencies` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `depends_on_task_id` BIGINT UNSIGNED NOT NULL,
    `dependency_type` ENUM('blocks', 'relates_to', 'duplicates', 'child_of') NOT NULL DEFAULT 'blocks',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `task_dependencies_depends_on_task_id_idx`(`depends_on_task_id`),
    UNIQUE INDEX `task_dependencies_task_id_depends_on_task_id_dependency_type_key`(`task_id`, `depends_on_task_id`, `dependency_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_comments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `author_user_id` BIGINT UNSIGNED NULL,
    `author_agent_name` VARCHAR(100) NULL,
    `body` LONGTEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `task_comments_task_id_idx`(`task_id`),
    INDEX `task_comments_author_user_id_idx`(`author_user_id`),
    INDEX `task_comments_author_agent_name_idx`(`author_agent_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_runs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `project_id` BIGINT UNSIGNED NOT NULL,
    `task_id` BIGINT UNSIGNED NULL,
    `agent_name` VARCHAR(100) NOT NULL,
    `trigger_type` ENUM('manual', 'workflow', 'scheduled', 'api') NOT NULL DEFAULT 'manual',
    `input_payload` LONGTEXT NOT NULL,
    `output_text` LONGTEXT NULL,
    `output_format` ENUM('markdown', 'json', 'text', 'html') NOT NULL DEFAULT 'markdown',
    `status` ENUM('queued', 'running', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
    `started_by_user_id` BIGINT UNSIGNED NULL,
    `error_message` LONGTEXT NULL,
    `tokens_input` INTEGER UNSIGNED NULL,
    `tokens_output` INTEGER UNSIGNED NULL,
    `cost_usd` DECIMAL(12, 6) NULL,
    `started_at` DATETIME(0) NULL,
    `finished_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `agent_runs_uuid_key`(`uuid`),
    INDEX `agent_runs_project_id_idx`(`project_id`),
    INDEX `agent_runs_task_id_idx`(`task_id`),
    INDEX `agent_runs_agent_name_idx`(`agent_name`),
    INDEX `agent_runs_status_idx`(`status`),
    INDEX `agent_runs_started_by_user_id_idx`(`started_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_artifacts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `agent_run_id` BIGINT UNSIGNED NULL,
    `artifact_type` ENUM('idea', 'backlog', 'requirements', 'test_plan', 'test_case', 'architecture', 'code', 'review', 'deployment_notes', 'commentary', 'custom') NOT NULL DEFAULT 'custom',
    `title` VARCHAR(255) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `content_format` ENUM('markdown', 'json', 'text', 'html') NOT NULL DEFAULT 'markdown',
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `is_current` BOOLEAN NOT NULL DEFAULT true,
    `is_approved` BOOLEAN NOT NULL DEFAULT false,
    `approved_by` BIGINT UNSIGNED NULL,
    `approved_at` DATETIME(0) NULL,
    `created_by_user_id` BIGINT UNSIGNED NULL,
    `created_by_agent_name` VARCHAR(100) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `task_artifacts_uuid_key`(`uuid`),
    INDEX `task_artifacts_task_id_idx`(`task_id`),
    INDEX `task_artifacts_agent_run_id_idx`(`agent_run_id`),
    INDEX `task_artifacts_artifact_type_idx`(`artifact_type`),
    INDEX `task_artifacts_task_id_artifact_type_is_current_idx`(`task_id`, `artifact_type`, `is_current`),
    INDEX `task_artifacts_approved_by_idx`(`approved_by`),
    INDEX `task_artifacts_created_by_user_id_idx`(`created_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_status_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `from_status` ENUM('backlog', 'todo', 'in_progress', 'in_review', 'qa', 'done', 'blocked', 'archived') NULL,
    `to_status` ENUM('backlog', 'todo', 'in_progress', 'in_review', 'qa', 'done', 'blocked', 'archived') NOT NULL,
    `changed_by_user_id` BIGINT UNSIGNED NULL,
    `changed_by_agent_name` VARCHAR(100) NULL,
    `note` VARCHAR(500) NULL,
    `changed_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `task_status_history_task_id_idx`(`task_id`),
    INDEX `task_status_history_changed_by_user_id_idx`(`changed_by_user_id`),
    INDEX `task_status_history_changed_at_idx`(`changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_attachments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `uploaded_by_user_id` BIGINT UNSIGNED NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(120) NULL,
    `file_size_bytes` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `task_attachments_task_id_idx`(`task_id`),
    INDEX `task_attachments_uploaded_by_user_id_idx`(`uploaded_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_checklists` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_by_user_id` BIGINT UNSIGNED NULL,
    `completed_at` DATETIME(0) NULL,
    `position` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `task_checklists_task_id_idx`(`task_id`),
    INDEX `task_checklists_completed_by_user_id_idx`(`completed_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_parent_task_id_fkey` FOREIGN KEY (`parent_task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assignee_user_id_fkey` FOREIGN KEY (`assignee_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_reporter_user_id_fkey` FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependencies` ADD CONSTRAINT `task_dependencies_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependencies` ADD CONSTRAINT `task_dependencies_depends_on_task_id_fkey` FOREIGN KEY (`depends_on_task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_comments` ADD CONSTRAINT `task_comments_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_comments` ADD CONSTRAINT `task_comments_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_runs` ADD CONSTRAINT `agent_runs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_runs` ADD CONSTRAINT `agent_runs_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_runs` ADD CONSTRAINT `agent_runs_started_by_user_id_fkey` FOREIGN KEY (`started_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_artifacts` ADD CONSTRAINT `task_artifacts_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_artifacts` ADD CONSTRAINT `task_artifacts_agent_run_id_fkey` FOREIGN KEY (`agent_run_id`) REFERENCES `agent_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_artifacts` ADD CONSTRAINT `task_artifacts_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_artifacts` ADD CONSTRAINT `task_artifacts_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_status_history` ADD CONSTRAINT `task_status_history_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_status_history` ADD CONSTRAINT `task_status_history_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_attachments` ADD CONSTRAINT `task_attachments_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_attachments` ADD CONSTRAINT `task_attachments_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_checklists` ADD CONSTRAINT `task_checklists_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_checklists` ADD CONSTRAINT `task_checklists_completed_by_user_id_fkey` FOREIGN KEY (`completed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

