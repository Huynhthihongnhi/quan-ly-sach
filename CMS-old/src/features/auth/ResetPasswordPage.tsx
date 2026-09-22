import { resetPassword } from '@/lib/api/auth';
import { ChallengePasswordPage } from './ChallengePasswordPage';

export function ResetPasswordPage(): React.JSX.Element {
  return (
    <ChallengePasswordPage
      title="Choose a new password"
      description="Enter a new password for your account."
      submitLabel="Reset password"
      successMessage="Password updated. Sign in with your new password."
      onSubmit={resetPassword}
    />
  );
}
