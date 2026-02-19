import type { MiddlewareHandler } from 'hono';

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  requestCount++;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  if (status >= 500) {
    console.error(`[${method}] ${path} -> ${status} (${duration}ms)`);
  } else if (status >= 400) {
    console.warn(`[${method}] ${path} -> ${status} (${duration}ms)`);
  } else {
    console.log(`[${method}] ${path} -> ${status} (${duration}ms)`);
  }
};
