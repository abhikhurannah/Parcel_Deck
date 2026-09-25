import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ParcelRecord, Status } from '../../shared/types';
export const labels: Record<Status, string> = {
  routed: 'Routed',
  pending_insurance: 'Awaiting insurance',
  rejected: 'Rejected',
};
export function useResource<T>(loader: () => Promise<T>, revision = 0) {
  const [data, setData] = useState<T>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loader()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error) => {
        if (active) setError(error instanceof Error ? error.message : 'Unable to load data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loader, revision]);
  return { data, loading, error };
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-label={title}>
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="close" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ParcelTable({
  items,
  compact = false,
  onReview,
}: {
  items: ParcelRecord[];
  compact?: boolean;
  onReview?: (item: ParcelRecord) => void;
}) {
  if (!items.length)
    return (
      <div className="empty panel">
        <strong>No parcels to show</strong>
        <span>Create a parcel, import a batch, or change the filters.</span>
      </div>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {[
              'Parcel / Reference',
              'Destination',
              'Weight',
              'Value',
              'Department',
              'Status',
              ...(!compact ? ['Decision / Policy'] : []),
              ...(onReview ? ['Action'] : []),
            ].map((title) => (
              <th key={title} scope="col">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                #{String(item.id).padStart(5, '0')} · {item.reference || 'No reference'}
              </td>
              <td>{item.country}</td>
              <td>{item.weight} kg</td>
              <td>€{Number(item.value).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
              <td>
                {item.department}
                {item.status === 'pending_insurance'
                  ? ' (proposed)'
                  : item.status === 'rejected'
                    ? ' (not dispatched)'
                    : ''}
              </td>
              <td>
                <span className={`badge ${item.status}`}>{labels[item.status]}</span>
              </td>
              {!compact && (
                <td className="reason-cell">
                  {item.reason} [Policy v{item.policy_version}]
                </td>
              )}
              {onReview && (
                <td>
                  <button className="text-button" onClick={() => onReview(item)}>
                    Review →
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function LoadStatus({ loading, error }: { loading: boolean; error: string }) {
  return (
    <>
      {loading && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
