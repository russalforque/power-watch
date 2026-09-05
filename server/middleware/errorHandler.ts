import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('[API ERROR]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred processing your request.';
  const errors = Array.isArray(err.errors) ? err.errors : [err.message || 'Internal Server Error'];

  res.status(statusCode).json({
    success: false,
    message,
    errors
  });
}
