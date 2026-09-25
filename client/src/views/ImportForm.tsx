import { useRef, useState } from 'react';
import type { BatchResult, ImportPreview } from '../../../shared/types';
import type { Api } from '../api';
import { Modal } from '../components';
import { download, errorsCsv } from '../download';
export function ImportForm({
  api,
  onClose,
  onSuccess,
}: {
  api: Api;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [file, setFile] = useState<File>(),
    [country, setCountry] = useState(''),
    [partial, setPartial] = useState(false),
    [retain, setRetain] = useState(false),
    [preview, setPreview] = useState<ImportPreview>(),
    [result, setResult] = useState<BatchResult>(),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState('');
  const key = useRef<string | null>(null);
  function reset() {
    setPreview(undefined);
    setResult(undefined);
    key.current = null;
    setError('');
  }
  function choose(value: File | undefined) {
    reset();
    setFile(value);
  }
  async function upload(commit: boolean) {
    if (!file) return;
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('File exceeds 2 MiB.');
      const query = new URLSearchParams({
        format: file.name.split('.').pop()?.toLowerCase() ?? '',
        country,
        partial: String(partial),
        retain: String(retain),
        filename: file.name,
      });
      const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
      if (commit) {
        if (!preview) throw new Error('Preview first.');
        key.current ??= crypto.randomUUID();
        headers['Idempotency-Key'] = key.current;
        headers['X-Import-Preview'] = preview.token;
        headers['X-Policy-Version'] = String(preview.policy_version);
      }
      const response = await api<BatchResult | ImportPreview>(
        `/import${commit ? '' : '/preview'}?${query}`,
        { method: 'POST', headers, body: file, onProgress: setProgress },
      );
      if (commit) {
        const saved = response as BatchResult;
        setResult(saved);
        onSuccess(
          `Batch #${saved.batch_id}: ${saved.count} accepted, ${saved.errors?.length ?? 0} rejected.`,
        );
      } else setPreview(response as ImportPreview);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Import parcels" onClose={onClose}>
      <fieldset disabled={busy || !!result}>
        <label
          className="upload-area"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0]);
          }}
        >
          Drop a file here or choose JSON/XML
          <input
            aria-label="Batch file"
            type="file"
            accept=".json,.xml"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          {file?.name}
        </label>
        <p>
          <a href="/api/samples/parcels.json">Sample JSON</a> ·{' '}
          <a href="/api/samples/Container_68465468.xml">Sample XML</a>
        </p>
        <label>
          Fallback country for XML
          <input
            value={country}
            maxLength={2}
            onChange={(e) => {
              reset();
              setCountry(e.target.value.toUpperCase());
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={partial}
            onChange={(e) => {
              reset();
              setPartial(e.target.checked);
            }}
          />{' '}
          Import valid rows even if some rows fail
        </label>
        <label>
          <input
            type="checkbox"
            checked={retain}
            onChange={(e) => {
              reset();
              setRetain(e.target.checked);
            }}
          />{' '}
          Retain recipient name and city from XML
        </label>
        <p className="muted">
          Recipient details are personal data. Retain only when needed; exclude street addresses.
          Atomic import is the default.
        </p>
        <button className="secondary" disabled={!file} onClick={() => void upload(false)}>
          1. Preview import
        </button>
      </fieldset>
      {busy && (
        <label>
          Upload progress (server validation follows)
          <progress max={100} value={progress} />
          {progress}%
        </label>
      )}
      {preview && !result && (
        <section className="panel">
          <h3>Preview · policy v{preview.policy_version}</h3>
          <p>
            {preview.valid} valid / {preview.invalid} rejected · {preview.counts.routed} routed /{' '}
            {preview.counts.pending_insurance} insurance holds
          </p>
          <p>
            {Object.entries(preview.departments)
              .map(([d, n]) => `${d}: ${n}`)
              .join(' · ')}
          </p>
          {preview.errors.length > 0 && (
            <>
              <button onClick={() => download('rejected-rows.csv', errorsCsv(preview.errors))}>
                Download all rejected row reasons
              </button>
              <ul>
                {preview.errors.slice(0, 20).map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            className="primary"
            disabled={busy || (!partial && preview.invalid > 0)}
            onClick={() => void upload(true)}
          >
            2. Confirm import
          </button>
        </section>
      )}
      {result && (
        <section className="panel">
          <h3>Batch #{result.batch_id} imported</h3>
          <p>
            {result.counts.routed} routed · {result.counts.pending_insurance} awaiting insurance ·{' '}
            {result.errors?.length ?? 0} rejected
          </p>
          <p>
            {Object.entries(result.departments ?? {})
              .map(([d, n]) => `${d}: ${n}`)
              .join(' · ')}
          </p>
          <a href={'/api/parcels.csv?batch_id=' + result.batch_id}>Download results CSV</a>
          {!!result.errors?.length && (
            <p>
              <a href={`/api/batches/${result.batch_id}/errors.csv`}>Download rejected rows CSV</a>
            </p>
          )}
          <p>Open Batches & results to view this batch.</p>
        </section>
      )}
      <p role="alert">{error}</p>
    </Modal>
  );
}
