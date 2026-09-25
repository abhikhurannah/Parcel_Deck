import { HttpError } from '../domain.js';
export function createLimiter(now: () => number = Date.now) {
  const windows = new Map<string, { count: number; reset: number }>();
  let sweep = 0;
  return (key: string, ceiling: number) => {
    const time = now();
    if (time >= sweep) {
      for (const [k, v] of windows) if (v.reset <= time) windows.delete(k);
      sweep = time + 60000;
    }
    let entry = windows.get(key);
    if (!entry || entry.reset <= time) {
      // Bound memory under requests with many different usernames or addresses.
      if (windows.size >= 20000 && !windows.has(key))
        throw new HttpError(429, 'Request capacity reached. Retry in one minute.');
      entry = { count: 0, reset: time + 60000 };
      windows.set(key, entry);
    }
    if (++entry.count > ceiling)
      throw new HttpError(429, 'Too many requests. Wait one minute and retry.');
  };
}
