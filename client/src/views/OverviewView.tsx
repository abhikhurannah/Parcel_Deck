import { useCallback } from 'react';
import type { Overview, ParcelPage, Role } from '../../../shared/types';
import type { Api } from '../api';
import { Heading, LoadStatus, ParcelTable, useResource } from '../components';
interface Props {
  api: Api;
  revision: number;
}
export function OverviewView({
  api,
  revision,
  role,
  onNew,
  onImport,
  onAll,
  onRefresh,
  onQueue,
}: {
  role: Role;
  onNew: () => void;
  onImport: () => void;
  onAll: () => void;
  onRefresh: () => void;
  onQueue: () => void;
} & Props) {
  const resource = useResource(
    useCallback(async () => {
      const [overview, parcels] = await Promise.all([
        api<Overview>('/overview'),
        api<ParcelPage>('/parcels'),
      ]);
      return { overview, parcels };
    }, [api]),
    revision,
  );
  const data = resource.data?.overview;
  return (
    <>
      <Heading
        eyebrow="YOUR OPERATIONS AT A GLANCE"
        title="Routing overview"
        description="A clear view of every parcel, from intake to its next department."
      >
        {role !== 'insurer' && (
          <button className="primary" onClick={onNew}>
            ＋ New parcel
          </button>
        )}
      </Heading>
      <LoadStatus {...resource} />
      {data && (
        <>
          <div className="stats">
            {[
              ['Total parcels', data.total, 'Across all batches'],
              ['Successfully routed', data.counts.routed ?? 0, 'Ready for their department'],
              [
                'Awaiting insurance',
                data.counts.pending_insurance ?? 0,
                'Approval needed before routing',
              ],
              ['Rejected', data.counts.rejected ?? 0, 'Held out of delivery'],
            ].map(([title, count, hint]) => (
              <article key={title}>
                <p>{title}</p>
                <strong>{Number(count).toLocaleString()}</strong>
                <small>{hint}</small>
              </article>
            ))}
          </div>
          <div className="overview-grid">
            <article className="panel">
              <div className="panel-heading">
                <h2>Department distribution</h2>
                <span className="tag">Routed parcels</span>
              </div>
              <div className="distribution">
                {data.departments.length ? (
                  data.departments.map((d) => (
                    <div
                      className={`bar-row${d.active ? '' : ' retired-department'}`}
                      key={d.department}
                    >
                      <span>
                        {d.department}
                        {!d.active && <small> · retired</small>}
                      </span>
                      <progress
                        aria-label={`${d.department}: ${d.count} routed parcels`}
                        value={d.count}
                        max={data.counts.routed || 1}
                      />
                      <strong>{d.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="empty">Department totals appear after your first routed parcel.</p>
                )}
              </div>
              <p className="panel-foot">
                Insurance holds are excluded until approval. Current departments include zero
                counts; retired departments retain historical counts.
              </p>
            </article>
            {role === 'insurer' && (
              <article className="panel insurer-queue-card">
                <p className="eyebrow">YOUR REVIEW DESK</p>
                <h2>Every review moves a parcel forward.</h2>
                <p className="muted">
                  {data.counts.pending_insurance ?? 0} parcels await an insurance decision. Review
                  each case and record your reason.
                </p>
                <button className="primary" onClick={onQueue}>
                  Open insurance queue →
                </button>
              </article>
            )}
            {role !== 'insurer' && (
              <article className="panel">
                <p className="eyebrow">BATCH INTAKE</p>
                <h2>More parcels, less paperwork.</h2>
                <p className="muted">
                  Import JSON or the supplied container XML. Every row is checked before anything is
                  saved.
                </p>
                <button className="secondary" onClick={onImport}>
                  ↑ Import a batch
                </button>
                <div className="file-details">JSON or XML · Up to 2 MiB / 5,000 rows</div>
              </article>
            )}
          </div>
          <article className="panel signal-panel">
            <div>
              <span className="live-dot" />
              <h2>Operational signals</h2>
            </div>
            <ul>
              {(data.signals.length
                ? data.signals
                : ['No current backlog signals. Service is responding.']
              ).map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
            <button className="text-button" onClick={onRefresh}>
              Refresh overview ↻
            </button>
          </article>
          <div className="section-heading">
            <h2>Recent parcels</h2>
            <button className="text-button" onClick={onAll}>
              View all parcels →
            </button>
          </div>
          <ParcelTable items={resource.data!.parcels.items.slice(0, 6)} compact />
          <p className="muted policy-foot">Active policy v{data.policy_version}</p>
        </>
      )}
    </>
  );
}
