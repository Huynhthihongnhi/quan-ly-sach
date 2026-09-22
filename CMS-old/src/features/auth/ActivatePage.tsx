import { activateAccount } from '@/lib/api/auth';
import { ChallengePasswordPage } from './ChallengePasswordPage';

export function ActivatePage(): React.JSX.Element {
  return (
    <ChallengePasswordPage
      title="Activate your account"
      description="Choose a password to finish activating your account."
      submitLabel="Activate account"
      successMessage="Account activated. Sign in with your new password."
      forgotPasswordPath="/login"
      onSubmit={activateAccount}
    />
  );
}
