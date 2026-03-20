ALTER TABLE `users`
  ADD COLUMN `refresh_token_hash` VARCHAR(255) NULL,
  ADD COLUMN `refresh_token_expires_at` DATETIME NULL,
  ADD COLUMN `last_login_at` DATETIME NULL;

