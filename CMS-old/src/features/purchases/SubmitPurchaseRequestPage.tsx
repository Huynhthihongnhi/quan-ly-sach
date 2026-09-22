import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitPurchaseRequest } from '@/lib/api/purchases';
import { ApiClientError } from '@/lib/api/types';
import {
  buildPurchaseRequestIdempotencyKey,
  createPurchaseRequestAttemptId,
} from '@/lib/purchases/purchase-request-idempotency';

export function SubmitPurchaseRequestPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [authorText, setAuthorText] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attemptIdRef = useRef(createPurchaseRequestAttemptId());
  const payloadRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlightRef.current || submitting) {
      return;
    }
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);

    const year = Number(publicationYear);
    const payloadIdentity = JSON.stringify([title.trim(), authorText.trim(), year, note.trim()]);
    if (payloadRef.current !== null && payloadRef.current !== payloadIdentity) {
      attemptIdRef.current = createPurchaseRequestAttemptId();
    }
    payloadRef.current = payloadIdentity;
    const idempotencyKey = buildPurchaseRequestIdempotencyKey(attemptIdRef.current);

    try {
      await submitPurchaseRequest(
        {
          title: title.trim(),
          authorText: authorText.trim(),
          publicationYear: year,
          note: note.trim() || undefined,
        },
        idempotencyKey,
      );
      attemptIdRef.current = createPurchaseRequestAttemptId();
      payloadRef.current = null;
      navigate('/me/purchase-requests');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not submit the request.');
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Request a book</h1>
      <p className="text-sm text-slate-600">
        Ask the library to add a title that is not in the catalog yet.{' '}
        <Link to="/me/purchase-requests" className="font-medium text-blue-700 hover:underline">
          View your requests
        </Link>
      </p>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <form className="grid max-w-md gap-3" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <Label htmlFor="purchase-title">Title</Label>
          <Input
            id="purchase-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={300}
          />
        </div>
        <div>
          <Label htmlFor="purchase-author">Author</Label>
          <Input
            id="purchase-author"
            value={authorText}
            onChange={(event) => setAuthorText(event.target.value)}
            required
            maxLength={300}
          />
        </div>
        <div>
          <Label htmlFor="purchase-year">Publication year</Label>
          <Input
            id="purchase-year"
            type="number"
            min={1000}
            max={9999}
            value={publicationYear}
            onChange={(event) => setPublicationYear(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="purchase-note">Note (optional)</Label>
          <Input
            id="purchase-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit request'}
        </Button>
      </form>
    </div>
  );
}
