-- Local bootstrap for S0-03. Creates dev/test databases and separates app vs migration users.
-- Password placeholders are replaced at container first start via envsubst in entrypoint wrapper,
-- or use fixed dev passwords from compose env (local only).

CREATE DATABASE IF NOT EXISTS quan_ly_sach_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE DATABASE IF NOT EXISTS quan_ly_sach_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'app'@'%' IDENTIFIED BY 'local-app-change-me';
CREATE USER IF NOT EXISTS 'migration'@'%' IDENTIFIED BY 'local-migration-change-me';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON quan_ly_sach_dev.*
  TO 'app'@'%';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON quan_ly_sach_test.*
  TO 'app'@'%';

GRANT ALL PRIVILEGES
  ON quan_ly_sach_dev.*
  TO 'migration'@'%';

GRANT ALL PRIVILEGES
  ON quan_ly_sach_test.*
  TO 'migration'@'%';

FLUSH PRIVILEGES;
