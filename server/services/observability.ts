import type { DatabaseSync } from 'node:sqlite';
export function anomalies(db: DatabaseSync): string[] {
  const signals: string[] = [];
  const rows = db
    .prepare(
      `SELECT department,
 SUM(CASE WHEN created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour') THEN 1 ELSE 0 END) recent,
 SUM(CASE WHEN created_at<strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour') THEN 1 ELSE 0 END) baseline
 FROM parcels WHERE created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days','-1 hour') GROUP BY department`,
    )
    .all();
  const recent = rows.reduce((s, r) => s + Number(r.recent), 0),
    baseline = rows.reduce((s, r) => s + Number(r.baseline), 0);
  if (recent >= 20 && baseline >= 100)
    for (const row of rows) {
      const change = Number(row.recent) / recent - Number(row.baseline) / baseline;
      if (Math.abs(change) >= 0.25)
        signals.push(
          `${row.department} share shifted ${(change * 100).toFixed(0)} percentage points in the last hour versus the preceding seven days.`,
        );
    }
  const counts = db
    .prepare(
      `SELECT SUM(created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')) recent, SUM(created_at<strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')) baseline FROM events WHERE kind='validation_error' AND created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days','-1 hour')`,
    )
    .get()!;
  if (Number(counts.recent) >= 10 && Number(counts.recent) > (3 * Number(counts.baseline)) / 168)
    signals.push(
      'Validation errors spiked: at least 10 in one hour and over 3× the historical hourly average.',
    );
  return signals;
}
export function metricsService() {
  const responses = new Map<string, number>();
  let count = 0,
    sum = 0,
    failures = 0;
  const bounds = [0.01, 0.05, 0.1, 0.5, 1, 5];
  const buckets = bounds.map(() => 0);
  return {
    record(status: number, seconds: number, isImport: boolean) {
      responses.set(String(status), (responses.get(String(status)) ?? 0) + 1);
      count++;
      sum += seconds;
      bounds.forEach((b, i) => {
        if (seconds <= b) buckets[i]++;
      });
      if (isImport && status >= 400) failures++;
    },
    render(db: DatabaseSync) {
      const lines = [
        '# TYPE parceldesk_http_requests_total counter',
        ...Array.from(responses, ([s, n]) => `parceldesk_http_requests_total{status="${s}"} ${n}`),
        '# TYPE parceldesk_import_failures_total counter',
        `parceldesk_import_failures_total ${failures}`,
        '# TYPE parceldesk_request_duration_seconds histogram',
        ...bounds.map(
          (b, i) => `parceldesk_request_duration_seconds_bucket{le="${b}"} ${buckets[i]}`,
        ),
        `parceldesk_request_duration_seconds_bucket{le="+Inf"} ${count}`,
        `parceldesk_request_duration_seconds_count ${count}`,
        `parceldesk_request_duration_seconds_sum ${sum}`,
        '# TYPE parceldesk_parcels gauge',
      ];
      for (const r of db
        .prepare('SELECT department,status,count(*) n FROM parcels GROUP BY department,status')
        .all())
        lines.push(
          `parceldesk_parcels{department=${JSON.stringify(r.department)},status=${JSON.stringify(r.status)}} ${r.n}`,
        );
      return lines.join('\n') + '\n';
    },
  };
}
export function webhookNotifier(
  url: string | undefined,
  send: typeof fetch = fetch,
  log?: (entry: unknown) => void,
) {
  if (url && new URL(url).protocol !== 'https:') throw new Error('ALERT_WEBHOOK must use HTTPS.');
  let last = 0,
    inflight = false;
  return (requestId: string) => {
    if (!url || inflight || Date.now() - last < 60000) return;
    last = Date.now();
    inflight = true;
    void send(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'ParcelDesk', kind: 'server_error', request_id: requestId }),
      signal: AbortSignal.timeout(5000),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Webhook rejected');
      })
      .catch(() => {
        last = 0;
        log?.({ event: 'webhook_delivery_failed', request_id: requestId });
      })
      .finally(() => {
        inflight = false;
      });
  };
}
