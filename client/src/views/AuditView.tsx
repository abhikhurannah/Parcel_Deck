import { useCallback } from 'react';
import type { AuditRecord } from '../../../shared/types';
import type { Api } from '../api';
import { Heading, LoadStatus, useResource } from '../components';
interface Props {
  api: Api;
  revision: number;
}
export function AuditView({ api, revision }: Props) {
  const resource = useResource(
    useCallback(() => api<{ items: AuditRecord[] }>('/audit'), [api]),
    revision,
  );
  return (
    <>
      <Heading
        eyebrow="ACCOUNTABILITY"
        title="Audit trail"
        description="The latest 100 changes, with actor, timestamp and investigation ID."
      />
      <LoadStatus {...resource} />
      {resource.data?.items.map((item) => (
        <article className="audit-item" key={item.id}>
          <h2>
            {item.action.replaceAll('_', ' ')} · {item.actor}
          </h2>
          <p>{item.detail}</p>
          <small>
            {new Date(item.created_at).toLocaleString()} · Request {item.request_id}
          </small>
        </article>
      ))}
    </>
  );
}
