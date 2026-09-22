#!/bin/sh
# Runs once, only when the mysql container initializes an empty data directory (the official
# mysql image sources every docker-entrypoint-initdb.d/*.sh after creating MYSQL_DATABASE, using
# the same env_file this compose service already loads). Creates the least-privilege app user
# (DML only, used by api/worker at runtime) and the separate migration user (DDL, used only by
# the one-off migration-runner CLI), instead of api/worker running as root.
set -eu

: "${DATABASE_USERNAME:?DATABASE_USERNAME must be set}"
: "${DATABASE_PASSWORD:?DATABASE_PASSWORD must be set}"
: "${DATABASE_MIGRATION_USERNAME:?DATABASE_MIGRATION_USERNAME must be set}"
: "${DATABASE_MIGRATION_PASSWORD:?DATABASE_MIGRATION_PASSWORD must be set}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE must be set}"

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<-SQL
  CREATE USER IF NOT EXISTS '${DATABASE_USERNAME}'@'%' IDENTIFIED BY '${DATABASE_PASSWORD}';
  CREATE USER IF NOT EXISTS '${DATABASE_MIGRATION_USERNAME}'@'%' IDENTIFIED BY '${DATABASE_MIGRATION_PASSWORD}';

  GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO '${DATABASE_USERNAME}'@'%';
  GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${DATABASE_MIGRATION_USERNAME}'@'%';

  FLUSH PRIVILEGES;
SQL
