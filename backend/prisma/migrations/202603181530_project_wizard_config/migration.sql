ALTER TABLE `projects`
  ADD COLUMN `start_mode` VARCHAR(50) NULL,
  ADD COLUMN `template_key` VARCHAR(100) NULL,
  ADD COLUMN `intake_config` JSON NULL,
  ADD COLUMN `board_config` JSON NULL,
  ADD COLUMN `agents_config` JSON NULL,
  ADD COLUMN `automation_config` JSON NULL;
