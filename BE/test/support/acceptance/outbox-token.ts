import { createConnection, type RowDataPacket } from 'mysql2/promise';
import { PayloadCipherService } from '../../../src/modules/messaging/payload-cipher.service';

export async function readLatestOutboxToken(
  payloadCipher: PayloadCipherService,
  templateCode: 'reset_password' | 'activate_account',
): Promise<{ token: string; linkUrl: string }> {
  const connection = await openRawConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT encrypted_payload, encryption_key_id
       FROM email_outbox
       WHERE template_code = ?
       ORDER BY id DESC
       LIMIT 1`,
      [templateCode],
    );
    const row = rows[0];
    if (!row?.encrypted_payload || !row.encryption_key_id) {
      throw new Error(`Missing outbox payload for ${templateCode}`);
    }
    return payloadCipher.decrypt(row.encrypted_payload as Buffer, String(row.encryption_key_id));
  } finally {
    await connection.end();
  }
}

async function openRawConnection() {
  return createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
  });
}
