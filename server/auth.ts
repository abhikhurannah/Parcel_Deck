import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Role } from '../shared/types.js';
const derive = promisify(scrypt);
export interface Account {
  role: Role;
  password_hash: string;
}
export type Accounts = Record<string, Account>;
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export function equal(a: string, b: string): boolean {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${((await derive(password, salt, 64)) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [, salt, key] = hash.split('$');
  const actual = (await derive(password, salt, 64)) as Buffer;
  return equal(actual.toString('hex'), key);
}
export async function demoAccounts(): Promise<Accounts> {
  const entries = await Promise.all(
    (['operator', 'insurer', 'admin'] as Role[]).map(
      async (role) =>
        [role, { role, password_hash: await hashPassword(`Demo-${role}-2026!`) }] as const,
    ),
  );
  return Object.fromEntries(entries);
}
export function validateAccounts(value: unknown): Accounts {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length)
    throw new Error('Configure ROUTING_USERS or explicitly start local demo mode.');
  for (const [name, account] of Object.entries(value)) {
    if (
      !/^[A-Za-z0-9_.-]{1,80}$/.test(name) ||
      !account ||
      !['operator', 'insurer', 'admin'].includes(account.role) ||
      !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(account.password_hash)
    )
      throw new Error('Invalid named account, role or scrypt password hash.');
  }
  if (Object.values(value).filter((a) => a.role === 'admin').length !== 1)
    throw new Error('Configure exactly one administrator.');
  return value as Accounts;
}
