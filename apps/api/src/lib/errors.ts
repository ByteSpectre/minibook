import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { Prisma } from '../db/prisma';
import { logger } from '../logger';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

/** Foreign or missing resources are always reported as 404 (never 403). */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'notFound', message);
  }
}

export const badRequest = (code: string, message?: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Unauthorized') =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (code = 'forbidden', message?: string) => new AppError(403, code, message);
export const conflict = (code = 'conflict', message?: string) => new AppError(409, code, message);
export const paymentRequired = (message = 'Subscription required') =>
  new AppError(402, 'subscriptionRequired', message);
export const tooMany = (code = 'rateLimited', message?: string) => new AppError(429, code, message);

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof AppError) {
    res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation',
        message: 'Validation failed',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      },
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'notFound', message: 'Not found' } });
      return;
    }
    if (err.code === 'P2002') {
      res
        .status(409)
        .json({ error: { code: 'conflict', message: 'Already exists', details: err.meta } });
      return;
    }
  }
  if (err instanceof multer.MulterError) {
    const code = err.code === 'LIMIT_FILE_SIZE' ? 'fileTooLarge' : 'uploadFailed';
    res.status(400).json({ error: { code, message: err.message } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'validation', message: 'Malformed JSON' } });
    return;
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } });
};
