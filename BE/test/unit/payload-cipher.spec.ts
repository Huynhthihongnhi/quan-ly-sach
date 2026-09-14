import { PayloadCipherService } from '../../src/modules/messaging/payload-cipher.service';
import { MessagingConfigService } from '../../src/modules/messaging/messaging-config.service';

describe('PayloadCipherService', () => {
  const config = new MessagingConfigService();
  const cipher = new PayloadCipherService(config);

  it('round-trips outbox payload encryption', () => {
    const payload = {
      token: 'secret-token-value',
      linkUrl: 'http://127.0.0.1:5173/reset-password?token=secret-token-value',
    };
    const encrypted = cipher.encrypt(payload);
    const decrypted = cipher.decrypt(encrypted.ciphertext, encrypted.keyId);
    expect(decrypted).toEqual(payload);
  });
});
