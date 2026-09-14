import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword } from '@/lib/api/auth';
import { ApiClientError } from '@/lib/api/types';
export function ForgotPasswordPage(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting || successMessage) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const message = await forgotPassword(email);
      setSuccessMessage(message);
    } catch (caught) {
      const message =
        caught instanceof ApiClientError
          ? caught.message
          : 'Unable to send reset instructions. Check your connection and try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Enter your email address. We will send reset instructions if an account exists.
          </p>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                disabled={Boolean(successMessage)}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {successMessage ? (
              <Alert aria-live="polite">{successMessage}</Alert>
            ) : null}
            {error ? (
              <Alert variant="destructive" aria-live="assertive">
                {error}
              </Alert>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || Boolean(successMessage)}
              aria-busy={submitting}
            >
              {submitting ? 'Sending...' : 'Send reset instructions'}
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
