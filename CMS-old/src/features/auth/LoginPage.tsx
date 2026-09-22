import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';
import { resolvePostLoginPath } from '@/lib/navigation';

export function LoginPage(): React.JSX.Element {
  const { userId, permissionCodes, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (userId && permissionCodes.length > 0) {
    return (
      <Navigate
        to={resolvePostLoginPath(searchParams.get('from'), permissionCodes)}
        replace
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const permissionCodes = await login(email, password);
      navigate(resolvePostLoginPath(searchParams.get('from'), permissionCodes), { replace: true });
    } catch (caught) {
      const message =
        caught instanceof ApiClientError
          ? caught.message
          : 'Unable to sign in. Check your connection and try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to CMS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice ? <Alert aria-live="polite">{notice}</Alert> : null}
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? (
              <Alert variant="destructive" aria-live="assertive">
                {error}
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-slate-600">
            <Link className="text-blue-700 underline" to="/forgot-password">
              Forgot your password?
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
