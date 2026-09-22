import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError } from '@/lib/api/types';
import {
  CHALLENGE_INVALID_MESSAGE,
  PASSWORD_MIN_LENGTH,
} from '@/lib/constants/auth-messages';
import { apiFieldMessage } from '@/lib/forms/field-errors';

interface ChallengePasswordPageProps {
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  forgotPasswordPath?: string;
  onSubmit: (token: string, newPassword: string) => Promise<void>;
}

export function ChallengePasswordPage({
  title,
  description,
  submitLabel,
  successMessage,
  forgotPasswordPath = '/forgot-password',
  onSubmit,
}: ChallengePasswordPageProps): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tokenRef = useRef<string | null>(searchParams.get('token'));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [challengeInvalid, setChallengeInvalid] = useState(false);

  useEffect(() => {
    const meta = document.querySelector('meta[name="referrer"]');
    const previous = meta?.getAttribute('content') ?? null;
    if (!meta) {
      const created = document.createElement('meta');
      created.name = 'referrer';
      created.content = 'no-referrer';
      document.head.appendChild(created);
    } else {
      meta.setAttribute('content', 'no-referrer');
    }

    if (searchParams.has('token')) {
      setSearchParams({}, { replace: true });
    }

    return () => {
      if (meta && previous) {
        meta.setAttribute('content', previous);
      }
    };
  }, [searchParams, setSearchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting || completed) {
      return;
    }

    const token = tokenRef.current;
    if (!token) {
      setChallengeInvalid(true);
      setFormError(CHALLENGE_INVALID_MESSAGE);
      return;
    }

    const nextFieldErrors: { newPassword?: string; confirmPassword?: string } = {};
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      nextFieldErrors.newPassword = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (newPassword !== confirmPassword) {
      nextFieldErrors.confirmPassword = 'Passwords do not match.';
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    setChallengeInvalid(false);

    try {
      await onSubmit(token, newPassword);
      setCompleted(true);
      navigate('/login', {
        replace: true,
        state: { notice: successMessage },
      });
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'CHALLENGE_INVALID') {
        setChallengeInvalid(true);
        setFormError(caught.message);
        return;
      }

      if (caught instanceof ApiClientError) {
        setFieldErrors({
          newPassword: apiFieldMessage(caught.fields, 'newPassword') ?? undefined,
          confirmPassword: apiFieldMessage(caught.fields, 'confirmPassword') ?? undefined,
        });
        setFormError(caught.message);
        return;
      }

      setFormError('Unable to update password. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">{description}</p>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                disabled={completed}
                aria-invalid={Boolean(fieldErrors.newPassword)}
                aria-describedby={fieldErrors.newPassword ? 'new-password-error' : undefined}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              {fieldErrors.newPassword ? (
                <p id="new-password-error" className="text-sm text-red-700" role="alert">
                  {fieldErrors.newPassword}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                disabled={completed}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={
                  fieldErrors.confirmPassword ? 'confirm-password-error' : undefined
                }
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {fieldErrors.confirmPassword ? (
                <p id="confirm-password-error" className="text-sm text-red-700" role="alert">
                  {fieldErrors.confirmPassword}
                </p>
              ) : null}
            </div>
            {formError ? (
              <Alert variant="destructive" aria-live="assertive">
                {formError}
                {challengeInvalid ? (
                  <span className="mt-2 block">
                    <Link className="underline" to={forgotPasswordPath}>
                      Request a new reset link
                    </Link>
                  </span>
                ) : null}
              </Alert>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || completed}
              aria-busy={submitting}
            >
              {submitting ? 'Saving...' : submitLabel}
            </Button>
          </form>
          <p className="text-sm text-slate-600">
            <Link className="text-blue-700 underline" to="/login">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
