import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getPublicBook } from '@/lib/api/catalog-public';
import { fetchLoanDetail, type LoanDetailRecord } from '@/lib/api/loans';
import { ApiClientError } from '@/lib/api/types';
import {
  buildLoanPrintDocumentTitle,
  formatLoanPrintDate,
  loanPrintContainsSensitiveFields,
} from '@/lib/circulation/loan-print';

export function LoanReceiptPage(): React.JSX.Element {
  const { id } = useParams();
  const [loan, setLoan] = useState<LoanDetailRecord | null>(null);
  const [bookTitle, setBookTitle] = useState<string>('—');
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError('Loan id is missing.');
      setLoading(false);
      return;
    }
    void fetchLoanDetail(id)
      .then(async (detail) => {
        setLoan(detail);
        setError(null);
        try {
          const book = await getPublicBook(detail.bookId);
          setBookTitle(book.title);
        } catch {
          setBookTitle(`Book ${detail.bookId}`);
        }
      })
      .catch((caught) => {
        setLoan(null);
        setError(caught instanceof ApiClientError ? caught.message : 'Failed to load loan.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handlePrint(): void {
    setPrintError(null);
    try {
      if (loan) {
        document.title = buildLoanPrintDocumentTitle({
          loanId: loan.id,
          bookTitle,
          state: loan.state,
          reservedAt: loan.reservedAt,
          checkedOutAt: loan.checkedOutAt,
          dueAt: loan.dueAt,
          reservationExpiresAt: loan.reservationExpiresAt,
        });
      }
      window.print();
    } catch {
      setPrintError('Printing is unavailable in this browser.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading loan receipt…</p>;
  }

  if (error || !loan) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">{error ?? 'Loan was not found.'}</Alert>
        <Link to="/me/loans" className="text-sm font-medium text-blue-700 hover:underline">
          Back to my loans
        </Link>
      </div>
    );
  }

  const receiptText = [
    loan.id,
    bookTitle,
    loan.state,
    loan.reservedAt,
    loan.dueAt ?? '',
  ].join(' ');

  return (
    <article className="loan-receipt space-y-4 rounded-lg border border-slate-200 bg-white p-6 print:border-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <Link to="/me/loans" className="text-sm font-medium text-blue-700 hover:underline">
          Back to my loans
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
          Print receipt
        </Button>
      </div>
      {printError ? <Alert variant="destructive">{printError}</Alert> : null}
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Loan receipt #{loan.id}</h1>
        <p className="text-sm text-slate-600">{bookTitle}</p>
      </header>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="font-medium text-slate-900">{loan.state}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Reserved</dt>
          <dd>{formatLoanPrintDate(loan.reservedAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Reservation expires</dt>
          <dd>{formatLoanPrintDate(loan.reservationExpiresAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Checked out</dt>
          <dd>{formatLoanPrintDate(loan.checkedOutAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Due</dt>
          <dd>{formatLoanPrintDate(loan.dueAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Requested days</dt>
          <dd>{loan.requestedDays}</dd>
        </div>
      </dl>
      {!loanPrintContainsSensitiveFields(receiptText) ? null : (
        <p className="text-xs text-red-600">Receipt must not include credentials.</p>
      )}
    </article>
  );
}
