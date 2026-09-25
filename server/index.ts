import { pruneOperationalData } from './migrations.js';
import { createApp } from './app.js';
import { demoAccounts, validateAccounts } from './auth.js';
const demo = process.argv.includes('--demo');
const users = demo
  ? await demoAccounts()
  : validateAccounts(JSON.parse(process.env.ROUTING_USERS ?? '{}'));
const port = Number(process.env.PORT ?? 8081);
const { app, db } = createApp({
  database: process.env.DATABASE ?? (demo ? 'data/demo-ts.sqlite3' : 'data/routing-ts.sqlite3'),
  users: Object.fromEntries(
    Object.entries(users).filter(([, account]) => account.role === 'admin'),
  ),
  secureCookies: !demo,
  allowedHosts: (process.env.TRUSTED_HOSTS ?? 'localhost,127.0.0.1').split(','),
  trustProxy: process.env.TRUST_PROXY?.split(',').filter(Boolean),
  monitorToken: process.env.MONITOR_TOKEN,
  alertWebhook: process.env.ALERT_WEBHOOK,
  log: (entry) => console.log(JSON.stringify(entry)),
});
const server = app.listen(port, demo ? '127.0.0.1' : (process.env.HOST ?? '127.0.0.1'), () => {
  console.log(`ParcelDesk API: http://127.0.0.1:${port}`);
  if (demo)
    console.log(
      'LOCAL DEMO: admin / Demo-admin-2026! (initial password). Create operators and insurers in Account & access.',
    );
});
const retention = setInterval(() => {
  try {
    pruneOperationalData(db);
  } catch {
    console.error('Operational retention failed.');
  }
}, 3600000);
retention.unref();
function shutdown() {
  clearInterval(retention);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
