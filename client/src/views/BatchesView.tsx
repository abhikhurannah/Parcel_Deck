import { useCallback, useState } from 'react';
import type { BatchRecord, ParcelPage } from '../../../shared/types';
import type { Api } from '../api';
import { Heading, LoadStatus, ParcelTable, useResource } from '../components';
export function BatchesView({ api, revision }: { api: Api; revision: number }) {
  const [page, setPage] = useState(1),
    [batch, setBatch] = useState<number>();
  const resource = useResource(
    useCallback(
      () => api<{ items: BatchRecord[]; total: number }>('/batches?page=' + page),
      [api, page],
    ),
    revision,
  );
  const parcels = useResource(
    useCallback(
      () => (batch ? api<ParcelPage>('/parcels?batch_id=' + batch) : Promise.resolve(undefined)),
      [api, batch],
    ),
    revision,
  );
  return (
    <>
      <Heading
        eyebrow="IMPORT HISTORY"
        title="Batches & results"
        description="Review accepted rows, insurance holds and rejected source rows."
      />
      <LoadStatus {...resource} />
      {resource.data?.items.map((b) => {
        const summary = JSON.parse(b.counts) as {
          counts: Record<string, number>;
          departments: Record<string, number>;
        };
        return (
          <article className="panel" key={b.id}>
            <h2>
              Batch #{b.id} · {b.filename}
            </h2>
            <p>
              {b.uploader} · {new Date(b.created_at).toLocaleString()} · Policy v{b.policy_version}
            </p>
            <p>
              {b.accepted} accepted / {b.rejected} rejected ·{' '}
              {summary.counts.pending_insurance ?? 0} insurance holds
            </p>
            <p>
              {Object.entries(summary.departments)
                .map(([name, n]) => `${name}: ${n}`)
                .join(' · ')}
            </p>
            <div className="actions">
              <button className="secondary" onClick={() => setBatch(b.id)}>
                View this batch
              </button>
              <a href={'/api/parcels.csv?batch_id=' + b.id}>Download results CSV</a>
              {b.rejected > 0 && <a href={`/api/batches/${b.id}/errors.csv`}>Rejected rows CSV</a>}
            </div>
          </article>
        );
      })}
      <div className="actions">
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Previous batches
        </button>
        <button
          disabled={page * 25 >= (resource.data?.total ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next batches
        </button>
      </div>
      {batch && (
        <section>
          <h2>Batch #{batch} · first 25 results</h2>
          <LoadStatus {...parcels} />
          <ParcelTable items={parcels.data?.items ?? []} />
          <a href={'/api/parcels.csv?batch_id=' + batch}>Download every result in this batch</a>
        </section>
      )}
    </>
  );
}
