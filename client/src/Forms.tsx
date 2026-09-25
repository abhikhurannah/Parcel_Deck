import { useRef, useState, type FormEvent } from 'react';
import type { BatchResult, ParcelRecord } from '../../shared/types';
import { type Api } from './api';
import { Modal } from './components';
interface FormProps {
  api: Api;
  onClose: () => void;
  onSuccess: (message: string) => void;
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to complete the request.';
}
export function ParcelForm({ api, onClose, onSuccess }: FormProps) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    key.current ??= crypto.randomUUID();
    try {
      const result = await api<BatchResult>(
        '/parcels',
        { method: 'POST', headers: { 'Idempotency-Key': key.current } },
        Object.fromEntries(new FormData(form)),
      );
      onSuccess(
        `Parcel #${result.first_id} saved. ${result.counts.pending_insurance ? 'Insurance approval is required before routing.' : 'Successfully routed.'}`,
      );
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Route a new parcel" onClose={onClose}>
      <form
        onSubmit={submit}
        onChange={() => {
          key.current = null;
        }}
      >
        <label>
          Reference (optional)
          <input name="reference" maxLength={80} placeholder="e.g. ORD-2026-001" />
        </label>
        <div className="form-grid">
          <label>
            Weight (kg)
            <input name="weight" type="number" min="0.001" max="100000" step="0.001" required />
          </label>
          <label>
            Declared value (€)
            <input name="value" type="number" min="0" max="1000000000" step="0.01" required />
          </label>
        </div>
        <label>
          Destination country
          <input
            name="country"
            required
            minLength={2}
            maxLength={2}
            pattern="[A-Za-z]{2}"
            placeholder="Two-letter code, e.g. NL, IN, US"
          />
        </label>
        <p className="callout">
          Parcels above the insurance threshold are held until an insurer approves them.
        </p>
        <p className="form-error" role="alert">
          {error}
        </p>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Processing…' : 'Check & route parcel →'}
        </button>
      </form>
    </Modal>
  );
}
export { ImportForm } from './views/ImportForm';
export function ApprovalForm({
  api,
  onClose,
  onSuccess,
  item,
}: FormProps & { item: ParcelRecord }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(
        `/parcels/${item.id}/approval`,
        { method: 'POST' },
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      onSuccess(`Insurance decision recorded for parcel #${item.id}.`);
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Review parcel #${item.id}`} onClose={onClose}>
      <p className="muted">
        {item.weight} kg · €{item.value} · Proposed department: {item.department}
      </p>
      <form onSubmit={submit}>
        <label>
          Decision
          <select name="decision">
            <option value="approve">Approve and route</option>
            <option value="reject">Reject and hold out of delivery</option>
          </select>
        </label>
        <label>
          Review reason
          <textarea name="reason" minLength={5} maxLength={500} rows={4} required />
        </label>
        <p className="form-error" role="alert">
          {error}
        </p>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Recording…' : 'Record insurance decision'}
        </button>
      </form>
    </Modal>
  );
}
