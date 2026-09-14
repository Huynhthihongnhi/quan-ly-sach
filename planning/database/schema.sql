-- DESIGN DRAFT ONLY. Target: MySQL 8.4 / InnoDB, exact patch pending D05.
-- This file has not been executed. Split into reviewed versioned migrations.
-- No database creation, grants, production data, passwords or automatic rollback.
-- Application connections use UTC. API exposes BIGINT identifiers as strings.

-- S0-06: managed by the runner before application migrations.
CREATE TABLE schema_migrations (
  version BIGINT UNSIGNED NOT NULL,
  name VARCHAR(191) NOT NULL,
  up_checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  down_checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state VARCHAR(16) NOT NULL,
  direction VARCHAR(4) NOT NULL,
  runner_id VARCHAR(64) NOT NULL,
  started_at DATETIME(6) NOT NULL,
  finished_at DATETIME(6) NULL,
  error_code VARCHAR(64) NULL,
  PRIMARY KEY (version),
  CONSTRAINT chk_migrations_state CHECK (state IN ('running','applied','failed','rolled_back')),
  CONSTRAINT chk_migrations_direction CHECK (direction IN ('up','down'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- S1-01: identity and role-based access control.
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  password_hash VARCHAR(255) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'invited',
  email_verified_at DATETIME(6) NULL,
  auth_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  blocked_at DATETIME(6) NULL,
  archived_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_status_id (status, id),
  CONSTRAINT chk_users_status CHECK (status IN ('invited','active','blocked','archived')),
  CONSTRAINT chk_users_active_password CHECK (status <> 'active' OR password_hash IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  phone VARCHAR(32) NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  description VARCHAR(500) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NOT NULL,
  assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id, user_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_user_roles_actor FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id, role_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- S1-02: server-side session proposal; no plaintext cookie token in the DB.
CREATE TABLE auth_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL,
  csrf_hash BINARY(32) NOT NULL,
  auth_version BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at DATETIME(6) NOT NULL,
  idle_expires_at DATETIME(6) NOT NULL,
  absolute_expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user_revoked (user_id, revoked_at),
  KEY idx_sessions_cleanup (absolute_expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_sessions_expiry CHECK (idle_expires_at <= absolute_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- S1-05: all admin-removal/block/archive paths lock policy row 1 first.
CREATE TABLE iam_policy_locks (
  id TINYINT UNSIGNED NOT NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT chk_iam_lock_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NULL,
  outcome VARCHAR(16) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  details JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_audit_actor_time (actor_user_id, created_at),
  KEY idx_audit_target_time (target_type, target_id, created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_audit_outcome CHECK (outcome IN ('success','denied','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- S2-01: authentication challenges and durable email delivery.
CREATE TABLE identity_challenges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  purpose VARCHAR(24) NOT NULL,
  token_hash BINARY(32) NOT NULL,
  email_snapshot VARCHAR(254) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  consumed_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_challenges_token (token_hash),
  KEY idx_challenges_user_purpose (user_id, purpose, created_at),
  KEY idx_challenges_expiry (expires_at),
  CONSTRAINT fk_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_challenges_purpose CHECK (purpose IN ('reset_password','activate_account')),
  CONSTRAINT chk_challenges_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rate_limit_buckets (
  scope VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subject_hash BINARY(32) NOT NULL,
  window_start DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, subject_hash, window_start),
  KEY idx_rate_limit_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE email_outbox (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  challenge_id BIGINT UNSIGNED NULL,
  recipient VARCHAR(254) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  dedupe_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  encrypted_payload VARBINARY(8192) NULL,
  encryption_key_id VARCHAR(64) NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'queued',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  lease_owner VARCHAR(64) NULL,
  leased_until DATETIME(6) NULL,
  sent_at DATETIME(6) NULL,
  last_error_code VARCHAR(64) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_outbox_dedupe (dedupe_key),
  KEY idx_outbox_claim (state, available_at, id),
  KEY idx_outbox_lease (state, leased_until),
  CONSTRAINT fk_outbox_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_outbox_challenge FOREIGN KEY (challenge_id) REFERENCES identity_challenges(id) ON DELETE RESTRICT,
  CONSTRAINT chk_outbox_state CHECK (state IN ('queued','processing','sent','failed','cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- S3-01: an edition/title is distinct from its physical copies.
CREATE TABLE categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE authors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_authors_name (name, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE topics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_topics_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE books (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(300) NOT NULL,
  isbn VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL,
  publisher_name VARCHAR(200) NULL,
  publication_year SMALLINT UNSIGNED NULL,
  description TEXT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'draft',
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_books_isbn (isbn),
  KEY idx_books_public (state, id),
  KEY idx_books_filter (state, category_id, publication_year, id),
  CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_books_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_books_state CHECK (state IN ('draft','published','archived')),
  CONSTRAINT chk_books_year CHECK (publication_year IS NULL OR publication_year BETWEEN 1000 AND 9999)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE book_authors (
  book_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  author_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (book_id, author_id),
  KEY idx_book_authors_author (author_id, book_id),
  CONSTRAINT fk_book_authors_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
  CONSTRAINT fk_book_authors_author FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE book_topics (
  book_id BIGINT UNSIGNED NOT NULL,
  topic_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (book_id, topic_id),
  KEY idx_book_topics_topic (topic_id, book_id),
  CONSTRAINT fk_book_topics_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
  CONSTRAINT fk_book_topics_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE book_copies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id BIGINT UNSIGNED NOT NULL,
  barcode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  shelf_location VARCHAR(120) NULL,
  condition_state VARCHAR(16) NOT NULL DEFAULT 'serviceable',
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_copies_barcode (barcode),
  KEY idx_copies_allocation (book_id, condition_state, id),
  CONSTRAINT fk_copies_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
  CONSTRAINT chk_copies_condition CHECK (condition_state IN ('serviceable','repair','lost','retired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- S4-01 / S4-02: library cards and private digital file metadata.
CREATE TABLE library_cards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  card_number VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'active',
  issued_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  issued_by BIGINT UNSIGNED NOT NULL,
  active_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN state = 'active' THEN user_id ELSE NULL END) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cards_number (card_number),
  UNIQUE KEY uq_cards_active_user (active_user_id),
  UNIQUE KEY uq_cards_id_user (id, user_id),
  KEY idx_cards_user (user_id, id),
  CONSTRAINT fk_cards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cards_issuer FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_cards_state CHECK (state IN ('active','suspended','revoked','expired')),
  CONSTRAINT chk_cards_expiry CHECK (expires_at > issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE digital_assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id BIGINT UNSIGNED NOT NULL,
  storage_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mime_type VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL,
  content_hash BINARY(32) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'quarantine',
  read_access VARCHAR(16) NOT NULL DEFAULT 'authenticated',
  download_requires_card BOOLEAN NOT NULL DEFAULT TRUE,
  rights_note VARCHAR(500) NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_assets_storage_key (storage_key),
  KEY idx_assets_book_state (book_id, state),
  CONSTRAINT fk_assets_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
  CONSTRAINT fk_assets_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_assets_state CHECK (state IN ('quarantine','ready','rejected','archived')),
  CONSTRAINT chk_assets_access CHECK (read_access IN ('public','authenticated','card')),
  CONSTRAINT chk_assets_size CHECK (byte_size > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- S5-01: reservation and loan lifecycle on the same copy allocation.
CREATE TABLE loans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  card_id BIGINT UNSIGNED NOT NULL,
  copy_id BIGINT UNSIGNED NOT NULL,
  request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash BINARY(32) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'reserved',
  requested_days TINYINT UNSIGNED NOT NULL,
  reserved_at DATETIME(6) NOT NULL,
  reservation_expires_at DATETIME(6) NOT NULL,
  checked_out_at DATETIME(6) NULL,
  due_at DATETIME(6) NULL,
  closed_at DATETIME(6) NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  active_copy_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN state IN ('reserved','borrowed') THEN copy_id ELSE NULL END) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loans_request (user_id, request_key),
  UNIQUE KEY uq_loans_active_copy (active_copy_id),
  KEY idx_loans_card_user (card_id, user_id),
  KEY idx_loans_copy_history (copy_id, reserved_at),
  KEY idx_loans_user_state (user_id, state, id),
  KEY idx_loans_due (state, due_at, id),
  KEY idx_loans_reservation_expiry (state, reservation_expires_at, id),
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_loans_card_owner FOREIGN KEY (card_id, user_id) REFERENCES library_cards(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_loans_copy FOREIGN KEY (copy_id) REFERENCES book_copies(id) ON DELETE RESTRICT,
  CONSTRAINT chk_loans_state CHECK (state IN ('reserved','borrowed','returned','cancelled','expired','lost')),
  CONSTRAINT chk_loans_days CHECK (requested_days BETWEEN 1 AND 15),
  CONSTRAINT chk_loans_reservation CHECK (reservation_expires_at > reserved_at),
  CONSTRAINT chk_loans_due CHECK (due_at IS NULL OR (checked_out_at IS NOT NULL AND due_at > checked_out_at)),
  CONSTRAINT chk_loans_borrowed CHECK (state <> 'borrowed' OR (checked_out_at IS NOT NULL AND due_at IS NOT NULL)),
  CONSTRAINT chk_loans_closed CHECK (state NOT IN ('returned','cancelled','expired','lost') OR closed_at IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE loan_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  loan_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  from_state VARCHAR(16) NULL,
  to_state VARCHAR(16) NOT NULL,
  reason VARCHAR(500) NULL,
  request_id VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_loan_events_time (loan_id, created_at, id),
  CONSTRAINT fk_loan_events_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT,
  CONSTRAINT fk_loan_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  loan_id BIGINT UNSIGNED NOT NULL,
  due_at_snapshot DATETIME(6) NOT NULL,
  kind VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  outbox_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_loan_due_kind (loan_id, due_at_snapshot, kind),
  UNIQUE KEY uq_notifications_outbox (outbox_id),
  CONSTRAINT fk_notifications_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE RESTRICT,
  CONSTRAINT fk_notifications_outbox FOREIGN KEY (outbox_id) REFERENCES email_outbox(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- S6-01: acquisition requests, not payment transactions.
CREATE TABLE purchase_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(300) NOT NULL,
  author_text VARCHAR(300) NOT NULL,
  publication_year SMALLINT UNSIGNED NOT NULL,
  note VARCHAR(1000) NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'pending',
  request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash BINARY(32) NOT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  review_reason VARCHAR(1000) NULL,
  reviewed_at DATETIME(6) NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_request_key (requester_id, request_key),
  KEY idx_purchase_user_time (requester_id, created_at, id),
  KEY idx_purchase_queue (state, created_at, id),
  CONSTRAINT fk_purchase_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_state CHECK (state IN ('pending','approved','rejected')),
  CONSTRAINT chk_purchase_year CHECK (publication_year BETWEEN 1000 AND 9999),
  CONSTRAINT chk_purchase_review CHECK (state = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT chk_purchase_reject_reason CHECK (state <> 'rejected' OR (review_reason IS NOT NULL AND CHAR_LENGTH(TRIM(review_reason)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE purchase_request_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_request_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  from_state VARCHAR(16) NULL,
  to_state VARCHAR(16) NOT NULL,
  reason VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_purchase_events_time (purchase_request_id, created_at, id),
  CONSTRAINT fk_purchase_events_request FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
