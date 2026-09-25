import type { Express, RequestHandler, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { Role } from '../../shared/types.js';
import type { AppOptions } from '../app.js';
import type { Accounts } from '../auth.js';
import type { intakeService } from './intake.js';
export interface Context {
  requestId: string;
  username: string;
  role: Role;
  csrf: string;
  sessionDigest: string;
}
export const context = (res: Response) => res.locals as Context;
export interface AppServices {
  app: Express;
  db: DatabaseSync;
  users: Accounts;
  secure: boolean;
  cookieName: string;
  audit: (res: Response, action: string, detail: unknown) => void;
  requireRole: (...roles: Role[]) => RequestHandler;
  saveItems: ReturnType<typeof intakeService>;
  limit: (key: string, ceiling: number) => void;
  options: AppOptions;
}
