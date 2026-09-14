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
