DROP TABLE IF EXISTS orm_probe_events;
DROP TABLE IF EXISTS orm_probe_records;

CREATE TABLE orm_probe_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  external_id BIGINT UNSIGNED NOT NULL,
  tag BINARY(32) NOT NULL,
  observed_at DATETIME(6) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  label VARCHAR(120) NOT NULL,
  label_hash BINARY(32) AS (UNHEX(SHA2(label, 256))) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orm_probe_external_id (external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE orm_probe_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_orm_probe_events_record
    FOREIGN KEY (record_id) REFERENCES orm_probe_records (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
