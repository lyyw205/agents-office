import type { ErrorHandler } from 'hono';

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`[error] ${err.message}`, err.stack);

  const status = 'status' in err ? (err as any).status : 500;
  const code = 'code' in err ? (err as any).code : 'INTERNAL_ERROR';

  return c.json(
    {
      error: err.message || 'Internal server error',
      code,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
    status
  );
};

export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'AppError';
  }
}
