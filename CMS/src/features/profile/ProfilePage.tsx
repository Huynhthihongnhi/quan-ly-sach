import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchOwnLibraryCards, type LibraryCardRecord } from '@/lib/api/library-cards';
import { fetchOwnProfile, updateOwnProfile, type ProfileRecord } from '@/lib/api/profile';
import { ApiClientError } from '@/lib/api/types';

export function ProfilePage(): React.JSX.Element {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [libraryCards, setLibraryCards] = useState<LibraryCardRecord[]>([]);
  const [cardsError, setCardsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await fetchOwnProfile();
        if (!active) {
          return;
        }
        setProfile(loaded);
        setDisplayName(loaded.displayName);
        setPhone(loaded.phone ?? '');
        try {
          const cards = await fetchOwnLibraryCards();
          if (!active) {
            return;
          }
          setLibraryCards(cards);
          setCardsError(null);
        } catch {
          if (!active) {
            return;
          }
          setLibraryCards([]);
          setCardsError('Unable to load library cards.');
        }
      } catch (caught) {
        if (!active) {
          return;
        }
        const message =
          caught instanceof ApiClientError
            ? caught.message
            : 'Unable to load profile. Check your connection and try again.';
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!profile || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateOwnProfile({
        displayName,
        phone: phone.trim() === '' ? null : phone,
        version: profile.version,
      });
      setProfile(updated);
      setDisplayName(updated.displayName);
      setPhone(updated.phone ?? '');
      setSuccess('Profile saved.');
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'VERSION_CONFLICT') {
        setError('Profile changed elsewhere. Reload the page and try again.');
        return;
      }
      const message =
        caught instanceof ApiClientError
          ? caught.message
          : 'Unable to save profile. Check your connection and try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading profile...</p>;
  }

  if (!profile) {
    return (
      <Alert variant="destructive" aria-live="assertive">
        {error ?? 'Profile is unavailable.'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="max-w-lg space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              name="displayName"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          {success ? <Alert aria-live="polite">{success}</Alert> : null}
          {error ? (
            <Alert variant="destructive" aria-live="assertive">
              {error}
            </Alert>
          ) : null}
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Saving...' : 'Save profile'}
          </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Library cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cardsError ? <Alert variant="destructive">{cardsError}</Alert> : null}
          {libraryCards.length === 0 ? (
            <p className="text-sm text-slate-600">
              No library cards are linked to your account yet. Staff must issue a card before you can
              borrow or download protected items.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {libraryCards.map((card) => (
                <li key={card.id} className="px-4 py-3 text-sm">
                  <p className="font-medium text-slate-900">{card.cardNumber}</p>
                  <p className="text-slate-600">
                    {card.state} · expires {new Date(card.expiresAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
