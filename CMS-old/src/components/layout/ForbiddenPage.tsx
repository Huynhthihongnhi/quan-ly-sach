import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function ForbiddenPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-lg p-6">
      <Alert variant="destructive" aria-live="assertive">
        You do not have permission to access this page.
      </Alert>
      <div className="mt-4">
        <Button asChild variant="outline">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
