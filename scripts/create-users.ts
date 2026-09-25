import { randomBytes } from 'node:crypto';
import { hashPassword, type Accounts } from '../server/auth.js';
import type { Role } from '../shared/types.js';
const users: Accounts = {};
for (const role of ['admin'] as Role[]) {
  const password = randomBytes(24).toString('base64url');
  users[role] = { role, password_hash: await hashPassword(password) };
  console.error(`Generated ${role} password (save securely): ${password}`);
}
console.log(JSON.stringify(users));
