import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';

export const NEW_PASSWORD_MIN_LENGTH = 12;

export function assertNewPasswordPolicy(password: string): void {
  if (password.length < NEW_PASSWORD_MIN_LENGTH) {
    throw new ApiException(
      422,
      ErrorCode.VALIDATION_FAILED,
      'Password does not meet policy requirements.',
      [{ field: 'newPassword', code: 'TOO_SHORT' }],
    );
  }
}
