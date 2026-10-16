import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role, UserDTO } from '@amplify/domain';
import { env } from '../env.js';
import { forbidden, unauthorized } from './errors.js';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltHex, keyHex] = stored.split('$');
  if (!saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 32);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

interface TokenClaims {
  sub: string;
  role: Role;
}

export function signToken(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role } satisfies Omit<TokenClaims, 'sub'>, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: '30d',
    issuer: 'amplify-api',
  });
}

/** The caller: a signed-in user, a guest (device id), or anonymous. */
export interface Principal {
  userId: string | null;
  guestId: string | null;
  role: Role | null;
  /** 'u:<id>' | 'g:<id>' | null — the key that owns drafts, contributions, follows, notifications. */
  key: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal: Principal;
    }
  }
}

const GUEST_RE = /^[0-9a-f]{32}$/i;

export function principalMiddleware(req: Request, _res: Response, next: NextFunction) {
  const p: Principal = { userId: null, guestId: null, role: null, key: null };
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const claims = jwt.verify(header.slice(7), env.JWT_SECRET, { issuer: 'amplify-api' }) as jwt.JwtPayload &
        TokenClaims;
      p.userId = claims.sub ?? null;
      p.role = claims.role ?? 'user';
      p.key = `u:${claims.sub}`;
    } catch {
      return next(unauthorized('Your session has expired. Please sign in again.'));
    }
  }
  const guest = req.header('x-guest-id');
  if (guest && GUEST_RE.test(guest)) {
    p.guestId = guest.toLowerCase();
    if (!p.key) p.key = `g:${p.guestId}`;
  }
  req.principal = p;
  next();
}

export function requireUser(req: Request) {
  if (!req.principal.userId) throw unauthorized();
  return req.principal.userId;
}

export function requireKey(req: Request) {
  if (!req.principal.key) throw unauthorized('Missing device identity');
  return req.principal.key;
}

export function requireReviewer(req: Request) {
  requireUser(req);
  if (req.principal.role !== 'reviewer') throw forbidden('Reviewer access only');
  return req.principal.userId!;
}

export const newId = () => randomUUID();

export function toUserDTO(row: any): UserDTO {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    showNameDefault: row.show_name_default,
  };
}
