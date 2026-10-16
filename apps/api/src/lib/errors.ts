import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const forbidden = (msg = 'You do not have permission to do that') => new ApiError(403, 'FORBIDDEN', msg);
export const unauthorized = (msg = 'Please sign in to continue') => new ApiError(401, 'UNAUTHORIZED', msg);
export const conflict = (code: string, msg: string) => new ApiError(409, code, msg);
export const badRequest = (msg: string, fields?: Record<string, string>) =>
  new ApiError(400, 'VALIDATION', msg, fields);

/** Parse with a zod schema, converting issues into field errors. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) fields[issue.path.join('.') || '_'] = issue.message;
  throw badRequest('Some fields need attention', fields);
}

/** Wrap async handlers so thrown errors reach the error middleware. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'TOO_LARGE', message: 'That upload is too large' } });
    return;
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: { code: 'TOO_LARGE', message: 'That file is too large' } });
    return;
  }
  console.error(`[${req.method} ${req.path}]`, err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } });
}
