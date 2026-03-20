ALTER TABLE `task_artifacts`
  ADD COLUMN `task_implementation_id` BIGINT UNSIGNED NULL AFTER `task_id`,
  ADD COLUMN `artifact_scope` ENUM('refinement', 'implementation') NOT NULL DEFAULT 'refinement' AFTER `artifact_type`;

CREATE INDEX `task_artifacts_task_implementation_id_idx` ON `task_artifacts`(`task_implementation_id`);
CREATE INDEX `task_artifacts_artifact_scope_idx` ON `task_artifacts`(`artifact_scope`);
CREATE INDEX `task_artifacts_task_id_artifact_scope_is_current_idx` ON `task_artifacts`(`task_id`, `artifact_scope`, `is_current`);

ALTER TABLE `task_artifacts`
  ADD CONSTRAINT `task_artifacts_task_implementation_id_fkey`
  FOREIGN KEY (`task_implementation_id`) REFERENCES `task_implementations`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
