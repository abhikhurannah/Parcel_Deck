import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const base = (process.env.MONITOR_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');
const target = new URL(base);
if (
  target.protocol !== 'https:' &&
  !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname))
)
  throw new Error('Use HTTPS for remote monitoring.');
const monitorToken = process.env.MONITOR_TOKEN;
if (!monitorToken) throw new Error('Set MONITOR_TOKEN for read-only monitoring.');
const statePath = process.env.MONITOR_STATE ?? 'data/monitor-ts-state.json';
async function checked(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}
async function sample(): Promise<string[]> {
  const response = await checked(base + '/api/monitor', {
    headers: { Authorization: 'Bearer ' + monitorToken },
  });
  const body = (await response.json()) as { signals: string[]; alerts: unknown[] };
  return [
    ...body.signals,
    ...(body.alerts.length ? ['Recent server or policy-impact alerts require investigation.'] : []),
  ];
}
for (;;) {
  let signals: string[];
  try {
    signals = await sample();
  } catch {
    signals = ['Service check failed; investigate availability or monitor credentials.'];
  }
  const payload = { service: 'ParcelDesk', status: signals.length ? 'alert' : 'healthy', signals };
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const previous = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8')).fingerprint
    : null;
  try {
    if (previous !== fingerprint) {
      console.log(JSON.stringify(payload));
      const webhook = process.env.ALERT_WEBHOOK;
      if (webhook) {
        if (new URL(webhook).protocol !== 'https:')
          throw new Error('Use an HTTPS notification endpoint.');
        await checked(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      mkdirSync(dirname(statePath), { recursive: true });
      writeFileSync(statePath + '.tmp', JSON.stringify({ fingerprint }));
      renameSync(statePath + '.tmp', statePath);
    }
  } catch {
    console.error('Notification delivery failed; state retained for retry.');
  }
  if (process.argv.includes('--once')) {
    process.exitCode = signals.length ? 1 : 0;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 60000));
}
