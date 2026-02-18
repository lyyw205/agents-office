export const errorHandler = (err, c) => {
    console.error(`[error] ${err.message}`, err.stack);
    const status = 'status' in err ? err.status : 500;
    const code = 'code' in err ? err.code : 'INTERNAL_ERROR';
    return c.json({
        error: err.message || 'Internal server error',
        code,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    }, status);
};
export class AppError extends Error {
    status;
    code;
    constructor(message, status = 400, code = 'BAD_REQUEST') {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'AppError';
    }
}
//# sourceMappingURL=error-handler.js.map