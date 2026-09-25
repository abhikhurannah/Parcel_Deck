import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ParcelPage, ParcelRecord, Role } from '../../../shared/types';
import type { Api } from '../api';
import { Heading, labels, LoadStatus, ParcelTable, useResource } from '../components';
interface Props {
  api: Api;
  revision: number;
}
export function ParcelsView({
  api,
  revision,
  insurance = false,
  role,
  onReview,
  onNew,
  onImport,
}: Props & {
  insurance?: boolean;
  role: Role;
  onReview: (p: ParcelRecord) => void;
  onNew: () => void;
  onImport: () => void;
}) {
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState({
      status: '',
      search: '',
      batch_id: '',
      department: '',
      country: '',
      from: '',
      to: '',
      sort: 'newest',
    });
  const resource = useResource(
    useCallback(
      () =>
        api<ParcelPage>(
          `/parcels?${new URLSearchParams({ ...filters, page: String(page), status: insurance ? 'pending_insurance' : filters.status })}`,
        ),
      [api, page, insurance, filters],
    ),
    revision,
  );
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPage(1);
    setFilters(Object.fromEntries(values) as typeof filters);
  }
  useEffect(() => {
    if (resource.data && !resource.data.items.length && page > 1) setPage((p) => p - 1);
  }, [resource.data, page]);
  return (
    <>
      <Heading
        eyebrow={insurance ? 'REVIEW BEFORE RELEASE' : 'INTAKE & ROUTING'}
        title={insurance ? 'Insurance queue' : 'All parcels'}
        description={
          insurance
            ? 'These parcels have a proposed department. They have not been routed.'
            : 'Trace each decision to the policy that produced it.'
        }
      >
        {!insurance && role !== 'insurer' && (
          <div className="actions">
            <button className="secondary" onClick={onImport}>
              ↑ Import batch
            </button>
            <button className="primary" onClick={onNew}>
              ＋ New parcel
            </button>
          </div>
        )}
      </Heading>
      {insurance ? (
        <p className="callout">
          Only an insurer can approve or reject a hold. The original policy and review reason stay
          on record.
        </p>
      ) : (
        <form className="filters" onSubmit={filter}>
          <label className="search-label">
            Search reference or parcel ID
            <input name="search" maxLength={80} placeholder="Find a parcel…" />
          </label>
          <label>
            Status
            <select name="status">
              <option value="">All statuses</option>
              {Object.entries(labels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {(['batch_id', 'department', 'country', 'from', 'to'] as const).map((name) => (
            <label key={name}>
              {name.replace('_', ' ')}
              <input name={name} type={name === 'from' || name === 'to' ? 'date' : 'text'} />
            </label>
          ))}
          <label>
            Sort
            <select name="sort">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
          <button className="secondary" type="submit">
            Apply filters
          </button>
          <a href={'/api/parcels.csv?' + new URLSearchParams(filters)}>Export filtered CSV</a>
        </form>
      )}
      <LoadStatus {...resource} />
      {resource.data && (
        <>
          <ParcelTable
            items={resource.data.items}
            onReview={insurance && role === 'insurer' ? onReview : undefined}
          />
          <div className="pagination">
            <span>
              {resource.data.total} parcels · Page {page} of{' '}
              {Math.max(1, Math.ceil(resource.data.total / 25))}
            </span>
            <div>
              <button
                className="secondary"
                disabled={page === 1 || resource.loading}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <button
                className="secondary"
                disabled={page * 25 >= resource.data.total || resource.loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
