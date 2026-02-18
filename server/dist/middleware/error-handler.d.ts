import type { ErrorHandler } from 'hono';
export declare const errorHandler: ErrorHandler;
export declare class AppError extends Error {
    status: number;
    code: string;
    constructor(message: string, status?: number, code?: string);
}
//# sourceMappingURL=error-handler.d.ts.map